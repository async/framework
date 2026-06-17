import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Async,
  createApp,
  createSignal,
  defineApp,
  defineCache,
  defineRoute,
  delay,
  html,
  route,
  signal
} from "../src/index.js";

test("Async.use(type, entries) before start registers app runtime pieces", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <button on:click="increment">+</button>
    <output data-async-text="count"></output>
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
    <output data-async-text="ready"></output>
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
    <output data-async-text="status"></output>
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
  document.body.innerHTML = `<output data-async-text="${signalId}"></output>`;

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
    <output data-async-text="commandCache.status"></output>
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
  assert.match(response.html, /data-async-snapshot/);
  runtime.destroy();
});

test("browser runtime restores SSR signal and browser cache snapshots", () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<output data-async-text="productId"></output>`;
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

test("app runtime starts a CSR router from registered routes and partials", async () => {
  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section data-async-boundary="route"></section>`;
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
