import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { AsyncLoader, component, createServerRegistry, delay, html } from "../src/index.js";

test("component helpers create scoped signals, handlers, effects, children, and lifecycle cleanup", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;

  const seen = [];
  let mounted = 0;
  let visible = 0;
  let cleaned = 0;
  const server = createServerRegistry({
    "toggle.next"(value) {
      return { value: !value };
    }
  });

  const Child = component(function Child() {
    return html`<small>child</small>`;
  });

  const Parent = component(function Parent() {
    const selected = this.signal("selected", false);
    const label = this.computed("label", () => (selected.value ? "selected" : "idle"));
    const toggle = this.handler("toggle", async function () {
      selected.set(await this.server.toggle.next(selected.value));
    });
    const attach = this.handler("attach", function ({ element }) {
      mounted += 1;
      element.dataset.attached = "true";
      return () => {
        cleaned += 1;
      };
    });
    const visibleHandler = this.handler("visible", function ({ element }) {
      visible += 1;
      element.dataset.visible = "true";
    });

    this.effect(() => {
      seen.push(selected.value);
    });

    return html`
      <section on:attach="${attach}" on:visible="${visibleHandler}">
        <button type="button" on:click="${toggle}" class:selected="${selected.id}">
          Toggle
        </button>
        <output signal:text="${label.id}"></output>
        ${this.render(Child)}
      </section>
    `;
  });

  const loader = AsyncLoader({ root: document, server });
  loader.mount(document.querySelector("#app"), Parent);
  await delay(0);

  assert.equal(mounted, 1);
  assert.equal(visible, 1);
  assert.equal(document.querySelector("section").dataset.attached, "true");
  assert.equal(document.querySelector("section").dataset.visible, "true");
  assert.equal(document.querySelector("small").textContent, "child");
  assert.equal(document.querySelector("output").textContent, "idle");
  assert.deepEqual(seen, [false]);

  document.querySelector("button").click();
  await delay(0);

  assert.equal(document.querySelector("button").classList.contains("selected"), true);
  assert.equal(document.querySelector("output").textContent, "selected");
  assert.deepEqual(seen, [false, true]);

  loader.destroy();
  assert.equal(cleaned, 1);
});

test("component this.on supports rootless fragment lifecycle fallback", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;

  const events = [];
  const Rootless = component(function Rootless() {
    this.on("attach", (target) => {
      events.push(`attach:${target.id}`);
      return () => events.push("attach-cleanup");
    });
    this.on("mount", (target) => {
      events.push(`mount:${target.id}`);
    });
    this.on("visible", (target) => {
      events.push(`visible:${target.id}`);
    });
    this.on("destroy", () => {
      events.push("destroy");
    });

    return html`text <span>fragment</span>`;
  });

  const loader = AsyncLoader({ root: document });
  loader.mount(document.querySelector("#app"), Rootless);
  await delay(0);

  assert.deepEqual(events, ["attach:app", "mount:app", "visible:app"]);

  loader.destroy();
  assert.deepEqual(events, ["attach:app", "mount:app", "visible:app", "destroy", "attach-cleanup"]);
});

test("component templates support inline handlers, signal class values, and signal value attributes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const ProductCard = component(function ProductCard(props) {
    const selected = this.signal(false);
    const tone = this.signal("primary");
    const productId = this.signal("productId", props.id);

    return html`
      <article
        id="card"
        class:selected="${selected}"
        signal:class="${["card", selected, tone, { featured: selected }]}"
      >
        <h2>${props.title}</h2>
        <input id="value-input" value="${productId}">
        <input id="signal-value-input" signal:value="${productId}">
        <button
          id="select"
          type="button"
          on:click="${this.handler(function () {
            selected.set(true);
            tone.set("accent");
            productId.set("sku-2");
          })}"
        >
          Select
        </button>
      </article>
    `;
  });

  const loader = AsyncLoader({ root: document });
  loader.mount(document.querySelector("#app"), ProductCard, {
    id: "sku-1",
    title: "Keyboard"
  });
  await delay(0);

  const card = document.querySelector("#card");
  const valueInput = document.querySelector("#value-input");
  const signalValueInput = document.querySelector("#signal-value-input");

  assert.equal(card.classList.contains("card"), true);
  assert.equal(card.classList.contains("primary"), true);
  assert.equal(card.classList.contains("selected"), false);
  assert.equal(card.classList.contains("featured"), false);
  assert.equal(valueInput.value, "sku-1");
  assert.equal(signalValueInput.value, "sku-1");

  document.querySelector("#select").click();
  await delay(0);

  assert.equal(card.classList.contains("selected"), true);
  assert.equal(card.classList.contains("featured"), true);
  assert.equal(card.classList.contains("primary"), false);
  assert.equal(card.classList.contains("accent"), true);
  assert.equal(valueInput.value, "sku-2");
  assert.equal(signalValueInput.value, "sku-2");

  valueInput.value = "sku-3";
  valueInput.dispatchEvent(new window.Event("input", { bubbles: true }));
  await delay(0);

  assert.equal(signalValueInput.value, "sku-3");

  loader.destroy();
});
