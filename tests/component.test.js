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

    this.effect(() => {
      seen.push(selected.value);
    });

    this.onMount(() => {
      mounted += 1;
      return () => {
        cleaned += 1;
      };
    });

    this.onVisible(() => {
      visible += 1;
    });

    return html`
      <section>
        <button type="button" on:click="${toggle}" data-async-class:selected="${selected.id}">
          Toggle
        </button>
        <output data-async-text="${label.id}"></output>
        ${this.render(Child)}
      </section>
    `;
  });

  const loader = AsyncLoader({ root: document, server });
  loader.mount(document.querySelector("#app"), Parent);
  await delay(0);

  assert.equal(mounted, 1);
  assert.equal(visible, 1);
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
