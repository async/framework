import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Async,
  asyncSystem,
  component,
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
  flow,
  html,
  readSnapshot,
  route,
  signal
} from "../src/index.js";

const system = Async.system;

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

test("Async singleton hides runtime behind inspectRuntime diagnostics", async () => {
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
  assert.equal(Async.runtime, undefined);
  assert.equal(Async._runtime, runtime);
  assert.equal(Object.keys(Async).includes("_runtime"), false);
  assert.deepEqual(
    {
      active: Async.inspectRuntime().active,
      started: Async.inspectRuntime().started,
      destroyed: Async.inspectRuntime().destroyed,
      target: Async.inspectRuntime().target,
      roots: Async.inspectRuntime().roots.count,
      loader: Async.inspectRuntime().loader.ready,
      router: Async.inspectRuntime().router
    },
    {
      active: true,
      started: true,
      destroyed: false,
      target: "browser",
      roots: 1,
      loader: true,
      router: false
    }
  );
  runtime.destroy();
  assert.equal(Async.inspectRuntime().active, false);
  assert.equal(Async.inspectRuntime().roots.count, 0);
});

test("Async.loader queues swaps until the singleton runtime has a loader", async () => {
  const window = new Window();
  const { document } = window;
  const signalId = `queuedStatus${Date.now()}`;
  const handlerId = `queuedClick${Date.now()}`;
  document.body.innerHTML = `<main async:boundary="route"></main>`;

  Async.use({
    signal: {
      [signalId]: createSignal("idle")
    },
    handler: {
      [handlerId]() {
        this.signals.set(signalId, "clicked");
      }
    }
  });

  const ready = Async.loader.ready();
  const swap = Async.loader.swap("route", `
    <button type="button" on:click="${handlerId}">Run</button>
    <output signal:text="${signalId}"></output>
  `);

  assert.equal(swap instanceof Promise, true);
  assert.deepEqual(Async.loader.inspect(), {
    ready: false,
    pending: 1,
    root: undefined
  });

  const runtime = Async.start({ root: document.body, router: false });
  const loader = await ready;
  const boundary = await swap;

  assert.equal(loader, runtime.loader);
  assert.equal(Async.loader.current, runtime.loader);
  assert.equal(Async.loader.inspect().ready, true);
  assert.equal(Async.loader.inspect().pending, 0);
  assert.equal(boundary.getAttribute("async:boundary"), "route");
  assert.equal(document.querySelector("output").textContent, "idle");

  document.querySelector("button").click();
  await delay(0);

  assert.equal(document.querySelector("output").textContent, "clicked");
  runtime.destroy();
});

test("Async.loader.swap resolves after frame commit, inserted bindings, and post flush", async () => {
  const window = new Window();
  const { document } = window;
  const frames = [];
  const scheduler = createScheduler({
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    }
  });
  const app = defineApp({
    signal: {
      status: createSignal("ready")
    },
    handler: {
      attach({ element }) {
        element.dataset.attached = this.signals.get("status");
      }
    }
  });
  document.body.innerHTML = `<main async:boundary="route"></main>`;
  const runtime = app.start({ root: document.body, router: false, scheduler });

  let resolved = false;
  const swap = app.loader.swap(
    "route",
    `<output id="status" signal:text="status" on:attach="attach"></output>`
  );
  swap.then(() => {
    resolved = true;
  });

  await delay(0);
  assert.equal(document.querySelector("#status"), null);
  assert.equal(resolved, false);
  assert.equal(frames.length, 1);

  frames.shift()(16);
  const boundary = await swap;

  assert.equal(boundary.getAttribute("async:boundary"), "route");
  assert.equal(document.querySelector("#status").textContent, "ready");
  assert.equal(document.querySelector("#status").dataset.attached, "ready");
  assert.equal(resolved, true);
  runtime.destroy();
});

test("Async.loader.swap uses synchronous fallback when animation frames are unavailable", async () => {
  const window = new Window();
  const { document } = window;
  const app = defineApp();
  document.body.innerHTML = `<main async:boundary="route"></main>`;
  const runtime = app.start({ root: document.body, router: false });

  const swap = app.loader.swap("route", `<p id="sync-swap">Ready</p>`);

  assert.equal(document.querySelector("#sync-swap").textContent, "Ready");
  await swap;
  runtime.destroy();
});

test("Async.loader.swap serializes frame commits for the same boundary", async () => {
  const window = new Window();
  const { document } = window;
  const frames = [];
  const scheduler = createScheduler({
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    }
  });
  const app = defineApp();
  document.body.innerHTML = `<main async:boundary="route"></main>`;
  const runtime = app.start({ root: document.body, router: false, scheduler });

  const first = app.loader.swap("route", `<p id="first">First</p>`);
  const second = app.loader.swap("route", `<p id="second">Second</p>`);

  await delay(0);
  assert.equal(frames.length, 1);
  assert.equal(document.querySelector("#first"), null);
  assert.equal(document.querySelector("#second"), null);

  frames.shift()(16);
  await first;
  assert.equal(document.querySelector("#first").textContent, "First");
  assert.equal(document.querySelector("#second"), null);

  await delay(0);
  assert.equal(frames.length, 1);
  frames.shift()(32);
  await second;

  assert.equal(document.querySelector("#first"), null);
  assert.equal(document.querySelector("#second").textContent, "Second");
  runtime.destroy();
});

test("Async.router queues navigation until the singleton runtime has a router", async () => {
  const base = `/queued-router-${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const partialId = `queuedRouter.product.${Date.now()}`;
  const window = new Window({ url: `http://app.test${base}/initial` });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  Async.use({
    partial: {
      [partialId]({ id }) {
        return `<h1 id="queued-router-product">${id}</h1>`;
      }
    },
    route: {
      [`${base}/:id`]: defineRoute(partialId)
    }
  });

  const ready = Async.router.ready();
  const navigation = Async.router.navigate(`${base}/sku-1`);
  const shellSwap = Async.router.loader.swap("route", `<p id="queued-router-shell">Queued shell</p>`);

  assert.equal(navigation instanceof Promise, true);
  assert.equal(shellSwap instanceof Promise, true);
  assert.deepEqual(Async.router.inspect(), {
    ready: false,
    pending: 1,
    mode: undefined,
    urlMode: undefined
  });
  assert.deepEqual(Async.router.loader.inspect(), {
    ready: false,
    pending: 1,
    root: undefined
  });
  assert.equal(Async.router.match(`${base}/sku-1`), null);

  const runtime = Async.start({
    root: document.body,
    mode: "csr",
    boundary: "route"
  });
  const router = await ready;
  await shellSwap;
  await navigation;
  await delay(0);

  assert.equal(router, runtime.router);
  assert.equal(Async.router.current, runtime.router);
  assert.equal(Async.router.loader.current, runtime.router.loader);
  assert.equal(Async.router.inspect().ready, true);
  assert.equal(Async.router.inspect().pending, 0);
  assert.equal(Async.router.loader.inspect().ready, true);
  assert.equal(Async.router.loader.inspect().pending, 0);
  assert.equal(Async.router.match(`${base}/sku-2`).route.partial, partialId);
  assert.equal(document.querySelector("#queued-router-product").textContent, "sku-1");
  assert.deepEqual(runtime.signals.get("router.params"), { id: "sku-1" });

  runtime.destroy();
  assert.equal(Async.router.current, undefined);
});

test("app loader queued failures reject without blocking later loader work", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main async:boundary="route"></main>`;
  const app = defineApp();

  const missing = app.loader.swap("missing", `<p>Missing</p>`);
  const ok = app.loader.swap("route", `<p id="ok">OK</p>`);

  const runtime = app.start({ root: document.body, router: false });

  await assert.rejects(missing, /Boundary "missing" was not found/);
  assert.equal((await ok).id, "");
  assert.equal(document.querySelector("#ok").textContent, "OK");
  assert.equal(app.loader.current, runtime.loader);
  assert.equal(app.loader.inspect().pending, 0);
  runtime.destroy();
});

test("app loader queues mount and scan until a rootless runtime attaches", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main id="app"></main>
    <output id="late" signal:text="status"></output>
  `;
  const app = defineApp({
    signal: {
      status: createSignal("ready")
    }
  });
  const Widget = component(function Widget() {
    return html`<button type="button" signal:text="status"></button>`;
  });

  assert.equal(app.inspectRuntime().active, false);
  assert.equal(app.inspectRuntime().loader.ready, false);

  const runtime = app.start({ router: false });
  const mounted = app.loader.mount(document.querySelector("#app"), Widget);
  const scanned = app.loader.scan(document.querySelector("#late"));

  assert.equal(app.inspectRuntime().active, true);
  assert.equal(app.inspectRuntime().roots.count, 0);
  assert.equal(app.loader.inspect().ready, false);
  assert.equal(app.loader.inspect().pending, 2);
  assert.equal(document.querySelector("#app").textContent.trim(), "");
  assert.equal(document.querySelector("#late").textContent, "");

  runtime.attachRoot(document.body);
  await mounted;
  await scanned;

  assert.equal(app.inspectRuntime().roots.count, 1);
  assert.equal(document.querySelector("#app button").textContent, "ready");
  assert.equal(document.querySelector("#late").textContent, "ready");
  assert.equal(app.loader.inspect().ready, true);
  assert.equal(app.loader.inspect().pending, 0);
  runtime.destroy();
});

test("app duplicate ids warn by default and strict declaration policy can fail", () => {
  const app = defineApp({
    signal: {
      count: createSignal(0)
    }
  });

  const warnings = captureWarnings(() => {
    app.use("signal", { count: createSignal(1) });
  });

  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /signal "count" is already declared/);
  assert.equal(app.registry.get("signal", "count").value, 0);

  const strict = defineApp({
    signal: {
      count: createSignal(0)
    }
  });
  strict.configure({ duplicates: { declarations: "strict" } });

  assert.throws(
    () => strict.use("signal", { count: createSignal(1) }),
    /signal "count" is already declared/
  );
});

test("Async.use declarations can be registered before their convention", () => {
  const app = defineApp();
  const owner = system.for("test.views");
  const materialized = [];

  app.use({
    declarations: {
      view: {
        home: { title: "Home" }
      }
    }
  });

  assert.equal(app.registry.resolve("view", "home"), undefined);
  assert.deepEqual(app.declarations.inspect().declarations.view[0], {
    id: "home",
    owner: undefined,
    policy: undefined,
    materialized: []
  });

  app.use({
    conventions: {
      view: {
        owner,
        policy: "on-register",
        materialize(declaration) {
          materialized.push(`${declaration.owner.id}:${declaration.id}`);
          return declaration.value.title;
        }
      }
    }
  });

  assert.deepEqual(materialized, ["test.views:home"]);
  assert.equal(app.registry.resolve("view", "home"), "Home");
  assert.deepEqual(app.declarations.inspect().conventions.view, {
    owner: "test.views",
    policy: "on-register"
  });
});

test("Async.use supports on-start declaration conventions", () => {
  const app = defineApp({
    declarations: {
      startup: {
        boot: "ready"
      }
    },
    conventions: {
      startup: {
        owner: system.for("test.startup"),
        policy: "on-start",
        materialize(declaration, context) {
          return `${context.runtime.target}:${declaration.id}:${declaration.value}`;
        }
      }
    }
  });

  assert.equal(app.registry.resolve("startup", "boot"), undefined);

  const runtime = createApp(app, { target: "server" }).start();

  assert.equal(runtime.registry.resolve("startup", "boot"), "server:boot:ready");
  runtime.destroy();
});

test("registry.resolve materializes on-demand declarations once", () => {
  const app = defineApp();
  let resolves = 0;

  app.use({
    conventions: {
      template: {
        owner: system.for("test.templates"),
        policy: "on-demand",
        materialize(declaration) {
          resolves += 1;
          return `<h1>${declaration.value.title}</h1>`;
        }
      }
    },
    declarations: {
      template: {
        card: { title: "Card" }
      }
    }
  });

  assert.equal(resolves, 0);
  assert.equal(app.registry.resolve("template", "card"), "<h1>Card</h1>");
  assert.equal(app.registry.resolve("template", "card"), "<h1>Card</h1>");
  assert.equal(resolves, 1);
});

test("module system identities prevent duplicate installs", () => {
  const app = defineApp();
  const owner = system.for("test.module");
  let installs = 0;

  const warnings = captureWarnings(() => {
    app.use({
      modules: {
        first: {
          owner,
          install() {
            installs += 1;
          }
        }
      }
    });
    app.use({
      modules: {
        second: {
          owner: system.for("test.module"),
          install() {
            installs += 1;
          }
        }
      }
    });
  });

  assert.equal(system.for("test.module"), owner);
  assert.equal(asyncSystem.for("test.module"), owner);
  assert.equal(installs, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Module "second" is already installed/);
  assert.deepEqual(app.declarations.modules(), [
    {
      id: "first",
      owner: "test.module"
    }
  ]);
});

test("resolver duplicates are strict by default", () => {
  const app = defineApp({
    conventions: {
      template: {
        owner: system.for("test.templates"),
        policy: "on-demand"
      }
    }
  });

  assert.throws(
    () => app.use({
      conventions: {
        template: {
          owner: system.for("test.templates"),
          policy: "on-demand"
        }
      }
    }),
    /Convention for "template" is already registered/
  );
});

test("server runtimes isolate signal state and destroy does not mutate app declarations", () => {
  const app = defineApp({
    signal: {
      count: createSignal(0)
    }
  });
  const first = createApp(app, { target: "server" }).start();
  const second = createApp(app, { target: "server" }).start();

  first.signals.set("count", 41);

  assert.equal(first.signals.get("count"), 41);
  assert.equal(second.signals.get("count"), 0);
  assert.equal(app.registry.get("signal", "count").value, 0);

  first.destroy();

  assert.equal(second.signals.get("count"), 0);
  assert.equal(app.registry.has("signal", "count"), true);

  const third = createApp(app, { target: "server" }).start();
  assert.equal(third.signals.get("count"), 0);

  second.destroy();
  third.destroy();
});

test("late app.use signal declarations materialize independently in live runtimes", () => {
  const app = defineApp();
  const first = createApp(app, { target: "server" }).start();
  const second = createApp(app, { target: "server" }).start();

  app.use("signal", {
    late: createSignal("initial")
  });

  assert.equal(first.signals.get("late"), "initial");
  assert.equal(second.signals.get("late"), "initial");

  first.signals.set("late", "first");

  assert.equal(first.signals.get("late"), "first");
  assert.equal(second.signals.get("late"), "initial");
  assert.equal(app.registry.get("signal", "late").value, "initial");

  first.destroy();
  second.destroy();
});

test("runtime cache entries are per runtime while declarations remain reusable", () => {
  const app = defineApp({
    cache: {
      browser: {
        product: defineCache({ ttl: 1000 })
      },
      server: {
        secret: defineCache({ ttl: 1000 })
      }
    }
  });
  const first = createApp(app, { target: "server" }).start();
  const second = createApp(app, { target: "server" }).start();

  first.browser.cache.set("product:1", { title: "Keyboard" });
  first.server.cache.set("secret:1", "server-only");

  assert.deepEqual(first.browser.cache.get("product:1"), { title: "Keyboard" });
  assert.equal(second.browser.cache.get("product:1"), undefined);
  assert.equal(second.server.cache.get("secret:1"), undefined);
  assert.deepEqual(second.browser.cache.resolve("product"), defineCache({ ttl: 1000 }));
  assert.deepEqual(second.server.cache.resolve("secret"), defineCache({ ttl: 1000 }));
  assert.deepEqual(app.registry.snapshot().entries.browser, {});

  first.destroy();

  assert.equal(second.browser.cache.get("product:1"), undefined);
  assert.deepEqual(app.registry.snapshot().cache.browser.product, defineCache({ ttl: 1000 }));

  second.destroy();
});

test("server render cycles are repeatable after runtime destroy", async () => {
  const app = defineApp({
    signal: {
      productId: createSignal("idle")
    },
    partial: {
      "product.page"({ id }) {
        this.signals.set("productId", id);
        return `<h1>${id}</h1>`;
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    }
  });
  const first = createApp(app, { target: "server" });
  const firstResponse = await first.render("/products/sku-1");

  assert.equal(firstResponse.status, 200);
  assert.match(firstResponse.html, /sku-1/);
  assert.equal(first.signals.get("productId"), "sku-1");
  assert.equal(app.registry.get("signal", "productId").value, "idle");

  first.destroy();

  const second = createApp(app, { target: "server" });
  const secondResponse = await second.render("/products/sku-2");

  assert.equal(secondResponse.status, 200);
  assert.match(secondResponse.html, /sku-2/);
  assert.equal(second.signals.get("productId"), "sku-2");
  assert.equal(app.registry.get("signal", "productId").value, "idle");

  second.destroy();
});

test("destroying one runtime async signal does not dispose peer async signal state", async () => {
  const app = defineApp({
    signal: {
      productId: createSignal("sku-1")
    },
    asyncSignal: {
      product: async function () {
        return {
          id: this.signals.get("productId")
        };
      }
    }
  });
  const first = createApp(app, { target: "server" }).start();
  const second = createApp(app, { target: "server" }).start();

  first.signals.set("productId", "first");
  second.signals.set("productId", "second");

  await first.signals.ref("product").refresh();
  await second.signals.ref("product").refresh();

  assert.deepEqual(first.signals.get("product.$value"), { id: "first" });
  assert.deepEqual(second.signals.get("product.$value"), { id: "second" });

  let secondNotifications = 0;
  const unsubscribe = second.signals.subscribe("product.$value", () => {
    secondNotifications += 1;
  });

  first.destroy();

  assert.equal(secondNotifications, 0);
  assert.deepEqual(second.signals.get("product.$value"), { id: "second" });
  assert.equal(app.registry.has("asyncSignal", "product"), true);

  unsubscribe();
  second.destroy();
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
        return serverEnvelope({
          signals: {
            "commandCache.status": this.cache.get(`commandCache:${id}`)
          }
        });
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
        return serverEnvelope({
          html: `<h1>Keyboard</h1>`,
          signals: {
            productId: "sku-1"
          },
          cache: {
            browser: {
              "product:sku-1": { title: "Keyboard" }
            }
          }
        });
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

test("SSR signal patches update exact mounted Flow signal paths", async () => {
  const app = defineApp({
    flow: {
      cart: flow({
        store: {
          total: 0
        }
      })
    },
    partial: {
      "cart.page"() {
        return serverEnvelope({
          html: `<output signal:text="cart.total"></output>`,
          signals: {
            "cart.total": 7
          }
        });
      }
    },
    route: {
      "/cart": defineRoute("cart.page")
    }
  });
  const runtime = createApp(app, { target: "server" });
  const response = await runtime.render("/cart");

  assert.equal(response.signals["cart.total"], 7);
  assert.equal(Object.hasOwn(response.signals, "cart"), false);
  assert.equal(runtime.signals.get("cart.total"), 7);
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
        return serverEnvelope({
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
        });
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

test("browser runtime restores dotted plain and component-scoped signal snapshot IDs exactly", async () => {
  const window = new Window();
  const { document } = window;
  const scopedId = "component.ProductCard.1.signal.1";
  document.body.innerHTML = `
    <output id="product" signal:text="product.load"></output>
    <output id="scoped" signal:text="${scopedId}"></output>
  `;
  const app = defineApp({
    signal: {
      "product.load": createSignal("idle"),
      [scopedId]: createSignal("pending")
    }
  });

  const runtime = createApp(app, {
    root: document.body,
    snapshot: {
      signals: {
        "product.load": "restored",
        [scopedId]: "scoped-restored"
      }
    },
    router: false
  }).start();
  await delay(0);

  assert.equal(runtime.signals.get("product.load"), "restored");
  assert.equal(runtime.signals.get(scopedId), "scoped-restored");
  assert.equal(runtime.signals.has("product"), false);
  assert.equal(runtime.signals.has("component"), false);
  assert.equal(document.querySelector("#product").textContent, "restored");
  assert.equal(document.querySelector("#scoped").textContent, "scoped-restored");
  runtime.destroy();
});

test("SSR round-trip restores dotted plain signal snapshot IDs exactly", async () => {
  const app = defineApp({
    signal: {
      "product.load": createSignal("server-ready")
    },
    partial: {
      "product.page"() {
        return html`<output id="product" signal:text="product.load"></output>`;
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    }
  });
  const serverRuntime = createApp(app, { target: "server" });
  const response = await serverRuntime.render("/products/sku-1");
  serverRuntime.destroy();

  assert.equal(response.signals["product.load"], "server-ready");

  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = response.html;

  const runtime = createApp(app, {
    root: document.body,
    router: false
  }).start();
  await delay(0);

  assert.equal(runtime.signals.get("product.load"), "server-ready");
  assert.equal(runtime.signals.has("product"), false);
  assert.equal(document.querySelector("#product").textContent, "server-ready");
  runtime.destroy();
});

test("browser runtime restores dotted async signal snapshot after adopting descriptor", async () => {
  let loads = 0;
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <output id="title" signal:text="product.load.$value.title"></output>
    <output id="status" signal:text="product.load.$status"></output>
  `;
  const app = defineApp();

  const runtime = createApp(app, {
    root: document.body,
    snapshot: {
      signals: {
        "product.load": {
          value: { title: "SSR Keyboard" },
          loading: false,
          error: null,
          status: "ready",
          version: 7
        }
      },
      asyncSignal: {
        "product.load": async () => {
          loads += 1;
          return { title: "Client Keyboard" };
        }
      }
    },
    router: false
  }).start();
  await delay(0);

  assert.equal(loads, 0);
  assert.deepEqual(runtime.signals.get("product.load.$value"), { title: "SSR Keyboard" });
  assert.equal(runtime.signals.get("product.load.$status"), "ready");
  assert.equal(runtime.signals.get("product.load.$version"), 7);
  assert.equal(runtime.signals.has("product"), false);
  assert.equal(document.querySelector("#title").textContent, "SSR Keyboard");
  assert.equal(document.querySelector("#status").textContent, "ready");
  runtime.destroy();
});

test("SSR round-trip restores dotted async signal snapshots without immediate refresh", async () => {
  let loads = 0;
  const app = defineApp({
    asyncSignal: {
      "product.load": async function () {
        loads += 1;
        return { title: `Keyboard ${loads}` };
      }
    },
    partial: {
      async "product.page"() {
        const product = this.signals.ref("product.load");
        await product.refresh();
        return html`
          <output id="title" signal:text="product.load.$value.title"></output>
          <output id="status" signal:text="product.load.$status"></output>
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
  assert.equal(response.signals["product.load"].status, "ready");
  assert.deepEqual(response.signals["product.load"].value, { title: "Keyboard 1" });

  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = response.html;

  const runtime = createApp(app, {
    root: document.body,
    router: false
  }).start();
  await delay(0);

  assert.equal(loads, 1);
  assert.deepEqual(runtime.signals.get("product.load.$value"), { title: "Keyboard 1" });
  assert.equal(runtime.signals.get("product.load.$status"), "ready");
  assert.equal(runtime.signals.get("product.load.$version"), 1);
  assert.equal(runtime.signals.has("product"), false);
  assert.equal(document.querySelector("#title").textContent, "Keyboard 1");
  assert.equal(document.querySelector("#status").textContent, "ready");
  runtime.destroy();
});

test("SSR round-trip restores rejected async signal errors with readable bindings", async () => {
  let loads = 0;
  const app = defineApp({
    asyncSignal: {
      "product.load": async function () {
        loads += 1;
        const error = new Error("Product unavailable");
        error.code = "PRODUCT_UNAVAILABLE";
        error.secret = "do not serialize";
        throw error;
      }
    },
    partial: {
      async "product.page"() {
        const product = this.signals.ref("product.load");
        await product.refresh();
        return html`
          <output id="message" signal:text="product.load.$error.message"></output>
          <output id="code" signal:text="product.load.$error.code"></output>
          <output id="status" signal:text="product.load.$status"></output>
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
  assert.deepEqual(response.signals["product.load"], {
    value: null,
    loading: false,
    error: {
      name: "Error",
      message: "Product unavailable",
      code: "PRODUCT_UNAVAILABLE"
    },
    status: "error",
    version: 1
  });
  assert.equal(Object.hasOwn(response.signals["product.load"].error, "secret"), false);

  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = response.html;

  const runtime = createApp(app, {
    root: document.body,
    router: false
  }).start();
  await delay(0);

  assert.equal(loads, 1);
  assert.equal(runtime.signals.get("product.load.$status"), "error");
  assert.equal(runtime.signals.get("product.load.$error.message"), "Product unavailable");
  assert.equal(runtime.signals.get("product.load.$error.code"), "PRODUCT_UNAVAILABLE");
  assert.equal(document.querySelector("#message").textContent, "Product unavailable");
  assert.equal(document.querySelector("#code").textContent, "PRODUCT_UNAVAILABLE");
  assert.equal(document.querySelector("#status").textContent, "error");
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

test("lazy async signal descriptors can unregister before materialization", () => {
  const runtime = createApp(defineApp(), {
    target: "server",
    snapshot: {
      asyncSignal: {
        "product.load": async () => ({ title: "Keyboard" })
      }
    }
  });

  assert.equal(runtime.signals.unregister("product.load"), true);
  assert.equal(runtime.signals.has("product.load"), false);
  const missing = runtime.signals.ref("product.load");
  assert.equal(runtime.signals.has("product.load"), false);
  assert.throws(() => missing.value, /Signal "product" is not registered/);
  runtime.destroy();
});

test("lazy async signal descriptors unregister after materialization and cannot rematerialize", async () => {
  const runtime = createApp(defineApp(), {
    target: "server",
    snapshot: {
      signals: {
        "product.load": {
          value: { title: "SSR Keyboard" },
          loading: false,
          error: null,
          status: "ready",
          version: 1
        }
      },
      asyncSignal: {
        "product.load": async () => ({ title: "Client Keyboard" })
      }
    }
  });

  assert.equal(runtime.signals.ref("product.load").status, "ready");
  assert.equal(runtime.signals.unregister("product.load"), true);
  assert.equal(runtime.signals.has("product.load"), false);
  const missing = runtime.signals.ref("product.load");
  assert.equal(runtime.signals.has("product.load"), false);
  assert.throws(() => missing.value, /Signal "product" is not registered/);
  runtime.destroy();
});

test("plain signals and lazy async descriptors cannot use the same id", () => {
  const descriptorFirst = createApp(defineApp(), {
    target: "server",
    snapshot: {
      asyncSignal: {
        product: async () => ({ title: "Keyboard" })
      }
    }
  });

  assert.throws(
    () => descriptorFirst.signals.register("product", createSignal("manual")),
    /Signal "product" is already registered/
  );
  descriptorFirst.destroy();

  const signalFirst = createApp(defineApp({
    signal: {
      product: createSignal("manual")
    }
  }), { target: "server" });

  assert.throws(
    () => signalFirst.applySnapshot({
      asyncSignal: {
        product: async () => ({ title: "Keyboard" })
      }
    }),
    /Signal "product" is already registered/
  );
  signalFirst.destroy();
});

test("destroying materialized async descriptors preserves app declarations", () => {
  const app = defineApp({
    asyncSignal: {
      product: async () => ({ title: "Keyboard" })
    }
  });
  const runtime = createApp(app, { target: "server" });

  assert.equal(runtime.signals.has("product"), true);
  runtime.signals.ref("product");
  runtime.destroy();

  assert.equal(Object.hasOwn(app.snapshot().asyncSignal, "product"), true);

  const next = createApp(app, { target: "server" });
  assert.equal(next.signals.has("product"), true);
  next.destroy();
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

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}

function captureWarnings(fn) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => {
    warnings.push(args.join(" "));
  };
  try {
    fn();
  } finally {
    console.warn = original;
  }
  return warnings;
}

test("SSR render with document: false returns the raw route fragment", async () => {
  const app = defineApp({
    partial: {
      "product.page"({ id }) {
        return html`<h1>Product ${id}</h1>`;
      }
    },
    route: {
      "/products/:id": defineRoute("product.page")
    }
  });
  const runtime = createApp(app, { target: "server" });
  const wrapped = await runtime.render("/products/sku-1");
  const raw = await runtime.render("/products/sku-1", { document: false });

  assert.match(wrapped.html, /async:boundary="route"/);
  assert.match(wrapped.html, /async:snapshot/);
  assert.equal(raw.status, 200);
  assert.doesNotMatch(raw.html, /async:boundary/);
  assert.doesNotMatch(raw.html, /async:snapshot/);
  assert.match(raw.html, /<h1>Product sku-1<\/h1>/);
  runtime.destroy();
});
