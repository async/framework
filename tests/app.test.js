import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Async,
  createApp,
  createLazyRegistry,
  createScheduler,
  createSignal,
  defineAsyncContainerElement,
  defineAsyncSuspenseElement,
  defineApp,
  defineCache,
  defineRegistrySnapshot,
  defineRoute,
  delay,
  html,
  readSnapshot,
  route,
  signal
} from "../src/index.js";

test("Async.use(type, entries) before start registers app runtime pieces", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <button on:click="increment">+</button>
    <output signal:text="count"></output>
  `;
  const app = defineApp();
  app.use("signal", {
    count: createSignal(0)
  });
  app.use("handler", {
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  });

  const runtime = createApp(app, { root: document.body }).start();
  document.querySelector("button").click();
  await delay(0);

  assert.equal(document.querySelector("output").textContent, "1");
  runtime.destroy();
});

test("Async.use(moduleObject) and late app.use patch a live runtime", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <button on:click="late">Late</button>
    <output signal:text="ready"></output>
  `;
  const app = defineApp({
    signal: {
      ready: createSignal("idle")
    }
  });
  const runtime = createApp(app, { root: document.body }).start();

  app.use({
    handler: {
      late() {
        this.signals.set("ready", "ready");
      }
    }
  });

  document.querySelector("button").click();
  await delay(0);

  assert.equal(document.querySelector("output").textContent, "ready");
  runtime.destroy();
});

test("runtime.use delegates through the same app hub", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <button on:click="fromRuntime">Run</button>
    <output signal:text="status"></output>
  `;
  const app = defineApp({
    signal: {
      status: createSignal("idle")
    }
  });
  const runtime = createApp(app, { root: document.body }).start();

  runtime.use("handler", {
    fromRuntime() {
      this.signals.set("status", "done");
    }
  });

  document.querySelector("button").click();
  await delay(0);

  assert.equal(document.querySelector("output").textContent, "done");
  assert.equal(Object.hasOwn(app.snapshot().handler, "fromRuntime"), true);
  runtime.destroy();
});

test("Async singleton can start an app and expose the latest runtime", async () => {
  const window = new Window();
  const { document } = window;
  const signalId = `asyncSingleton${Date.now()}`;
  document.body.innerHTML = `<output signal:text="${signalId}"></output>`;

  Async.use("signal", {
    [signalId]: createSignal("singleton")
  });

  const runtime = Async.start({ root: document.body, router: false });
  await delay(0);

  assert.equal(document.querySelector("output").textContent, "singleton");
  assert.equal(Async.runtime, runtime);
  runtime.destroy();
});

test("app duplicate ids fail by default", () => {
  const app = defineApp({
    signal: {
      count: createSignal(0)
    }
  });

  assert.throws(
    () => app.use("signal", { count: createSignal(1) }),
    /signal "count" is already registered/
  );
});

test("createSignal and defineRoute are canonical while aliases remain compatible", () => {
  const created = createSignal(1);
  const aliased = signal(2);
  const defined = defineRoute("product.page");
  const routeAlias = route("cart.page");

  assert.equal(created.value, 1);
  assert.equal(aliased.value, 2);
  assert.deepEqual(defined, { partial: "product.page" });
  assert.deepEqual(routeAlias, { partial: "cart.page" });
});

test("browser handlers receive browser cache from app runtime", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<button on:click="remember">Remember</button>`;
  const app = defineApp({
    cache: {
      browser: {
        ui: defineCache({ ttl: 1000 })
      }
    },
    handler: {
      remember() {
        this.cache.set("ui:panel", "open");
      }
    }
  });
  const runtime = createApp(app, { root: document.body }).start();

  document.querySelector("button").click();
  await delay(0);

  assert.equal(runtime.browser.cache.get("ui:panel"), "open");
  runtime.destroy();
});

test("server commands receive server cache while handlers receive browser cache", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <button on:click="commandCache.local; server.commandCache.save(commandCache.id)">Save</button>
    <output signal:text="commandCache.status"></output>
  `;
  const app = defineApp({
    signal: {
      commandCache: createSignal({
        id: "sku-1",
        status: ""
      })
    },
    cache: {
      browser: {
        ui: defineCache({ ttl: 1000 })
      },
      server: {
        commandCache: defineCache({ ttl: 1000 })
      }
    },
    handler: {
      "commandCache.local"() {
        this.cache.set("ui:handler", "browser");
      }
    },
    server: {
      "commandCache.save"(id) {
        this.cache.set(`commandCache:${id}`, "server");
        return {
          signals: {
            "commandCache.status": this.cache.get(`commandCache:${id}`)
          }
        };
      }
    }
  });
  const runtime = createApp(app, { root: document.body }).start();

  document.querySelector("button").click();
  await delay(0);

  assert.equal(runtime.browser.cache.get("ui:handler"), "browser");
  assert.equal(runtime.server.cache.get("commandCache:sku-1"), "server");
  assert.equal(runtime.browser.cache.get("commandCache:sku-1"), undefined);
  assert.equal(document.querySelector("output").textContent, "server");
  runtime.destroy();
});

test("server functions and partials receive server cache", async () => {
  const app = defineApp({
    cache: {
      server: {
        product: defineCache({ ttl: 1000 })
      }
    },
    server: {
      async "products.get"(id) {
        return this.cache.getOrSet(`product:${id}`, () => ({ id, title: "Keyboard" }));
      }
    },
    partial: {
      async "product.page"({ id }) {
        const product = await this.server.products.get(id);
        return html`<h1>${product.title}</h1>`;
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    }
  });
  const runtime = createApp(app, { target: "server" });
  const response = await runtime.render("/products/sku-1");

  assert.equal(response.status, 200);
  assert.match(response.html, /Keyboard/);
  assert.deepEqual(runtime.server.cache.get("product:sku-1"), { id: "sku-1", title: "Keyboard" });
  runtime.destroy();
});

test("SSR render serializes signals and browser cache, never server cache", async () => {
  const app = defineApp({
    signal: {
      productId: createSignal(null)
    },
    cache: {
      browser: {
        product: defineCache({ ttl: 1000 })
      },
      server: {
        secret: defineCache({ ttl: 1000 })
      }
    },
    partial: {
      "product.page"() {
        this.cache.set("secret:token", "do-not-ship");
        return {
          html: `<h1>Keyboard</h1>`,
          signals: {
            productId: "sku-1"
          },
          cache: {
            browser: {
              "product:sku-1": { title: "Keyboard" }
            }
          }
        };
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    }
  });
  const runtime = createApp(app, { target: "server" });
  const response = await runtime.render("/products/sku-1");

  assert.equal(response.signals.productId, "sku-1");
  assert.deepEqual(response.cache.browser["product:sku-1"], { title: "Keyboard" });
  assert.equal(response.cache.server, undefined);
  assert.doesNotMatch(response.html, /do-not-ship|secret:token/);
  assert.match(response.html, /async:snapshot/);
  runtime.destroy();
});

test("SSR render uses configured async attributes for boundary and snapshot", async () => {
  const app = defineApp({
    partial: {
      "home.page"() {
        return "<h1>Home</h1>";
      }
    },
    route: {
      "/": defineRoute("home.page")
    }
  });
  const runtime = createApp(app, {
    target: "server",
    attributes: {
      async: "data-async-",
      signal: "data-signal-",
      on: "data-on-"
    }
  });
  const response = await runtime.render("/");

  assert.match(response.html, /data-async-boundary="route"/);
  assert.match(response.html, /data-async-snapshot/);
  assert.doesNotMatch(response.html, /async:snapshot/);

  runtime.destroy();
});

test("browser runtime activates SSR HTML and snapshot without implicit fetch", async () => {
  const app = defineApp({
    signal: {
      productId: createSignal(null),
      selected: createSignal(false)
    },
    cache: {
      browser: {
        product: defineCache({ ttl: 1000 })
      }
    },
    handler: {
      select() {
        this.signals.set("selected", true);
      }
    },
    partial: {
      "product.page"({ id }) {
        return {
          html: html`
            <article>
              <a id="next" href="/products/sku-2">Next</a>
              <button id="select" on:click="select" signal:class:selected="selected">${id}</button>
              <output id="product-id" signal:text="productId"></output>
            </article>
          `,
          signals: {
            productId: id
          },
          cache: {
            browser: {
              [`product:${id}`]: { id, title: "Keyboard" }
            }
          }
        };
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    }
  });
  const serverRuntime = createApp(app, { target: "server" });
  const response = await serverRuntime.render("/products/sku-1");
  serverRuntime.destroy();

  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = response.html;

  const hadFetch = Object.hasOwn(globalThis, "fetch");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("global fetch should not run during SSR activation.");
  };

  try {
    const runtime = createApp(app, { root: document.body }).start();

    assert.equal(runtime.router.mode, "ssr");
    assert.equal(document.querySelector("#product-id").textContent, "sku-1");
    assert.deepEqual(runtime.browser.cache.get("product:sku-1"), { id: "sku-1", title: "Keyboard" });

    document.querySelector("#select").click();
    await delay(0);
    assert.equal(document.querySelector("#select").classList.contains("selected"), true);

    const next = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("#next").dispatchEvent(next);
    assert.equal(next.defaultPrevented, false);

    runtime.destroy();
  } finally {
    if (hadFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete globalThis.fetch;
    }
  }
});

test("browser runtime restores SSR async signal snapshots without immediate refresh", async () => {
  let loads = 0;
  const app = defineApp({
    asyncSignal: {
      product: async function () {
        loads += 1;
        return { title: `Keyboard ${loads}` };
      }
    },
    partial: {
      async "product.page"() {
        const product = this.signals.ref("product");
        await product.refresh();
        return html`
          <article async:boundary="product">
            <template async:loading="product"><p class="loading">Loading</p></template>
            <template async:ready="product">
              <h1 id="product-title" signal:text="product.$value.title"></h1>
            </template>
          </article>
          <output id="product-value" signal:text="product.title"></output>
          <output id="product-status" signal:text="product.$status"></output>
        `;
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    }
  });
  const serverRuntime = createApp(app, { target: "server" });
  const response = await serverRuntime.render("/products/sku-1");
  serverRuntime.destroy();

  assert.equal(loads, 1);
  assert.equal(response.signals.product.status, "ready");
  assert.deepEqual(response.signals.product.value, { title: "Keyboard 1" });

  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = response.html;

  const runtime = createApp(app, {
    root: document.body,
    router: false
  }).start();
  await delay(0);

  assert.equal(loads, 1);
  assert.deepEqual(runtime.signals.get("product.$value"), { title: "Keyboard 1" });
  assert.equal(runtime.signals.get("product.$status"), "ready");
  assert.equal(runtime.signals.get("product.$version"), 1);
  assert.equal(document.querySelector("#product-title").textContent, "Keyboard 1");
  assert.equal(document.querySelector("#product-value").textContent, "Keyboard 1");
  assert.equal(document.querySelector("#product-status").textContent, "ready");
  assert.equal(document.querySelector(".loading"), null);

  runtime.destroy();
});

test("browser runtime restores SSR signal and browser cache snapshots", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<output signal:text="productId"></output>`;
  const app = defineApp({
    signal: {
      productId: createSignal(null)
    },
    cache: {
      browser: {
        product: defineCache({ ttl: 1000 })
      }
    }
  });

  const runtime = createApp(app, {
    root: document.body,
    snapshot: {
      signals: {
        productId: "sku-1"
      },
      cache: {
        browser: {
          "product:sku-1": { title: "Keyboard" }
        }
      }
    },
    router: false
  }).start();

  assert.equal(document.querySelector("output").textContent, "sku-1");
  assert.deepEqual(runtime.browser.cache.get("product:sku-1"), { title: "Keyboard" });
  runtime.destroy();
});

test("browser runtime can read and apply SSR snapshot scripts automatically", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <output signal:text="productId"></output>
      <script type="application/json" async:snapshot>
        {
          "signals": {
            "productId": "sku-2"
          },
          "cache": {
            "browser": {
              "product:sku-2": { "title": "Mouse" }
            }
          }
        }
      </script>
    </main>
  `;
  const app = defineApp({
    signal: {
      productId: createSignal(null)
    },
    cache: {
      browser: {
        product: defineCache({ ttl: 1000 })
      }
    }
  });

  assert.deepEqual(readSnapshot(document.body).signals, { productId: "sku-2" });

  const runtime = createApp(app, {
    root: document.body,
    router: false
  }).start();

  assert.equal(document.querySelector("output").textContent, "sku-2");
  assert.deepEqual(runtime.browser.cache.get("product:sku-2"), { title: "Mouse" });
  runtime.destroy();
});

test("readSnapshot supports configured async data attributes", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <script type="application/json" data-async-snapshot>
      {
        "signals": {
          "productId": "sku-3"
        }
      }
    </script>
  `;

  assert.deepEqual(readSnapshot(document.body, {
    attributes: {
      async: "data-async-"
    }
  }), {
    signal: {
      productId: "sku-3"
    },
    signals: {
      productId: "sku-3"
    },
    cache: {
      browser: {}
    },
    handler: {},
    server: {},
    partial: {},
    route: {},
    component: {},
    asyncSignal: {}
  });
});

test("readSnapshot reports malformed snapshot JSON with an Async-specific error", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<script type="application/json" async:snapshot>{bad json</script>`;

  assert.throws(
    () => readSnapshot(document.body),
    /Could not parse Async snapshot/
  );
});

test("readSnapshot merges incremental snapshots in document order", () => {
  const window = new Window();
  const { document } = window;
  document.head.innerHTML = `
    <script type="application/json" async:snapshot>
      {
        "signal": { "productId": "sku-1" },
        "handler": { "cart.add": { "url": "cart.add.js" } }
      }
    </script>
  `;
  document.body.innerHTML = `
    <script type="application/json" async:snapshot>
      {
        "signals": { "productId": "sku-2" },
        "component": { "ProductCard": { "url": "ProductCard.js" } }
      }
    </script>
  `;

  assert.deepEqual(readSnapshot(document), {
    signal: {
      productId: "sku-2"
    },
    signals: {
      productId: "sku-2"
    },
    cache: {
      browser: {}
    },
    handler: {
      "cart.add": { url: "cart.add.js" }
    },
    server: {},
    partial: {},
    route: {},
    component: {
      ProductCard: { url: "ProductCard.js" }
    },
    asyncSignal: {}
  });
});

test("rootless runtime starts without scanning until a root is attached", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<output signal:text="status"></output>`;
  const app = defineApp({
    signal: {
      status: createSignal("ready")
    }
  });

  const runtime = createApp(app, { router: false }).start();

  assert.equal(runtime.loader, undefined);
  assert.equal(runtime.inspectRoots().count, 0);
  assert.equal(document.querySelector("output").textContent, "");

  runtime.attachRoot(document.body);
  await delay(0);

  assert.equal(runtime.inspectRoots().count, 1);
  assert.equal(document.querySelector("output").textContent, "ready");

  runtime.detachRoot(document.body);
  assert.equal(runtime.inspectRoots().count, 0);
  runtime.destroy();
});

test("rootless runtime attachRoot is idempotent for the same root", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<span on:attach="attached">Root</span>`;
  let attached = 0;
  const app = defineApp({
    handler: {
      attached() {
        attached += 1;
      }
    }
  });

  const runtime = createApp(app, { router: false }).start();
  runtime.attachRoot(document.body);
  runtime.attachRoot(document.body);
  await delay(0);

  assert.equal(runtime.inspectRoots().count, 1);
  assert.equal(attached, 1);
  runtime.destroy();
});

test("rootless runtime detachRoot cancels pending scoped scheduler jobs", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<output signal:text="status"></output>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const app = defineApp({
    signal: {
      status: createSignal("idle")
    }
  });

  const runtime = createApp(app, { router: false, scheduler }).start();
  runtime.attachRoot(document.body);

  assert.equal(document.querySelector("output").textContent, "idle");
  runtime.signals.set("status", "detached");
  runtime.detachRoot(document.body);
  await scheduler.flush();

  assert.equal(runtime.inspectRoots().count, 0);
  assert.equal(document.querySelector("output").textContent, "idle");
  runtime.destroy();
});

test("rootless runtime can detach and reattach the same root with live signal bindings", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<output signal:text="status"></output>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const app = defineApp({
    signal: {
      status: createSignal("idle")
    }
  });

  const runtime = createApp(app, { router: false, scheduler }).start();
  runtime.attachRoot(document.body);

  assert.equal(document.querySelector("output").textContent, "idle");

  runtime.detachRoot(document.body);
  runtime.signals.set("status", "while-detached");
  await scheduler.flush();
  assert.equal(document.querySelector("output").textContent, "idle");

  runtime.attachRoot(document.body);
  assert.equal(document.querySelector("output").textContent, "while-detached");

  runtime.signals.set("status", "reattached");
  await scheduler.flush();
  assert.equal(document.querySelector("output").textContent, "reattached");

  runtime.destroy();
});

test("rootless runtime applySnapshot updates all attached roots", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section id="left"><output signal:text="status"></output></section>
    <section id="right"><output signal:text="status"></output></section>
  `;
  const scheduler = createScheduler({ strategy: "manual" });
  const app = defineApp({
    signal: {
      status: createSignal("idle")
    }
  });

  const runtime = createApp(app, { router: false, scheduler }).start();
  runtime.attachRoot(document.querySelector("#left"));
  runtime.attachRoot(document.querySelector("#right"));

  assert.deepEqual([...document.querySelectorAll("output")].map((node) => node.textContent), ["idle", "idle"]);

  runtime.applySnapshot({
    signals: {
      status: "ready"
    }
  });
  await scheduler.flush();

  assert.deepEqual([...document.querySelectorAll("output")].map((node) => node.textContent), ["ready", "ready"]);
  assert.equal(runtime.inspectRoots().count, 2);
  assert.equal(runtime.inspectRoots().roots.filter((entry) => entry.primary).length, 1);
  runtime.destroy();
});

test("rootless runtime destroy detaches all roots and rejects future attaches", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section id="left"></section>
    <section id="right"></section>
  `;
  const runtime = createApp(defineApp(), { router: false }).start();

  runtime.attachRoot(document.querySelector("#left"));
  runtime.attachRoot(document.querySelector("#right"));
  assert.equal(runtime.inspectRoots().count, 2);

  runtime.destroy();

  assert.equal(runtime.inspectRoots().count, 0);
  assert.throws(
    () => runtime.attachRoot(document.body),
    /Async app runtime has been destroyed/
  );
});

test("async-container self attaches to the active runtime without double binding", async () => {
  const window = new Window();
  const { document } = window;
  const app = defineApp({
    signal: {
      count: createSignal(0)
    },
    handler: {
      increment() {
        this.signals.update("count", (count) => count + 1);
      }
    }
  });
  const runtime = app.start({ router: false });
  const AsyncContainer = defineAsyncContainerElement({
    app,
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  assert.equal(typeof AsyncContainer, "function");
  const container = document.createElement("async-container");
  container.innerHTML = `
    <button on:click="increment">+</button>
    <output signal:text="count"></output>
  `;
  document.body.append(container);

  await delay(0);
  container.connectedCallback();
  assert.equal(runtime.inspectRoots().count, 1);
  document.querySelector("button").click();
  await delay(0);
  assert.equal(document.querySelector("output").textContent, "1");

  container.connectedCallback();
  document.querySelector("button").click();
  await delay(0);
  assert.equal(document.querySelector("output").textContent, "2");

  runtime.destroy();
});

test("async-container can disconnect and reconnect the same element with live bindings", async () => {
  const window = new Window();
  const { document } = window;
  const app = defineApp({
    signal: {
      count: createSignal(0)
    },
    handler: {
      increment() {
        this.signals.update("count", (count) => count + 1);
      }
    }
  });
  const runtime = app.start({ router: false });
  defineAsyncContainerElement({
    app,
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  const container = document.createElement("async-container");
  container.innerHTML = `
    <button on:click="increment">+</button>
    <output signal:text="count"></output>
  `;
  document.body.append(container);

  await delay(0);
  container.disconnectedCallback();
  container.connectedCallback();
  document.querySelector("button").click();
  await delay(0);
  assert.equal(document.querySelector("output").textContent, "1");

  runtime.signals.set("count", 4);
  container.disconnectedCallback();
  assert.equal(runtime.inspectRoots().count, 0);

  container.connectedCallback();
  runtime.signals.set("count", 5);
  await delay(0);
  assert.equal(runtime.inspectRoots().count, 1);
  assert.equal(document.querySelector("output").textContent, "5");

  document.querySelector("button").click();
  await delay(0);
  assert.equal(document.querySelector("output").textContent, "6");

  runtime.destroy();
});

test("lazy registry resolves compact descriptor URLs and infers exports", async () => {
  const imported = [];
  const lazy = createLazyRegistry({
    importModule(url) {
      imported.push(url);
      return {
        ProductCard: "component",
        add: "handler",
        load: "async"
      };
    }
  });

  assert.equal(await lazy.resolve("component", "ProductCard", { url: "ProductCard.js" }), "component");
  assert.equal(await lazy.resolve("handler", "cart.add", { url: "cart.add.js" }), "handler");
  assert.equal(await lazy.resolve("asyncSignal", "product.load", { url: "product.load.js" }), "async");
  assert.deepEqual(imported, [
    "/_async/component/ProductCard.js",
    "/_async/handler/cart.add.js",
    "/_async/asyncSignal/product.load.js"
  ]);
});

test("lazy registry retries failed imports with stable errors", async () => {
  let attempts = 0;
  const lazy = createLazyRegistry({
    importModule() {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("network offline");
      }
      return {
        save() {
          return "saved";
        }
      };
    }
  });
  const descriptor = { url: "cart.save.js" };

  await assert.rejects(
    lazy.resolve("handler", "cart.save", descriptor),
    /Lazy handler "cart\.save" failed to import \/_async\/handler\/cart\.save\.js: network offline/
  );

  const save = await lazy.resolve("handler", "cart.save", descriptor);

  assert.equal(attempts, 2);
  assert.equal(save(), "saved");
});

test("lazy registry reports missing exports with inferred names", async () => {
  const lazy = createLazyRegistry({
    importModule() {
      return {
        other() {
          return "wrong";
        }
      };
    }
  });

  await assert.rejects(
    lazy.resolve("handler", "cart.remove", { url: "cart.add.js" }),
    /Lazy handler "cart\.remove" did not export "remove", "cart\.add", "default"/
  );
});

test("runtime applies streamed descriptors and lazy handlers on first event", async () => {
  const window = new Window();
  const { document } = window;
  const imports = [];
  document.body.innerHTML = `
    <button on:click="cart.add">Add</button>
    <output signal:text="cartCount"></output>
  `;
  const app = defineApp({
    signal: {
      cartCount: createSignal(0)
    }
  });
  const runtime = createApp(app, {
    root: document.body,
    router: false,
    importModule(url) {
      imports.push(url);
      return {
        add() {
          this.signals.update("cartCount", (count) => count + 1);
        }
      };
    }
  }).start();

  runtime.applySnapshot(defineRegistrySnapshot({
    handler: {
      "cart.add": { url: "cart.add.js" }
    }
  }));

  document.querySelector("button").click();
  await delay(0);

  assert.deepEqual(imports, ["/_async/handler/cart.add.js"]);
  assert.equal(document.querySelector("output").textContent, "1");
  runtime.destroy();
});

test("lazy async signal descriptors materialize on ref access", async () => {
  const imports = [];
  const runtime = createApp(defineApp(), {
    router: false,
    importModule(url) {
      imports.push(url);
      return {
        load() {
          return { title: "Keyboard" };
        }
      };
    },
    snapshot: {
      asyncSignal: {
        "product.load": { url: "product.load.js" }
      }
    }
  }).start();

  const product = runtime.signals.ref("product.load");
  await product.refresh();

  assert.deepEqual(imports, ["/_async/asyncSignal/product.load.js"]);
  assert.deepEqual(product.value, { title: "Keyboard" });
  runtime.destroy();
});

test("conflicting streamed descriptors fail in strict mode", () => {
  const runtime = createApp(defineApp(), { router: false }).start();
  runtime.applySnapshot({
    handler: {
      save: { url: "save.js" }
    }
  });

  assert.doesNotThrow(() => runtime.applySnapshot({
    handler: {
      save: { url: "save.js" }
    }
  }));
  assert.throws(
    () => runtime.applySnapshot({
      handler: {
        save: { url: "other-save.js" }
      }
    }),
    /handler "save" is already registered with a different value/
  );

  runtime.destroy();
});

test("async-suspense custom element can be defined independently", () => {
  const window = new Window();
  const AsyncSuspense = defineAsyncSuspenseElement({
    customElements: window.customElements,
    HTMLElement: window.HTMLElement
  });

  assert.equal(typeof AsyncSuspense, "function");
  assert.equal(window.customElements.get("async-suspense"), AsyncSuspense);
});

test("app runtime starts a CSR router from registered routes and partials", async () => {
  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;
  const app = defineApp({
    partial: {
      "csrApp.product"({ id }) {
        return `<h1 id="csr-product">${id}</h1>`;
      }
    },
    route: {
      "/products/:id": defineRoute("csrApp.product")
    }
  });

  const runtime = createApp(app, {
    root: document.body,
    mode: "csr",
    boundary: "route"
  }).start();

  assert.equal(runtime.signals.get("router.pending"), true);
  await delay(0);

  assert.equal(document.querySelector("#csr-product").textContent, "sku-1");
  assert.equal(runtime.signals.get("router.pending"), false);
  assert.deepEqual(runtime.signals.get("router.params"), { id: "sku-1" });

  runtime.destroy();
});
