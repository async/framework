import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Async,
  createApp,
  createCacheRegistry,
  createHandlerRegistry,
  createPartialRegistry,
  createRegistryStore,
  createRouteRegistry,
  createServerRegistry,
  createSignal,
  createSignalRegistry,
  defineApp,
  defineCache,
  defineRoute,
  delay
} from "../src/index.js";

test("Async.registry exists before startup and reflects Async.use", () => {
  const id = `globalRegistry${Date.now()}${Math.floor(Math.random() * 100000)}`;

  Async.use({
    signal: {
      [id]: createSignal("ready")
    },
    server: {
      [`${id}.server`]() {
        return "server";
      }
    }
  });

  assert.equal(Async.registry.has("signal", id), true);
  assert.equal(Async.registry.get("signal", id).value, "ready");
  assert.deepEqual(Async.registry.get("server", `${id}.server`), {
    id: `${id}.server`
  });
});

test("app registry snapshot serializes declarations without executable values", () => {
  const app = defineApp({
    signal: {
      count: createSignal(1)
    },
    handler: {
      increment() {}
    },
    server: {
      "cart.add"() {}
    },
    partial: {
      home() {
        return "<h1>Home</h1>";
      }
    },
    route: {
      "/": defineRoute("home")
    },
    cache: {
      browser: {
        product: defineCache({ ttl: 10 })
      },
      server: {
        secret: defineCache({ ttl: 10 })
      }
    }
  });

  assert.deepEqual(app.registry.snapshot().signal, { count: 1 });
  assert.deepEqual(app.registry.snapshot().handler.increment, { id: "increment" });
  assert.deepEqual(app.registry.snapshot().server["cart.add"], { id: "cart.add" });
  assert.deepEqual(app.registry.snapshot().route["/"], { partial: "home" });
  assert.equal(typeof app.snapshot().handler.increment, "function");
});

test("runtime registry backs concrete registries and late app.use patches the shared store", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<button on:click="lateRegistry"></button>`;
  const app = defineApp({
    signal: {
      status: createSignal("idle")
    }
  });
  const runtime = createApp(app, { root: document.body, router: false }).start();

  assert.equal(runtime.registry, runtime.signals.registry);
  assert.equal(runtime.registry, runtime.handlers.registry);
  assert.equal(runtime.registry, runtime.browser.cache.registry);

  app.use({
    handler: {
      lateRegistry() {
        this.signals.set("status", "done");
      }
    },
    cache: {
      browser: {
        ui: defineCache({ ttl: 10 })
      }
    }
  });

  document.querySelector("button").click();
  await delay(0);

  assert.equal(runtime.registry.has("handler", "lateRegistry"), true);
  assert.equal(runtime.signals.get("status"), "done");
  assert.deepEqual(runtime.browser.cache.registry.get("cache.browser", "ui"), defineCache({ ttl: 10 }));
  runtime.destroy();
});

test("browser runtime inspection exposes server ids without server functions or server cache contents", () => {
  const app = defineApp({
    server: {
      "products.get"() {
        return { id: "sku-1" };
      }
    },
    cache: {
      server: {
        product: defineCache({ ttl: 10 })
      }
    }
  });
  const runtime = createApp(app, { root: new Window().document.body, router: false }).start();

  runtime.server.cache.set("product:sku-1", { title: "Secret" });

  assert.deepEqual(runtime.registry.keys("server"), ["products.get"]);
  assert.deepEqual(runtime.registry.get("server", "products.get"), {
    id: "products.get"
  });
  assert.equal(typeof runtime.server.resolve("products.get"), "function");
  assert.deepEqual(runtime.registry.keys("cache.server.entries"), []);
  assert.deepEqual(runtime.registry.entries("cache.server.entries"), []);
  assert.equal(runtime.registry.get("cache.server.entries", "product:sku-1"), undefined);
  assert.deepEqual(runtime.registry.snapshot().entries.server, {});
  runtime.destroy();
});

test("server runtime inspection can access server functions while render snapshots exclude server cache", async () => {
  const app = defineApp({
    signal: {
      productId: createSignal(null)
    },
    server: {
      "products.get"(id) {
        this.cache.set(`product:${id}`, { id, title: "Keyboard" });
        return this.cache.get(`product:${id}`);
      }
    },
    partial: {
      async "product.page"({ id }) {
        const product = await this.server.products.get(id);
        return {
          html: `<h1>${product.title}</h1>`,
          signals: {
            productId: id
          }
        };
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    },
    cache: {
      server: {
        product: defineCache({ ttl: 10 })
      }
    }
  });
  const runtime = createApp(app, { target: "server" });
  const response = await runtime.render("/products/sku-1");

  assert.equal(typeof runtime.registry.get("server", "products.get"), "function");
  assert.equal(runtime.registry.snapshot().entries.server["product:sku-1"].title, "Keyboard");
  assert.equal(response.cache.server, undefined);
  assert.equal(response.signals.productId, "sku-1");
  runtime.destroy();
});

test("standalone registries expose shared inspection helpers", () => {
  const registry = createRegistryStore();
  const signals = createSignalRegistry({ count: createSignal(0) }, { registry });
  const handlers = createHandlerRegistry({ increment() {} }, { registry });
  const server = createServerRegistry({ "cart.add"() {} }, { registry });
  const partials = createPartialRegistry({ home() {} }, { registry });
  const routes = createRouteRegistry({ "/": defineRoute("home") }, { registry });
  const cache = createCacheRegistry({ product: defineCache() }, { registry });

  assert.equal(signals.registry, registry);
  assert.deepEqual(signals.keys(), ["count"]);
  assert.equal(handlers.keys().includes("increment"), true);
  assert.deepEqual(server.keys(), ["cart.add"]);
  assert.deepEqual(partials.keys(), ["home"]);
  assert.deepEqual(routes.keys(), ["/"]);
  assert.deepEqual(cache.keys(), ["product"]);
  assert.equal(signals.inspect()[0][0], "count");
  assert.equal(signals.inspect()[0][1].value, 0);
});
