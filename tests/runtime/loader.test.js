import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  component,
  createHandlerRegistry,
  createComponentRegistry,
  createScheduler,
  createServerRegistry,
  createSignalRegistry,
  defineAttributeConfig,
  delay,
  html,
  signal
} from "../../src/index.js";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

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

  const scheduler = createScheduler({ strategy: "manual" });
  const signals = createSignalRegistry();
  const product = deferred();
  const loader = Loader({ root: document.body, signals, scheduler });
  signals.asyncSignal("product", async function () {
    return product.promise;
  });

  loader.start();

  assert.equal(document.querySelector(".loading").textContent, "Loading");
  await scheduler.flush();
  product.resolve({ title: "Keyboard" });
  await product.promise;
  await Promise.resolve();
  await scheduler.flush();
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

  const scheduler = createScheduler({ strategy: "manual" });
  const signals = createSignalRegistry();
  const product = deferred();
  const loader = Loader({ root: document.body, signals, scheduler });
  signals.asyncSignal("product", async function () {
    return product.promise;
  });

  loader.start();

  assert.equal(document.querySelector(".loading").textContent, "Loading");
  await scheduler.flush();
  product.resolve({ title: "Keyboard" });
  await product.promise;
  await Promise.resolve();
  await scheduler.flush();
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

test("Loader runs on:attach and refuses removed on:mount markup with a warning", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section id="attach" on:attach="attach"></section>
    <section id="stale" on:mount="attach"></section>
  `;
  const events = [];
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const loader = Loader({
      root: document,
      handlers: createHandlerRegistry({
        attach({ element }) {
          events.push(`attach:${element.id}`);
          return () => events.push("attach-cleanup");
        }
      })
    });
    loader.start();
    await delay(0);

    assert.deepEqual(events, ["attach:attach"], "on:mount must not bind");
    assert.deepEqual(warnings, ["on:mount was removed and no longer runs. Rename it to on:attach."]);

    loader.destroy();
    assert.deepEqual(events, ["attach:attach", "attach-cleanup"]);
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

test("boundary swap ifChanged config skips unchanged cleanup and rescan work", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;

  const events = [];
  const signals = createSignalRegistry({
    selected: signal(false),
    title: signal("Keyboard")
  });
  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      attach({ element }) {
        events.push(`attach:${element.id}`);
        return () => events.push(`cleanup:${element.id}`);
      },
      select() {
        this.signals.set("selected", true);
      }
    })
  }).start();

  const render = () => `<button id="select" on:attach="attach" on:click="select" signal:text="title"></button>`;
  loader.swap({ type: "ifChanged", boundary: "product", html: render });
  await delay(0);
  const select = document.querySelector("#select");

  loader.swap({ type: "ifChanged", boundary: "product", html: render });
  await delay(0);

  assert.equal(document.querySelector("#select"), select);
  assert.deepEqual(events, ["attach:select"]);

  loader.swap({ type: "ifChanged", boundary: "product", html: `<button id="select" on:attach="attach">Changed</button>` });
  await delay(0);

  assert.notEqual(document.querySelector("#select"), select);
  assert.deepEqual(events, ["attach:select", "cleanup:select", "attach:select"]);

  document.querySelector("#select").click();
  await delay(0);
  assert.equal(signals.get("selected"), false);

  loader.destroy();
});

test("boundary swap many config applies multiple updates before scanning", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="filters"></section>
    <section async:boundary="timeline"></section>
  `;

  const signals = createSignalRegistry({
    selected: signal(false),
    title: signal("Roadmap")
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

  const swapped = loader.swap({
    type: "many",
    updates: {
      filters: `<button id="filter" on:click="select">Filter</button>`,
      timeline: `<h2 id="timeline-title" signal:text="title"></h2>`
    },
    scan: "once"
  });

  assert.equal(swapped.length, 2);
  assert.equal(document.querySelector("#timeline-title").textContent, "Roadmap");

  document.querySelector("#filter").click();
  await delay(0);
  assert.equal(signals.get("selected"), true);

  loader.destroy();
});

test("boundary swap accepts config object variants", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="filters"></section>
    <section async:boundary="timeline"></section>
    <section async:boundary="detail"></section>
  `;

  const events = [];
  const signals = createSignalRegistry({
    selected: signal(false),
    count: signal(0),
    title: signal("Roadmap")
  });
  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      attach({ element }) {
        events.push(`attach:${element.id}`);
        return () => events.push(`cleanup:${element.id}`);
      },
      select() {
        this.signals.set("selected", true);
      }
    })
  }).start();

  const filterBoundary = loader.swap({
    boundary: "filters",
    html: `<button id="filter" on:click="select">Filter</button>`
  });

  assert.equal(filterBoundary.getAttribute("async:boundary"), "filters");
  document.querySelector("#filter").click();
  await delay(0);
  assert.equal(signals.get("selected"), true);

  loader.swap({
    type: "many",
    updates: {
      timeline: `<h2 id="timeline-title" signal:text="title"></h2>`,
      detail: `<strong id="detail-count">${signals.get("count")}</strong>`
    },
    scan: "once"
  });

  assert.equal(document.querySelector("#timeline-title").textContent, "Roadmap");
  assert.equal(document.querySelector("#detail-count").textContent, "0");

  const renderDetail = () => `<strong id="detail-count" on:attach="attach">${signals.get("count")}</strong>`;
  loader.swap({
    type: "ifChanged",
    boundary: "detail",
    html: renderDetail
  });
  await delay(0);
  const detail = document.querySelector("#detail-count");
  loader.swap({
    type: "ifChanged",
    boundary: "detail",
    html: renderDetail
  });
  await delay(0);

  assert.equal(document.querySelector("#detail-count"), detail);
  assert.deepEqual(events, ["attach:detail-count"]);

  const stop = loader.swap({
    type: "bind",
    boundary: "detail",
    render({ signals }) {
      return `<strong id="detail-count">${signals.get("count")}</strong>`;
    }
  });

  assert.equal(typeof stop, "function");
  signals.set("count", 2);
  await delay(0);
  assert.equal(document.querySelector("#detail-count").textContent, "2");

  stop();
  loader.destroy();
});

test("boundary swap bind config coalesces signal-driven swaps and cleans up", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="summary"></section>`;

  const signals = createSignalRegistry({
    count: signal(0)
  });
  const loader = Loader({
    root: document.body,
    signals
  }).start();
  let renders = 0;

  const stop = loader.swap({
    type: "bind",
    boundary: "summary",
    render({ signals }) {
      renders += 1;
      return `<strong id="count">${signals.get("count")}</strong>`;
    }
  });

  assert.equal(document.querySelector("#count").textContent, "0");
  assert.equal(renders, 1);

  signals.set("count", 1);
  signals.set("count", 2);
  await delay(0);

  assert.equal(document.querySelector("#count").textContent, "2");
  assert.equal(renders, 2);

  stop();
  signals.set("count", 3);
  await delay(0);

  assert.equal(document.querySelector("#count").textContent, "2");
  assert.equal(renders, 2);

  loader.destroy();
});

test("boundary swap bind config does not treat inserted signal bindings as rerender deps", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="summary"></section>`;

  const signals = createSignalRegistry({
    count: signal(0),
    title: signal("Roadmap")
  });
  const loader = Loader({
    root: document.body,
    signals
  }).start();
  let renders = 0;

  loader.swap({
    type: "bind",
    boundary: "summary",
    render({ signals }) {
      renders += 1;
      return html`
        <h2 id="title" signal:text=${"title"}></h2>
        <strong id="count">${signals.get("count")}</strong>
      `;
    }
  });

  assert.equal(document.querySelector("#title").textContent, "Roadmap");
  assert.equal(document.querySelector("#count").textContent, "0");
  assert.equal(renders, 1);

  signals.set("title", "Milestones");
  await delay(0);

  assert.equal(document.querySelector("#title").textContent, "Milestones");
  assert.equal(document.querySelector("#count").textContent, "0");
  assert.equal(renders, 1);

  signals.set("count", 1);
  await delay(0);

  assert.equal(document.querySelector("#title").textContent, "Milestones");
  assert.equal(document.querySelector("#count").textContent, "1");
  assert.equal(renders, 2);

  loader.destroy();
});

test("boundary swap many ifChanged skips unchanged boundaries", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="filters"></section>
    <section async:boundary="timeline"></section>
  `;

  const events = [];
  const signals = createSignalRegistry({
    title: signal("Roadmap"),
    count: signal(0)
  });
  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      attach({ element }) {
        events.push(`attach:${element.id}`);
        return () => events.push(`cleanup:${element.id}`);
      }
    })
  }).start();

  const renderTimeline = () => `<h2 id="timeline-title" on:attach="attach">${signals.get("title")}</h2>`;
  const renderFilters = () => `<button id="filter">${signals.get("count")}</button>`;

  loader.swap({
    type: "many",
    ifChanged: true,
    updates: {
      filters: renderFilters,
      timeline: renderTimeline
    },
    scan: "once"
  });
  await delay(0);
  const timelineTitle = document.querySelector("#timeline-title");
  const filter = document.querySelector("#filter");
  assert.deepEqual(events, ["attach:timeline-title"]);

  loader.swap({
    type: "many",
    ifChanged: true,
    updates: {
      filters: renderFilters,
      timeline: renderTimeline
    },
    scan: "once"
  });
  await delay(0);
  assert.equal(document.querySelector("#timeline-title"), timelineTitle);
  assert.equal(document.querySelector("#filter"), filter);
  assert.deepEqual(events, ["attach:timeline-title"]);

  signals.set("title", "Milestones");
  loader.swap({
    type: "many",
    ifChanged: true,
    updates: {
      filters: renderFilters,
      timeline: renderTimeline
    },
    scan: "once"
  });
  await delay(0);
  assert.notEqual(document.querySelector("#timeline-title"), timelineTitle);
  assert.equal(document.querySelector("#filter"), filter);
  assert.equal(document.querySelector("#timeline-title").textContent, "Milestones");
  assert.deepEqual(events, ["attach:timeline-title", "cleanup:timeline-title", "attach:timeline-title"]);

  loader.destroy();
});

test("boundary swap many ifChanged all unchanged skips scan", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="timeline"></section>`;

  const events = [];
  const loader = Loader({
    root: document.body,
    handlers: createHandlerRegistry({
      attach({ element }) {
        events.push(`attach:${element.id}`);
      }
    })
  }).start();

  const htmlContent = `<div id="track" on:attach="attach">Track</div>`;
  loader.swap({ type: "many", ifChanged: true, updates: { timeline: htmlContent }, scan: "once" });
  await delay(0);
  loader.swap({ type: "many", ifChanged: true, updates: { timeline: htmlContent }, scan: "once" });
  await delay(0);

  assert.deepEqual(events, ["attach:track"]);
  loader.destroy();
});

test("defineRefreshPlan resolves scopes and refresh applies batched swaps", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="view-timeline"></section>
    <section async:boundary="view-detail"></section>
    <section async:boundary="app-chrome"></section>
  `;

  const signals = createSignalRegistry({
    title: signal("Lake Powell"),
    detail: signal("North")
  });
  const loader = Loader({ root: document.body, signals }).start();

  loader.defineRefreshPlan({
    timeline: {
      boundaries: ["view-timeline"],
      render() {
        return {
          "view-timeline": `<h2 id="timeline-title">${signals.get("title")}</h2>`
        };
      }
    },
    chrome: ["app-chrome"]
  });

  const swapped = loader.refresh("timeline");
  assert.equal(swapped.length, 1);
  assert.equal(document.querySelector("#timeline-title").textContent, "Lake Powell");

  signals.set("title", "Antelope");
  loader.refresh("timeline");
  assert.equal(document.querySelector("#timeline-title").textContent, "Antelope");

  loader.refresh("chrome", {
    "app-chrome": `<header id="chrome">Chrome</header>`
  });
  assert.equal(document.querySelector("#chrome").textContent, "Chrome");

  assert.throws(
    () => loader.refresh("missing"),
    /Refresh scope "missing" was not defined/
  );
  assert.throws(
    () => loader.refresh("chrome"),
    /loader\.refresh\("chrome"\) requires updates when the scope plan has no render function/
  );

  loader.destroy();
});

test("boundary swap bind config respects explicit deps list", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="detail"></section>`;

  const signals = createSignalRegistry({
    "demoState.settings.rangeMode": signal("week"),
    title: signal("Overview"),
    count: signal(0)
  });
  const loader = Loader({ root: document.body, signals }).start();
  let renders = 0;

  loader.swap({
    type: "bind",
    boundary: "detail",
    deps: ["demoState.settings.rangeMode"],
    render({ signals }) {
      renders += 1;
      return `<p id="detail">${signals.get("demoState.settings.rangeMode")}:${signals.get("title")}:${signals.get("count")}</p>`;
    }
  });

  assert.equal(document.querySelector("#detail").textContent, "week:Overview:0");
  assert.equal(renders, 1);

  signals.set("title", "Changed");
  await delay(0);
  assert.equal(document.querySelector("#detail").textContent, "week:Overview:0");
  assert.equal(renders, 1);

  signals.set("demoState.settings.rangeMode", "month");
  await delay(0);
  assert.equal(document.querySelector("#detail").textContent, "month:Changed:0");
  assert.equal(renders, 2);

  loader.destroy();
});

test("boundary swap many config supports per-entry strategy", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="app-chrome">
      <header id="shell-header">Chrome</header>
      <aside id="old-filter">Old</aside>
    </section>
    <section async:boundary="view-timeline">
      <h2 id="timeline-title">Old timeline</h2>
    </section>
  `;

  const signals = createSignalRegistry({
    title: signal("FY26")
  });
  const loader = Loader({ root: document.body, signals }).start();

  const header = document.querySelector("#shell-header");
  loader.swap({
    type: "many",
    scan: "once",
    updates: {
      "app-chrome": {
        html: `
          <header id="shell-header">Chrome</header>
          <main id="page"><h1 signal:text="title"></h1></main>
        `,
        strategy: "morph"
      },
      "view-timeline": {
        html: `<h2 id="timeline-title">New timeline</h2>`,
        strategy: "replace"
      }
    }
  });

  assert.equal(document.querySelector("#shell-header"), header);
  assert.equal(document.querySelector("#old-filter"), null);
  assert.equal(document.querySelector("h1").textContent, "FY26");
  assert.notEqual(document.querySelector("#timeline-title").textContent, "Old timeline");
  assert.equal(document.querySelector("#timeline-title").textContent, "New timeline");

  loader.destroy();
});

test("boundary swap morph attach matrix preserves or rebinds attach handlers", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="timeline">
      <div id="chrome" on:attach="trackChrome">
        <button id="scroll" on:click="scroll">Scroll</button>
        <aside id="popover" on:attach="trackPopover">Popover</aside>
      </div>
    </section>
  `;

  const events = [];
  const signals = createSignalRegistry({
    label: signal("A")
  });
  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      trackChrome({ element }) {
        events.push(`attach:${element.id}`);
        return () => events.push(`cleanup:${element.id}`);
      },
      trackPopover({ element }) {
        events.push(`attach:${element.id}`);
        return () => events.push(`cleanup:${element.id}`);
      },
      scroll() {
        signals.set("label", "B");
      }
    })
  }).start();
  await delay(0);
  assert.deepEqual(events, ["attach:chrome", "attach:popover"]);

  loader.swap({
    boundary: "timeline",
    html: `
      <div id="chrome" on:attach="trackChrome">
        <button id="scroll" on:click="scroll">Scroll</button>
        <p id="label" signal:text="label"></p>
      </div>
    `,
    strategy: "morph",
    attach: "preserve"
  });
  await delay(0);
  assert.deepEqual(events, ["attach:chrome", "attach:popover", "cleanup:popover"]);

  loader.swap({
    boundary: "timeline",
    html: `
      <div id="chrome" on:attach="trackChrome">
        <button id="scroll" on:click="scroll">Scroll</button>
        <p id="label" signal:text="label">B</p>
      </div>
    `,
    strategy: "morph",
    attach: "rebind"
  });
  await delay(0);
  assert.deepEqual(events, [
    "attach:chrome",
    "attach:popover",
    "cleanup:popover",
    "cleanup:chrome",
    "attach:chrome"
  ]);

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
  assert.throws(
    () => loader.swap({ type: "many", updates: { product: `<p>Invalid</p>` }, scan: "later" }),
    /loader\.swap\(\{ type: "many" \}\) scan option must be "auto", "full", "none", or "once"/
  );
  assert.throws(
    () => loader.swap({ type: "later", boundary: "product", html: `<p>Invalid</p>` }),
    /loader\.swap\(\{ type \}\) must be "replace", "ifChanged", "many", or "bind"/
  );
  assert.throws(
    () => loader.swap({ html: `<p>Invalid</p>` }),
    /loader\.swap\(\{ boundary, \.\.\. \}\) requires a non-empty boundary string/
  );
  assert.throws(
    () => loader.swap({ boundary: "product" }),
    /loader\.swap\(\{ html \}\) requires an "html" value/
  );
  assert.throws(
    () => loader.swap({ type: "many" }),
    /loader\.swap\(\{ type: "many" \}\) requires an "updates" value/
  );
  assert.throws(
    () => loader.swap({ type: "bind", boundary: "product", html: `<p>Invalid</p>` }),
    /loader\.swap\(\{ type: "bind", render \}\) requires a render function/
  );

  loader.destroy();
});
