import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { Loader, component, createComponentRegistry, createScheduler, createServerRegistry, delay, html } from "../src/index.js";

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

  const loader = Loader({ root: document, server });
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

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), Rootless);
  await delay(0);

  assert.deepEqual(events, ["attach:app", "mount:app", "visible:app"]);

  loader.destroy();
  assert.deepEqual(events, ["attach:app", "mount:app", "visible:app", "destroy", "attach-cleanup"]);
});

test("component identical attach callbacks both run", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];
  let cleanups = 0;
  const cleanup = () => {
    cleanups += 1;
  };
  const attach = () => {
    events.push("attach");
    return cleanup;
  };

  const ReusedHook = component(function ReusedHook() {
    this.on("attach", attach);
    this.on("attach", attach);
    return html`<span>ready</span>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), ReusedHook);
  await scheduler.flush();

  assert.deepEqual(events, ["attach", "attach"]);
  loader.destroy();
  assert.equal(cleanups, 2);
});

test("component identical visible callbacks both run", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];
  let cleanups = 0;
  const cleanup = () => {
    cleanups += 1;
  };
  const visible = () => {
    events.push("visible");
    return cleanup;
  };

  const ReusedVisibleHook = component(function ReusedVisibleHook() {
    this.on("visible", visible);
    this.on("visible", visible);
    return html`<span>ready</span>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), ReusedVisibleHook);
  await scheduler.flush();

  assert.deepEqual(events, ["visible", "visible"]);
  loader.destroy();
  assert.equal(cleanups, 2);
});

test("component child render attach hooks do not dedupe each other", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Child = component(function Child() {
    this.onMount(() => {
      events.push("child");
    });
    return html`<span>child</span>`;
  });

  const Parent = component(function Parent() {
    return html`${this.render(Child)}${this.render(Child)}`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), Parent);
  await scheduler.flush();

  assert.deepEqual(events, ["child", "child"]);
  loader.destroy();
});

test("component returning a Promise throws a clear unsupported error", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const AsyncComponent = component(async function AsyncComponent() {
    return html`<span>async</span>`;
  });

  const loader = Loader({ root: document });

  assert.throws(
    () => loader.mount(document.querySelector("#app"), AsyncComponent),
    /Component "AsyncComponent" returned a Promise\. Async components are not supported/
  );

  loader.destroy();
});

test("lazy component descriptors mounted through Loader throw a clear unsupported error", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const components = createComponentRegistry({
    ProductCard: { url: "ProductCard.js" }
  }, {
    importModule() {
      return {
        ProductCard: component(function ProductCard() {
          return html`<span>Product</span>`;
        })
      };
    }
  });
  const loader = Loader({ root: document });

  assert.throws(
    () => loader.mount(document.querySelector("#app"), components.resolve("ProductCard")),
    /Component "LazyComponent" returned a Promise\. Async components are not supported/
  );

  loader.destroy();
});

test("lazy component descriptors used through this.render throw a clear unsupported error", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;
  const components = createComponentRegistry({
    ProductCard: { url: "ProductCard.js" }
  }, {
    importModule() {
      return {
        ProductCard: component(function ProductCard() {
          return html`<span>Product</span>`;
        })
      };
    }
  });
  const LazyProductCard = components.resolve("ProductCard");
  const Parent = component(function Parent() {
    return html`${this.render(LazyProductCard)}`;
  });
  const loader = Loader({ root: document });

  assert.throws(
    () => loader.mount(document.querySelector("#app"), Parent),
    /Component "LazyComponent" returned a Promise\. Async components are not supported/
  );

  loader.destroy();
});

test("component visible hook does not run after parent is destroyed", async () => {
  const window = new Window();
  const { document } = window;
  window.IntersectionObserver = undefined;
  document.body.innerHTML = `<main id="app"></main>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const events = [];

  const Visible = component(function Visible() {
    this.on("visible", () => {
      events.push("visible");
    });
    return html`<span>visible</span>`;
  });

  const loader = Loader({ root: document, scheduler });
  loader.mount(document.querySelector("#app"), Visible);
  loader.destroy();
  await scheduler.flush();

  assert.deepEqual(events, []);
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

  const loader = Loader({ root: document });
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

test("component templates support inline signal refs for text, attributes, and properties", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const FormControls = component(function FormControls() {
    const title = this.signal("Keyboard");
    const disabled = this.signal(true);
    const checked = this.signal(false);
    const name = this.signal("sku-1");

    return html`
      <section>
        <h1 signal:text="${title}"></h1>
        <button id="save" signal:attr:disabled="${disabled}">Save</button>
        <input id="checked" type="checkbox" signal:prop:checked="${checked}">
        <input id="name" signal:prop:value="${name}">
        <button
          id="change"
          type="button"
          on:click="${this.handler(function () {
            title.set("Headphones");
            disabled.set(false);
            checked.set(true);
            name.set("sku-2");
          })}"
        >
          Change
        </button>
      </section>
    `;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), FormControls);
  await delay(0);

  assert.equal(document.querySelector("h1").textContent, "Keyboard");
  assert.equal(document.querySelector("#save").hasAttribute("disabled"), true);
  assert.equal(document.querySelector("#save").disabled, true);
  assert.equal(document.querySelector("#checked").checked, false);
  assert.equal(document.querySelector("#name").value, "sku-1");

  document.querySelector("#change").click();
  await delay(0);

  assert.equal(document.querySelector("h1").textContent, "Headphones");
  assert.equal(document.querySelector("#save").hasAttribute("disabled"), false);
  assert.equal(document.querySelector("#save").disabled, false);
  assert.equal(document.querySelector("#checked").checked, true);
  assert.equal(document.querySelector("#name").value, "sku-2");

  loader.destroy();
});

test("component scoped handlers and signals clean up when a mounted fragment is swapped out", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <section async:boundary="route">
        <div id="slot"></div>
      </section>
    </main>
  `;

  let clicks = 0;
  let destroyed = 0;
  let handlerId;
  let signalId;

  const Card = component(function Card() {
    const selected = this.signal(false);
    signalId = selected.id;
    handlerId = this.handler(function () {
      clicks += 1;
      selected.set(true);
    });
    this.on("destroy", () => {
      destroyed += 1;
    });

    return html`
      <button
        id="old-select"
        type="button"
        on:click="${handlerId}"
        signal:class="${["card", { selected }]}"
      >
        Select
      </button>
    `;
  });

  const loader = Loader({ root: document.body }).start();
  loader.mount(document.querySelector("#slot"), Card);
  await delay(0);

  const oldButton = document.querySelector("#old-select");
  assert.equal(typeof loader.handlers.resolve(handlerId), "function");
  assert.equal(loader.signals.has(signalId), true);

  oldButton.click();
  await delay(0);
  assert.equal(clicks, 1);
  assert.equal(oldButton.classList.contains("selected"), true);

  loader.swap("route", `<p id="next-route">Next</p>`);

  assert.equal(destroyed, 1);
  assert.equal(loader.handlers.resolve(handlerId), undefined);
  assert.equal(loader.signals.has(signalId), false);
  assert.equal(document.querySelector("#next-route").textContent, "Next");

  oldButton.click();
  await delay(0);
  assert.equal(clicks, 1);

  loader.destroy();
});

test("component this.suspense emits async boundary templates without owning a wrapper", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const server = createServerRegistry({
    "products.get"() {
      return { title: "Keyboard" };
    }
  });

  const Product = component(function Product() {
    const product = this.asyncSignal("product", async function () {
      await delay(5, this.abort);
      return this.server.products.get("sku-1");
    });

    return html`
      <article id="product" async:boundary="${product.id}">
        ${this.suspense(product, {
          loading() {
            return html`<p class="loading">Loading...</p>`;
          },
          ready(product) {
            return html`<h1 signal:text="${product.id}.title"></h1>`;
          },
          error(product) {
            return html`<p class="error" signal:text="${product.id}.$error.message"></p>`;
          }
        })}
      </article>
    `;
  });

  const loader = Loader({ root: document, server });
  loader.mount(document.querySelector("#app"), Product);

  assert.equal(document.querySelector("#product").tagName, "ARTICLE");
  assert.equal(document.querySelector(".loading").textContent, "Loading...");
  assert.equal(document.querySelector("#product > section"), null);

  await delay(10);

  assert.equal(document.querySelector("h1").textContent, "Keyboard");
  assert.equal(document.querySelector("#product").tagName, "ARTICLE");

  loader.destroy();
});

test("component this.suspense supports shorthand ready views and configured async attributes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const Product = component(function Product() {
    const product = this.asyncSignal("product", async function () {
      await delay(0, this.abort);
      return { title: "Mouse" };
    });

    return html`
      <article id="custom-product" data-async-boundary="${product.id}">
        ${this.suspense(product, (product) => html`
          <h1 data-signal-text="${product.id}.title"></h1>
        `)}
      </article>
    `;
  });

  const loader = Loader({
    root: document,
    attributes: {
      async: "data-async-",
      signal: "data-signal-",
      on: "data-on-",
      class: "data-class-"
    }
  });
  loader.mount(document.querySelector("#app"), Product);
  await delay(5);

  assert.equal(document.querySelector("#custom-product").tagName, "ARTICLE");
  assert.equal(document.querySelector("h1").textContent, "Mouse");

  loader.destroy();
});

test("component this.suspense validates signal refs and view callbacks", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const Errors = component(function Errors() {
    assert.throws(
      () => this.suspense(null, () => html``),
      /this\.suspense\(signalRef, views\) requires a signal ref/
    );
    assert.throws(
      () => this.suspense({ id: "product" }, null),
      /this\.suspense\(signalRef, views\) requires views to be a function or object/
    );
    assert.throws(
      () => this.suspense({ id: "product" }, { ready: "nope" }),
      /this\.suspense\(signalRef, views\) view "ready" must be a function/
    );

    return html`<span id="suspense-errors-ok">ok</span>`;
  });

  const loader = Loader({ root: document });
  loader.mount(document.querySelector("#app"), Errors);

  assert.equal(document.querySelector("#suspense-errors-ok").textContent, "ok");

  loader.destroy();
});
