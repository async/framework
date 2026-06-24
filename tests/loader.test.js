import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  component,
  createHandlerRegistry,
  createComponentRegistry,
  createServerRegistry,
  createSignalRegistry,
  defineAttributeConfig,
  delay,
  html,
  signal
} from "../src/index.js";

test("Loader binds text, values, attributes, classes, and input writes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main async:container>
      <span signal:text="product.title"></span>
      <input signal:value="productId">
      <button
        class="base"
        signal:attr:disabled="product.$loading"
        class:selected="selected"
        class:="buttonClasses"
      ></button>
      <button id="legacy" signal:class:legacy="legacySelected"></button>
      <button id="registered-class" signal:class="registeredClasses"></button>
    </main>
  `;

  const signals = createSignalRegistry({
    productId: signal("sku-1"),
    product: signal({ title: "Keyboard" }),
    legacySelected: signal(true),
    selected: signal(false),
    buttonClasses: signal({
      ready: true,
      "tone primary": true,
      hidden: false
    }),
    registeredClasses: signal(["registered", { enabled: true, disabled: false }])
  });

  const loader = Loader({ root: document.body, signals }).start();
  const text = document.querySelector("span");
  const input = document.querySelector("input");
  const button = document.querySelector("button");
  const legacy = document.querySelector("#legacy");
  const registeredClass = document.querySelector("#registered-class");

  assert.equal(text.textContent, "Keyboard");
  assert.equal(input.value, "sku-1");
  assert.equal(button.classList.contains("base"), true);
  assert.equal(legacy.classList.contains("legacy"), true);
  assert.equal(button.classList.contains("selected"), false);
  assert.equal(button.classList.contains("ready"), true);
  assert.equal(button.classList.contains("tone"), true);
  assert.equal(button.classList.contains("primary"), true);
  assert.equal(button.classList.contains("hidden"), false);
  assert.equal(registeredClass.classList.contains("registered"), true);
  assert.equal(registeredClass.classList.contains("enabled"), true);
  assert.equal(registeredClass.classList.contains("disabled"), false);

  signals.set("product.title", "Headphones");
  signals.set("selected", true);
  signals.set("buttonClasses", ["compact", { ready: false, active: true }, ["nested"]]);
  signals.set("registeredClasses", { registered: false, changed: true });
  await delay(0);
  assert.equal(text.textContent, "Headphones");
  assert.equal(button.classList.contains("selected"), true);
  assert.equal(button.classList.contains("base"), true);
  assert.equal(button.classList.contains("ready"), false);
  assert.equal(button.classList.contains("tone"), false);
  assert.equal(button.classList.contains("primary"), false);
  assert.equal(button.classList.contains("compact"), true);
  assert.equal(button.classList.contains("active"), true);
  assert.equal(button.classList.contains("nested"), true);
  assert.equal(registeredClass.classList.contains("registered"), false);
  assert.equal(registeredClass.classList.contains("enabled"), false);
  assert.equal(registeredClass.classList.contains("changed"), true);

  input.value = "sku-2";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await delay(0);
  assert.equal(signals.get("productId"), "sku-2");

  loader.destroy();
});

test("Loader supports configured data attribute prefixes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main data-async-container>
      <button
        data-on-click="select"
        data-signal-attr:disabled="product.$loading"
        data-class-selected="selected"
        data-class-="buttonClasses"
      >
        <span data-signal-text="product.title"></span>
      </button>
      <input data-signal-value="productId">
      <section data-async-boundary="product"></section>
    </main>
  `;

  const attributes = defineAttributeConfig({
    async: "data-async-",
    class: "data-class-",
    signal: "data-signal-",
    on: "data-on-"
  });
  const signals = createSignalRegistry({
    productId: signal("sku-1"),
    product: signal({ title: "Keyboard" }),
    selected: signal(false),
    buttonClasses: signal(["from-array", { custom: true }])
  });
  const loader = Loader({
    root: document.body,
    signals,
    attributes,
    handlers: createHandlerRegistry({
      select() {
        this.signals.set("selected", true);
        this.loader.swap("product", `<p data-signal-text="productId"></p>`);
      }
    })
  }).start();

  assert.equal(document.querySelector("span").textContent, "Keyboard");
  document.querySelector("button").click();
  await delay(0);

  assert.equal(document.querySelector("button").classList.contains("selected"), true);
  assert.equal(document.querySelector("button").classList.contains("from-array"), true);
  assert.equal(document.querySelector("button").classList.contains("custom"), true);
  assert.equal(document.querySelector("p").textContent, "sku-1");

  loader.destroy();
});

test("Loader captures explicit template children for component hosts", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <section async:component="Card">
        <p id="implicit">Do not capture</p>
        <template async:children>
          <p id="captured">Captured</p>
        </template>
      </section>
      <section async:component="EmptyCard">
        <template async:children>
          <p id="unused">Unused</p>
        </template>
      </section>
    </main>
  `;

  const Card = component(function Card({ children }) {
    return html`<article>${children}</article>`;
  });
  const EmptyCard = component(function EmptyCard() {
    return html`<aside>Empty</aside>`;
  });
  const components = createComponentRegistry({ Card, EmptyCard });

  const loader = Loader({ root: document.body, components }).start();

  assert.equal(document.querySelector("#captured").textContent, "Captured");
  assert.equal(document.querySelector("article").contains(document.querySelector("#captured")), true);
  assert.equal(document.querySelector("#implicit"), null);
  assert.equal(document.querySelector("#unused"), null);
  assert.equal(document.querySelector("aside").textContent, "Empty");
  loader.destroy();
});

test("Loader scans protocol attributes inserted from captured component children", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main async:component="Card">
      <template async:children>
        <button id="increment" type="button" on:click="increment">+</button>
        <output id="count" signal:text="count"></output>
      </template>
    </main>
  `;

  const signals = createSignalRegistry({
    count: signal(0)
  });
  const handlers = createHandlerRegistry({
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  });
  const Card = component(function Card({ children }) {
    return html`<article>${children}</article>`;
  });
  const components = createComponentRegistry({ Card });

  const loader = Loader({ root: document.body, components, handlers, signals }).start();

  document.querySelector("#increment").click();
  await delay(0);

  assert.equal(document.querySelector("#count").textContent, "1");
  loader.destroy();
});

test("Loader rejects invalid component children templates", () => {
  const window = new Window();
  const { document } = window;
  const Card = component(function Card({ children }) {
    return html`<article>${children}</article>`;
  });
  const components = createComponentRegistry({ Card });

  document.body.innerHTML = `
    <main async:component="Card">
      <div async:children>Invalid</div>
    </main>
  `;
  assert.throws(
    () => Loader({ root: document.body, components }).start(),
    /async:children must be placed on a direct child <template>/
  );

  document.body.innerHTML = `
    <main async:component="Card">
      <template async:children><p>One</p></template>
      <template async:children><p>Two</p></template>
    </main>
  `;
  assert.throws(
    () => Loader({ root: document.body, components }).start(),
    /can have only one direct child <template async:children>/
  );
});

test("Loader renders async boundaries through loading, ready, and error templates", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="product">
      <template async:loading="product"><p class="loading">Loading</p></template>
      <template async:ready="product"><h1 signal:text="product.title"></h1></template>
      <template async:error="product"><p class="error" signal:text="product.$error.message"></p></template>
    </section>
  `;

  const signals = createSignalRegistry();
  signals.asyncSignal("product", async function () {
    await delay(5, this.abort);
    return { title: "Keyboard" };
  });

  Loader({ root: document.body, signals }).start();

  assert.equal(document.querySelector(".loading").textContent, "Loading");
  await delay(10);
  assert.equal(document.querySelector("h1").textContent, "Keyboard");
});

test("Loader treats async-suspense as boundary markup without custom element registration", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <async-suspense for="product">
      <template loading><p class="loading">Loading</p></template>
      <template ready><h1 signal:text="product.title"></h1></template>
      <template error><p class="error" signal:text="product.$error.message"></p></template>
    </async-suspense>
  `;

  const signals = createSignalRegistry();
  signals.asyncSignal("product", async function () {
    await delay(5, this.abort);
    return { title: "Keyboard" };
  });

  Loader({ root: document.body, signals }).start();

  assert.equal(document.querySelector(".loading").textContent, "Loading");
  await delay(10);
  assert.equal(document.querySelector("async-suspense h1").textContent, "Keyboard");
});

test("Loader dispatches async:error for missing delegated handlers", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<button on:click="missing">Missing</button>`;
  let seen;

  document.body.addEventListener("async:error", (event) => {
    seen = event.detail.error;
  });

  Loader({ root: document.body }).start();
  document.querySelector("button").click();
  await delay(0);

  assert.match(seen.message, /Handler "missing" is not registered/);
});

test("Loader runs semicolon commands with server calls from DOM events", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <form on:submit="preventDefault; server.products.save(productId, $form)">
      <input name="title" value="Keyboard">
      <button type="submit">Save</button>
    </form>
    <output signal:text="savedTitle"></output>
  `;

  const signals = createSignalRegistry({
    productId: signal("sku-1"),
    savedTitle: signal("")
  });
  const server = createServerRegistry({
    "products.save"(productId, form) {
      return serverEnvelope({
        value: { id: productId, ...form },
        signals: {
          savedTitle: form.title
        }
      });
    }
  });
  const loader = Loader({ root: document.body, signals, server }).start();
  const form = document.querySelector("form");
  const event = new window.Event("submit", { bubbles: true, cancelable: true });

  form.dispatchEvent(event);
  await delay(0);

  assert.equal(event.defaultPrevented, true);
  assert.equal(document.querySelector("output").textContent, "Keyboard");

  loader.destroy();
});

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}

test("Loader treats on:attach as the attach pseudo-event and on:mount as an alias", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section id="attach" on:attach="attach"></section>
    <section id="mount" on:mount="mount"></section>
  `;

  const events = [];
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const loader = Loader({
      root: document.body,
      handlers: createHandlerRegistry({
        attach({ element }) {
          events.push(`attach:${element.id}`);
          return () => events.push("attach-cleanup");
        },
        mount({ element }) {
          events.push(`mount:${element.id}`);
          return () => events.push("mount-cleanup");
        }
      })
    }).start();
    await delay(0);

    loader.scan(document.body);
    await delay(0);

    assert.deepEqual(events, ["attach:attach", "mount:mount"]);
    assert.deepEqual(warnings, [
      "on:mount has been renamed to on:attach. The old name remains as a compatibility alias."
    ]);

    loader.destroy();
    assert.deepEqual(events, ["attach:attach", "mount:mount", "attach-cleanup", "mount-cleanup"]);
  } finally {
    console.warn = originalWarn;
  }
});

test("boundary swap rescans inserted HTML and scanned handlers still work", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <button id="stream" on:click="stream">Stream</button>
      <section async:boundary="product"></section>
    </main>
  `;

  const signals = createSignalRegistry({
    title: signal("Keyboard"),
    selected: signal(false)
  });

  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      stream() {
        this.loader.swap(
          "product",
          `<button id="select" on:click="select" signal:class:selected="selected" signal:text="title"></button>`
        );
      },
      select() {
        this.signals.set("selected", true);
      }
    })
  }).start();

  document.querySelector("#stream").click();
  await delay(0);

  const select = document.querySelector("#select");
  assert.equal(select.textContent, "Keyboard");
  select.click();
  await delay(0);
  assert.equal(select.classList.contains("selected"), true);

  loader.destroy();
});

test("boundary swap scan none leaves inserted protocol attributes inert until explicit scan", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;

  const signals = createSignalRegistry({
    title: signal("Keyboard"),
    selected: signal(false)
  });
  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      select() {
        this.signals.set("selected", true);
      }
    })
  }).start();

  loader.swap(
    "product",
    `<button id="select" on:click="select" signal:class:selected="selected" signal:text="title"></button>`,
    { scan: "none" }
  );

  const select = document.querySelector("#select");
  assert.equal(select.textContent, "");
  select.click();
  await delay(0);
  assert.equal(signals.get("selected"), false);
  assert.equal(select.classList.contains("selected"), false);

  loader.scan(select);
  assert.equal(select.textContent, "Keyboard");
  select.click();
  await delay(0);
  assert.equal(signals.get("selected"), true);
  assert.equal(select.classList.contains("selected"), true);

  loader.destroy();
});

test("boundary swap scan full preserves boundary-scope rescan behavior", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;

  const signals = createSignalRegistry({
    title: signal("Keyboard")
  });
  const loader = Loader({ root: document.body, signals }).start();

  loader.swap("product", `<p id="title" signal:text="title"></p>`, { scan: "full" });

  assert.equal(document.querySelector("#title").textContent, "Keyboard");
  loader.destroy();
});

test("boundary swap morph preserves stable shell nodes and cleans removed nodes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="app-shell">
      <header id="shell-header">
        <button id="nav" on:click="select">PBI</button>
      </header>
      <aside id="old-filter" on:attach="track">Filters</aside>
      <main id="page"><h1>PBI</h1></main>
    </section>
  `;

  const events = [];
  const signals = createSignalRegistry({
    selected: signal(false),
    title: signal("FY26")
  });
  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      select() {
        this.signals.set("selected", true);
      },
      track({ element }) {
        events.push(`attach:${element.id}`);
        return () => events.push(`cleanup:${element.id}`);
      }
    })
  }).start();
  await delay(0);

  const header = document.querySelector("#shell-header");
  const nav = document.querySelector("#nav");
  const page = document.querySelector("#page");

  loader.swap(
    "app-shell",
    `
      <header id="shell-header">
        <button id="nav" on:click="select">FY26</button>
      </header>
      <main id="page">
        <h1 signal:text="title"></h1>
        <button id="new-action" on:click="select">Open</button>
      </main>
    `,
    { strategy: "morph" }
  );

  assert.equal(document.querySelector("#shell-header"), header);
  assert.equal(document.querySelector("#nav"), nav);
  assert.equal(document.querySelector("#page"), page);
  assert.equal(document.querySelector("#old-filter"), null);
  assert.equal(document.querySelector("h1").textContent, "FY26");
  assert.deepEqual(events, ["attach:old-filter", "cleanup:old-filter"]);

  nav.click();
  document.querySelector("#new-action").click();
  await delay(0);
  assert.equal(signals.get("selected"), true);

  loader.destroy();
});

test("boundary swap morph rebinds changed protocol attributes without stale subscriptions", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="product">
      <p id="title" signal:text="title"></p>
    </section>
  `;

  const signals = createSignalRegistry({
    title: signal("Keyboard"),
    alternate: signal("Mouse")
  });
  const loader = Loader({ root: document.body, signals }).start();
  const title = document.querySelector("#title");

  assert.equal(title.textContent, "Keyboard");

  loader.swap("product", `<p id="title" signal:text="alternate"></p>`, { strategy: "morph" });

  assert.equal(document.querySelector("#title"), title);
  assert.equal(title.textContent, "Mouse");

  signals.set("title", "Ignored");
  await delay(0);
  assert.equal(title.textContent, "Mouse");

  signals.set("alternate", "Desk");
  await delay(0);
  assert.equal(title.textContent, "Desk");

  loader.destroy();
});

test("boundary swap auto scan skips the stable boundary element", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;

  const loader = Loader({ root: document.body }).start();
  const boundary = document.querySelector("[async\\:boundary='product']");
  boundary.setAttribute("signal:text", "missing");

  assert.doesNotThrow(() => {
    loader.swap("product", `<p id="auto">Auto</p>`);
  });
  assert.equal(document.querySelector("#auto").textContent, "Auto");

  assert.throws(
    () => loader.swap("product", `<p>Full</p>`, { scan: "full" }),
    /Signal "missing" is not registered/
  );

  loader.destroy();
});

test("boundary swap rejects invalid scan options", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;

  const loader = Loader({ root: document.body }).start();

  assert.throws(
    () => loader.swap("product", `<p>Invalid</p>`, { scan: "later" }),
    /Loader swap scan option must be "auto", "full", or "none"/
  );
  assert.throws(
    () => loader.swap("product", `<p>Invalid</p>`, { strategy: "patch" }),
    /Loader swap strategy option must be "replace" or "morph"/
  );

  loader.destroy();
});
