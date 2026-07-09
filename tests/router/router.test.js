import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  createCacheRegistry,
  createHandlerRegistry,
  createRouter,
  createSignalRegistry,
  defineRoute,
  delay,
  html,
  route,
  signal
} from "../../src/index.js";
import { createPartialRegistry } from "../../src/partials.js";
import { createRouteRegistry } from "../../src/router.js";

test("CSR router renders the current route partial into an empty boundary on start", async () => {
  const window = new Window({ url: "http://app.test/products/sku-1?ref=nav" });
  const { document } = window;
  document.body.innerHTML = `
    <main async:container>
      <nav>
        <a href="/">Home</a>
        <a href="/products/sku-1">Product</a>
      </nav>
      <section async:boundary="route"></section>
    </main>
  `;

  const signals = createSignalRegistry({
    selected: signal(false),
    loaded: signal(false)
  });
  const handlers = createHandlerRegistry({
    selectProduct() {
      this.signals.set("selected", true);
    }
  });
  const cache = createCacheRegistry();
  const productRoute = route("product.page");
  const partials = createPartialRegistry({
    "product.page": function ({ id }) {
      return serverEnvelope({
        html: html`
          <article>
            <h1 id="product-title">${id}</h1>
            <button id="select" on:click="selectProduct" signal:class:selected="selected">
              Select
            </button>
          </article>
        `,
        signals: {
          loaded: true
        },
        cache: {
          browser: {
            [`product:${id}`]: { id }
          }
        }
      });
    }
  });
  const loader = Loader({ root: document.body, signals, handlers, cache }).start();
  const router = createRouter({
    mode: "csr",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": productRoute
    }),
    loader,
    handlers,
    cache,
    partials
  }).start();

  assert.equal(signals.get("router.pending"), true);
  assert.equal(signals.get("router.path"), "/products/sku-1");
  assert.deepEqual(signals.get("router.params"), { id: "sku-1" });
  assert.deepEqual(signals.get("router.query"), { ref: "nav" });
  assert.equal(signals.get("router.route"), productRoute);
  assert.equal(signals.get("router.error"), null);

  await delay(0);

  assert.equal(signals.get("router.pending"), false);
  assert.equal(signals.get("loaded"), true);
  assert.deepEqual(cache.get("product:sku-1"), { id: "sku-1" });
  assert.equal(document.querySelector("#product-title").textContent, "sku-1");

  document.querySelector("#select").click();
  await delay(0);
  assert.equal(document.querySelector("#select").classList.contains("selected"), true);

  router.destroy();
  loader.destroy();
});

test("CSR router records an error when no route matches", async () => {
  const window = new Window({ url: "http://app.test/missing" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "csr",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/": route("home")
    }),
    loader,
    partials: createPartialRegistry({
      home() {
        return "<h1>Home</h1>";
      }
    })
  }).start();

  await delay(0);

  assert.equal(signals.get("router.pending"), false);
  assert.equal(signals.get("router.path"), "/missing");
  assert.equal(signals.get("router.route"), null);
  assert.match(signals.get("router.error").message, /No route matched \/missing/);
  assert.equal(document.querySelector("[async\\:boundary='route']").innerHTML, "");

  router.destroy();
  loader.destroy();
});

test("CSR router supports wildcard fallback routes", async () => {
  const window = new Window({ url: "http://app.test/unknown" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const signals = createSignalRegistry();
  const notFoundRoute = route("notFound.page");
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "csr",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/": route("home.page"),
      "*": notFoundRoute
    }),
    loader,
    partials: createPartialRegistry({
      "notFound.page"() {
        return `<h1 id="not-found">Not found</h1>`;
      }
    })
  }).start();

  await delay(0);

  assert.equal(document.querySelector("#not-found").textContent, "Not found");
  assert.equal(signals.get("router.route"), notFoundRoute);
  assert.equal(signals.get("router.error"), null);

  router.destroy();
  loader.destroy();
});

test("route matching ranks static and dynamic routes before wildcard fallbacks", () => {
  const routes = createRouteRegistry({
    "*": route("notFound.page"),
    "/products/:id": route("product.page"),
    "/products/new": route("product.new")
  });

  assert.equal(routes.match("/products/new").route.partial, "product.new");
  assert.equal(routes.match("/products/sku-1").route.partial, "product.page");
  assert.equal(routes.match("/missing").route.partial, "notFound.page");
});

test("route registration rejects unsupported render metadata", () => {
  assert.throws(
    () => createRouteRegistry({
      "/broken": defineRoute("broken.page", { render: "sometimes" })
    }),
    /Unknown route render mode "sometimes"/
  );
});

test("router rejects direct signal registry injection", () => {
  const signals = createSignalRegistry();

  assert.throws(
    () => createRouter({ signals }),
    /createRouter\(\.\.\.\) does not accept a "signals" option/
  );
});

test("createRouter starts immediately and start remains idempotent", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <a id="next" href="/next">Next</a>
    <section async:boundary="route"><h1 id="route-title">Home</h1></section>
  `;

  let renders = 0;
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/next": route("next.page")
    }),
    partials: createPartialRegistry({
      "next.page"() {
        renders += 1;
        return `<h1 id="route-title">Next</h1>`;
      }
    })
  });

  assert.equal(router.signals.get("router.path"), "/");

  router.start();
  document.querySelector("#next").click();
  await delay(0);

  assert.equal(renders, 1);
  assert.equal(router.signals.get("router.path"), "/next");
  assert.equal(document.querySelector("#route-title").textContent, "Next");

  router.destroy();
});

test("signals router updates path state and history without rendering partials or swapping", async () => {
  const window = new Window({ url: "http://app.test/pbi" });
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <a id="fy26" href="/fy26/launch?tab=roadmap">FY26</a>
      <form id="search" action="/search">
        <input name="q" value="launch">
      </form>
      <section async:boundary="route"><h1 id="route-title">PBI shell</h1></section>
    </main>
  `;

  let partialCalls = 0;
  const fy26Route = defineRoute({
    partial: "dashboard.page",
    render: "none",
    meta: { page: "fy26" }
  });
  const router = createRouter({
    mode: "signals",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/pbi": defineRoute({ render: "none", meta: { page: "pbi" } }),
      "/fy26/:section": fy26Route,
      "/search": defineRoute({ render: "none", meta: { page: "search" } })
    }),
    partials: createPartialRegistry({
      "dashboard.page"() {
        partialCalls += 1;
        return `<h1>Rendered</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  assert.equal(router.mode, "signals");
  assert.equal(signals.get("router.path"), "/pbi");
  assert.equal(partialCalls, 0);

  const click = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#fy26").dispatchEvent(click);
  await delay(0);

  assert.equal(click.defaultPrevented, true);
  assert.equal(partialCalls, 0);
  assert.equal(signals.get("router.path"), "/fy26/launch");
  assert.deepEqual(signals.get("router.params"), { section: "launch" });
  assert.deepEqual(signals.get("router.query"), { tab: "roadmap" });
  assert.equal(signals.get("router.route"), fy26Route);
  assert.equal(signals.get("router.pending"), false);
  assert.equal(signals.get("router.error"), null);
  assert.equal(document.querySelector("#route-title").textContent, "PBI shell");
  assert.equal(window.location.href, "http://app.test/fy26/launch?tab=roadmap");

  window.history.back();
  window.dispatchEvent(new window.PopStateEvent("popstate"));
  await delay(0);

  assert.equal(signals.get("router.path"), "/pbi");
  assert.equal(partialCalls, 0);
  assert.equal(document.querySelector("#route-title").textContent, "PBI shell");

  const submit = new window.Event("submit", { bubbles: true, cancelable: true });
  document.querySelector("#search").dispatchEvent(submit);
  await delay(0);

  assert.equal(submit.defaultPrevented, true);
  assert.equal(signals.get("router.path"), "/search");
  assert.deepEqual(signals.get("router.query"), { q: "launch" });
  assert.equal(partialCalls, 0);

  router.destroy();
});

test("signals hash router intercepts hash routes and preserves section anchors", async () => {
  const window = new Window({ url: "http://app.test/framework/#/docs/start" });
  const { document } = window;
  document.body.innerHTML = `
    <a id="section" href="#quickstart">Quickstart</a>
    <a id="route" href="#/docs/router?tab=api">Router</a>
    <section async:boundary="route"><h1 id="route-title">Start</h1></section>
  `;

  let partialCalls = 0;
  const router = createRouter({
    mode: "signals",
    urlMode: "hash",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/docs/:page": defineRoute("docs.page", { render: "none" })
    }),
    partials: createPartialRegistry({
      "docs.page"() {
        partialCalls += 1;
        return `<h1>Rendered</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  const section = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#section").dispatchEvent(section);
  await delay(0);

  assert.equal(section.defaultPrevented, false);
  assert.equal(signals.get("router.path"), "/docs/start");
  assert.equal(document.querySelector("#route-title").textContent, "Start");

  const routeClick = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#route").dispatchEvent(routeClick);
  await delay(0);

  assert.equal(routeClick.defaultPrevented, true);
  assert.equal(partialCalls, 0);
  assert.equal(signals.get("router.path"), "/docs/router");
  assert.deepEqual(signals.get("router.query"), { tab: "api" });
  assert.equal(document.querySelector("#route-title").textContent, "Start");
  assert.equal(window.location.href, "http://app.test/framework/#/docs/router?tab=api");

  router.destroy();
});

test("signals router records no-route errors without touching the boundary", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Home</h1></section>`;

  const router = createRouter({
    mode: "signals",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/": defineRoute({ render: "none" })
    })
  }).start();
  const { signals } = router;

  const result = await router.navigate("/missing");

  assert.equal(result, null);
  assert.equal(signals.get("router.path"), "/missing");
  assert.equal(signals.get("router.route"), null);
  assert.equal(signals.get("router.pending"), false);
  assert.match(signals.get("router.error").message, /No route matched \/missing/);
  assert.equal(document.querySelector("#route-title").textContent, "Home");
  assert.equal(window.location.href, "http://app.test/");

  router.destroy();
});

test("SPA router skips duplicate navigation work for the active route snapshot", async () => {
  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">sku-1</h1></section>`;

  let renders = 0;
  const productRoute = route("product.page");
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": productRoute
    }),
    partials: createPartialRegistry({
      "product.page"({ id }) {
        renders += 1;
        return `<h1 id="route-title">${id}</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  const result = await router.navigate("/products/sku-1");

  assert.equal(result.route, productRoute);
  assert.equal(renders, 0);
  assert.equal(signals.get("router.path"), "/products/sku-1");
  assert.deepEqual(signals.get("router.params"), { id: "sku-1" });
  assert.equal(document.querySelector("#route-title").textContent, "sku-1");
  assert.equal(window.location.href, "http://app.test/products/sku-1");

  router.destroy();
});

test("SPA router uses signal fast path for same-view navigation and force refreshes the boundary", async () => {
  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">sku-1</h1></section>`;

  let renders = 0;
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": defineRoute("product.page", { viewKey: "product" })
    }),
    partials: createPartialRegistry({
      "product.page"({ id }) {
        renders += 1;
        return `<h1 id="route-title">${id}</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  await router.navigate("/products/sku-2?tab=details");

  assert.equal(renders, 0);
  assert.equal(signals.get("router.path"), "/products/sku-2");
  assert.deepEqual(signals.get("router.params"), { id: "sku-2" });
  assert.deepEqual(signals.get("router.query"), { tab: "details" });
  assert.equal(document.querySelector("#route-title").textContent, "sku-1");
  assert.equal(window.location.href, "http://app.test/products/sku-2?tab=details");

  await router.navigate("/products/sku-3", { force: true });

  assert.equal(renders, 1);
  assert.equal(signals.get("router.path"), "/products/sku-3");
  assert.deepEqual(signals.get("router.params"), { id: "sku-3" });
  assert.equal(document.querySelector("#route-title").textContent, "sku-3");
  assert.equal(window.location.href, "http://app.test/products/sku-3");

  router.destroy();
});

test("CSR router renders initial route and then uses same-view signal navigation", async () => {
  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  let renders = 0;
  const router = createRouter({
    mode: "csr",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": defineRoute("product.page", { viewKey: "product" })
    }),
    partials: createPartialRegistry({
      "product.page"({ id }) {
        renders += 1;
        return `<h1 id="route-title">${id}</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  await delay(0);

  assert.equal(renders, 1);
  assert.equal(document.querySelector("#route-title").textContent, "sku-1");

  await router.navigate("/products/sku-2");

  assert.equal(renders, 1);
  assert.equal(signals.get("router.path"), "/products/sku-2");
  assert.deepEqual(signals.get("router.params"), { id: "sku-2" });
  assert.equal(document.querySelector("#route-title").textContent, "sku-1");

  router.destroy();
});

test("SPA router swaps a route-level boundary override", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="route"><h1 id="route-title">Home</h1></section>
    <aside async:boundary="side"></aside>
  `;

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/side/:id": defineRoute("side.page", { boundary: "side" })
    }),
    partials: createPartialRegistry({
      "side.page"({ id }) {
        return `<h2 id="side-title">${id}</h2>`;
      }
    })
  }).start();

  await router.navigate("/side/panel");

  assert.equal(document.querySelector("#route-title").textContent, "Home");
  assert.equal(document.querySelector("#side-title").textContent, "panel");

  router.destroy();
});

test("SPA router aborts stale navigations and ignores late partial results", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const pending = new Map();
  const cache = createCacheRegistry();
  const partials = createPartialRegistry({
    "product.page": async function ({ id }) {
      const record = {
        id,
        abort: this.abort,
        resolve: undefined
      };
      pending.set(id, record);
      await new Promise((resolve) => {
        record.resolve = resolve;
      });
      return serverEnvelope({
        html: `<h1 id="route-title">${id}</h1>`,
        signals: {
          "routerTest.loaded": id
        },
        cache: {
          browser: {
            [`route:${id}`]: { id }
          }
        }
      });
    }
  });
  const signals = createSignalRegistry({
    routerTest: signal({})
  });
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": route("product.page")
    }),
    loader,
    cache,
    partials
  }).start();

  const slow = router.navigate("/products/slow");
  await delay(0);
  const slowRecord = pending.get("slow");

  const fast = router.navigate("/products/fast");
  await delay(0);
  const fastRecord = pending.get("fast");

  assert.equal(slowRecord.abort.aborted, true);
  assert.equal(fastRecord.abort.aborted, false);

  fastRecord.resolve();
  await fast;
  assert.equal(document.querySelector("#route-title").textContent, "fast");
  assert.equal(signals.get("routerTest.loaded"), "fast");
  assert.deepEqual(cache.get("route:fast"), { id: "fast" });
  assert.equal(signals.get("router.pending"), false);

  slowRecord.resolve();
  await slow;
  assert.equal(document.querySelector("#route-title").textContent, "fast");
  assert.equal(signals.get("routerTest.loaded"), "fast");
  assert.equal(cache.get("route:slow"), undefined);
  assert.equal(signals.get("router.path"), "/products/fast");

  router.destroy();
  loader.destroy();
});

test("SPA router ignores stale partial rejections after a newer navigation completes", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const pending = new Map();
  const partials = createPartialRegistry({
    "product.page": async function ({ id }) {
      const record = {};
      pending.set(id, record);
      await new Promise((resolve, reject) => {
        record.resolve = resolve;
        record.reject = reject;
      });
      return `<h1 id="route-title">${id}</h1>`;
    }
  });
  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": route("product.page")
    }),
    loader,
    partials
  }).start();

  const slow = router.navigate("/products/slow");
  await delay(0);
  const fast = router.navigate("/products/fast");
  await delay(0);

  pending.get("fast").resolve();
  await fast;

  pending.get("slow").reject(new Error("slow route failed late"));
  assert.equal(await slow, null);
  assert.equal(document.querySelector("#route-title").textContent, "fast");
  assert.equal(signals.get("router.path"), "/products/fast");
  assert.equal(signals.get("router.error"), null);

  router.destroy();
  loader.destroy();
});

test("SPA router swaps route boundaries and rescans inserted handlers", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <a id="product-link" href="/products/sku-1">Product</a>
      <section async:boundary="route"></section>
    </main>
  `;

  const signals = createSignalRegistry({
    selected: signal(false)
  });
  const handlers = createHandlerRegistry({
    select() {
      this.signals.set("selected", true);
    }
  });
  const partials = createPartialRegistry({
    "product.page": function ({ id }) {
      return html`
        <article>
          <button id="select" on:click="select" signal:class:selected="selected">
            ${id}
          </button>
        </article>
      `;
    }
  });
  const loader = Loader({ root: document.body, signals, handlers }).start();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": route("product.page")
    }),
    loader,
    handlers,
    partials
  }).start();

  document.querySelector("#product-link").click();
  await delay(0);

  assert.equal(signals.get("router.path"), "/products/sku-1");
  assert.deepEqual(signals.get("router.params"), { id: "sku-1" });
  assert.equal(document.querySelector("#select").textContent.trim(), "sku-1");

  document.querySelector("#select").click();
  await delay(0);
  assert.equal(document.querySelector("#select").classList.contains("selected"), true);

  router.destroy();
  loader.destroy();
});

test("SPA router warns and skips route swaps for undefined partial html", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Home</h1></section>`;

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    const router = createRouter({
      mode: "spa",
      root: document.body,
      boundary: "route",
      routes: createRouteRegistry({
        "/noop": route("noop")
      }),
      partials: createPartialRegistry({
        noop() {
          return { html: undefined };
        }
      })
    }).start();
    const { signals } = router;

    await router.navigate("/noop");
    await router.navigate("/noop");

    assert.deepEqual(warnings, [
      '[async/router] partial returned html: undefined; boundary "route" was not swapped.'
    ]);
    assert.equal(signals.get("router.path"), "/noop");
    assert.equal(signals.get("router.error"), null);
    assert.equal(document.querySelector("#route-title").textContent, "Home");

    router.destroy();
  } finally {
    console.warn = originalWarn;
  }
});

test("SPA router skips no-op partial result shapes without touching the boundary", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Home</h1></section>`;

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/status": route("status"),
      "/missing-html": route("missingHtml"),
      "/undefined": route("undefinedResult"),
      "/null": route("nullResult")
    }),
    partials: createPartialRegistry({
      status() {
        return { status: 204 };
      },
      missingHtml() {
        return {};
      },
      undefinedResult() {
        return undefined;
      },
      nullResult() {
        return null;
      }
    })
  }).start();

  for (const path of ["/status", "/missing-html", "/undefined", "/null"]) {
    await router.navigate(path);
    assert.equal(document.querySelector("#route-title").textContent, "Home");
  }

  router.destroy();
});

test("SPA router treats empty partial html as an explicit boundary clear", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Home</h1></section>`;

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/empty": route("empty")
    }),
    partials: createPartialRegistry({
      empty() {
        return { html: "" };
      }
    })
  }).start();

  await router.navigate("/empty");

  assert.equal(document.querySelector("[async\\:boundary='route']").innerHTML, "");
  router.destroy();
});

test("default SSR router starts from existing HTML without intercepting same-origin links", () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <section async:boundary="route"><h1 id="route-title">Home</h1></section>
      <a id="next" href="/next">Next</a>
    </main>
  `;

  const router = createRouter({
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/": route("home"),
      "/next": route("next")
    })
  }).start();

  const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#next").dispatchEvent(event);

  assert.equal(router.mode, "ssr");
  assert.equal(event.defaultPrevented, false);
  assert.equal(document.querySelector("#route-title").textContent, "Home");
  assert.equal(router.signals.get("router.path"), "/");

  router.destroy();
});

test("SPA router catches intercepted link navigation failures without corrupting the active boundary", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <a id="broken" href="/broken">Broken</a>
      <section async:boundary="route"><h1 id="route-title">Home</h1></section>
    </main>
  `;

  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/broken": route("broken")
    }),
    loader,
    partials: createPartialRegistry({
      broken() {
        throw new Error("broken route failed");
      }
    })
  }).start();

  let event;
  const unhandled = await collectUnhandledRejections(async () => {
    event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    document.querySelector("#broken").dispatchEvent(event);
    await delay(0);
  });

  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(unhandled, []);
  assert.equal(signals.get("router.path"), "/broken");
  assert.equal(signals.get("router.pending"), false);
  assert.match(signals.get("router.error").message, /broken route failed/);
  assert.equal(document.querySelector("#route-title").textContent, "Home");

  router.destroy();
  loader.destroy();
});

test("SPA router catches intercepted submit navigation failures", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <form id="search" action="/search">
      <input name="q" value="keyboards">
    </form>
    <section async:boundary="route"></section>
  `;

  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/search": route("search")
    }),
    loader,
    partials: createPartialRegistry({
      search() {
        throw new Error("search route failed");
      }
    })
  }).start();

  const submit = new window.Event("submit", { bubbles: true, cancelable: true });
  const unhandled = await collectUnhandledRejections(async () => {
    document.querySelector("#search").dispatchEvent(submit);
    await delay(0);
  });

  assert.equal(submit.defaultPrevented, true);
  assert.deepEqual(unhandled, []);
  assert.equal(signals.get("router.pending"), false);
  assert.match(signals.get("router.error").message, /search route failed/);

  router.destroy();
  loader.destroy();
});

test("SPA router catches popstate navigation failures", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/broken": route("broken")
    }),
    loader,
    partials: createPartialRegistry({
      broken() {
        throw new Error("popstate route failed");
      }
    })
  }).start();

  window.history.pushState({}, "", "/broken");
  const unhandled = await collectUnhandledRejections(async () => {
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await delay(0);
  });

  assert.deepEqual(unhandled, []);
  assert.equal(signals.get("router.path"), "/broken");
  assert.equal(signals.get("router.pending"), false);
  assert.match(signals.get("router.error").message, /popstate route failed/);

  router.destroy();
  loader.destroy();
});

test("SPA router ignores same-document hash links", async () => {
  const window = new Window({ url: "http://app.test/products?tab=info" });
  const { document } = window;
  document.body.innerHTML = `
    <a id="hash-only" href="#details">Details</a>
    <a id="same-path-hash" href="/products?tab=info#reviews">Reviews</a>
    <a id="next" href="/products?tab=specs#details">Specs</a>
    <section async:boundary="route"><h1>Product</h1></section>
  `;

  let renders = 0;
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products": route("product")
    }),
    partials: createPartialRegistry({
      product() {
        renders += 1;
        return "<h1>Updated</h1>";
      }
    })
  }).start();

  const hashOnly = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#hash-only").dispatchEvent(hashOnly);
  const samePathHash = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#same-path-hash").dispatchEvent(samePathHash);
  await delay(0);

  assert.equal(hashOnly.defaultPrevented, false);
  assert.equal(samePathHash.defaultPrevented, false);
  assert.equal(renders, 0);

  const next = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#next").dispatchEvent(next);
  await delay(0);

  assert.equal(next.defaultPrevented, true);
  assert.equal(renders, 1);

  router.destroy();
});

test("CSR hash router renders the current hash route into an empty boundary", async () => {
  const window = new Window({ url: "http://app.test/framework/#/docs/getting-started?ref=nav" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const docsRoute = route("docs.page");
  const router = createRouter({
    mode: "csr",
    urlMode: "hash",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/docs/:slug": docsRoute
    }),
    partials: createPartialRegistry({
      "docs.page"({ slug }) {
        return `<h1 id="route-title">${slug}</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  assert.equal(router.urlMode, "hash");
  assert.equal(signals.get("router.pending"), true);
  assert.equal(signals.get("router.path"), "/docs/getting-started");
  assert.deepEqual(signals.get("router.params"), { slug: "getting-started" });
  assert.deepEqual(signals.get("router.query"), { ref: "nav" });
  assert.equal(signals.get("router.route"), docsRoute);

  await delay(0);

  assert.equal(document.querySelector("#route-title").textContent, "getting-started");
  assert.equal(window.location.href, "http://app.test/framework/#/docs/getting-started?ref=nav");

  router.destroy();
});

test("SPA hash router intercepts hash routes and preserves section anchors", async () => {
  const window = new Window({ url: "http://app.test/framework/#/docs/start" });
  const { document } = window;
  document.body.innerHTML = `
    <a id="section" href="#quickstart">Quickstart</a>
    <a id="route" href="#/docs/router?tab=api">Router</a>
    <section async:boundary="route"><h1 id="route-title">Start</h1></section>
  `;

  const router = createRouter({
    mode: "spa",
    urlMode: "hash",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/docs/:page": route("docs.page")
    }),
    partials: createPartialRegistry({
      "docs.page"({ page }) {
        return `<h1 id="route-title">${page}</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  const section = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#section").dispatchEvent(section);
  await delay(0);

  assert.equal(section.defaultPrevented, false);
  assert.equal(document.querySelector("#route-title").textContent, "Start");

  const routeClick = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#route").dispatchEvent(routeClick);
  await delay(0);

  assert.equal(routeClick.defaultPrevented, true);
  assert.equal(document.querySelector("#route-title").textContent, "router");
  assert.equal(signals.get("router.path"), "/docs/router");
  assert.deepEqual(signals.get("router.query"), { tab: "api" });
  assert.equal(window.location.href, "http://app.test/framework/#/docs/router?tab=api");

  router.destroy();
});

test("SPA hash router navigate writes hash history for route paths", async () => {
  const window = new Window({ url: "http://app.test/framework/#/docs/start" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Start</h1></section>`;

  const router = createRouter({
    mode: "spa",
    urlMode: "hash",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/docs/:page": route("docs.page")
    }),
    partials: createPartialRegistry({
      "docs.page"({ page }) {
        return `<h1 id="route-title">${page}</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  await router.navigate("/docs/signals?view=all");

  assert.equal(document.querySelector("#route-title").textContent, "signals");
  assert.equal(signals.get("router.path"), "/docs/signals");
  assert.deepEqual(signals.get("router.query"), { view: "all" });
  assert.equal(window.location.href, "http://app.test/framework/#/docs/signals?view=all");

  router.destroy();
});

test("SPA hash router follows hashchange and popstate route updates", async () => {
  const window = new Window({ url: "http://app.test/framework/#/docs/start" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Start</h1></section>`;

  const router = createRouter({
    mode: "spa",
    urlMode: "hash",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/docs/:page": route("docs.page"),
      "*": route("notFound.page")
    }),
    partials: createPartialRegistry({
      "docs.page"({ page }) {
        return `<h1 id="route-title">${page}</h1>`;
      },
      "notFound.page"() {
        return `<h1 id="route-title">Not found</h1>`;
      }
    })
  }).start();
  const { signals } = router;

  window.location.hash = "#/docs/server";
  window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  await delay(0);

  assert.equal(document.querySelector("#route-title").textContent, "server");
  assert.equal(signals.get("router.path"), "/docs/server");

  window.history.pushState({}, "", "http://app.test/framework/#/missing");
  window.dispatchEvent(new window.PopStateEvent("popstate"));
  await delay(0);

  assert.equal(document.querySelector("#route-title").textContent, "Not found");
  assert.equal(signals.get("router.path"), "/missing");
  assert.equal(signals.get("router.error"), null);

  router.destroy();
});

test("SPA router prefetch executes partials without mutating route state, history, or DOM", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Home</h1></section>`;
  const cache = createCacheRegistry();
  const contexts = [];
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": route("product.page")
    }),
    cache,
    partials: createPartialRegistry({
      "product.page": function ({ id }) {
        contexts.push({
          id,
          prefetch: this.prefetch,
          path: this.signals.get("router.path")
        });
        this.cache.set(`prefetch:${id}`, { id });
        return {
          html: `<h1 id="route-title">${id}</h1>`,
          signals: {
            prefetched: true
          }
        };
      }
    })
  }).start();
  const { signals } = router;
  signals.ensure("prefetched", false);

  const result = await router.prefetch("/products/sku-1");

  assert.equal(result.html, `<h1 id="route-title">sku-1</h1>`);
  assert.deepEqual(contexts, [{
    id: "sku-1",
    prefetch: true,
    path: "/"
  }]);
  assert.deepEqual(cache.get("prefetch:sku-1"), { id: "sku-1" });
  assert.equal(signals.get("prefetched"), false);
  assert.equal(signals.get("router.pending"), false);
  assert.equal(signals.get("router.path"), "/");
  assert.equal(window.location.href, "http://app.test/");
  assert.equal(document.querySelector("#route-title").textContent, "Home");

  router.destroy();
});

test("SPA router prefetch returns partial errors to the caller", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="route-title">Home</h1></section>`;
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/broken": route("broken")
    }),
    partials: createPartialRegistry({
      broken() {
        throw new Error("prefetch failed");
      }
    })
  }).start();

  await assert.rejects(
    router.prefetch("/broken"),
    /prefetch failed/
  );
  assert.equal(document.querySelector("#route-title").textContent, "Home");

  router.destroy();
});

test("removed SSR-SPA router mode is rejected", () => {
  assert.throws(
    () => createRouter({ mode: "ssr-spa" }),
    /Unknown router mode "ssr-spa"/
  );
});

test("SSR router mode does not intercept link clicks", () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<a id="next" href="/next">Next</a>`;
  const router = createRouter({
    mode: "ssr",
    root: document.body
  }).start();

  const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#next").dispatchEvent(event);

  assert.equal(event.defaultPrevented, false);
  router.destroy();
});

test("MPA router mode does not intercept link clicks", () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<a id="next" href="/next">Next</a>`;
  const router = createRouter({
    mode: "mpa",
    root: document.body
  }).start();

  const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#next").dispatchEvent(event);

  assert.equal(event.defaultPrevented, false);
  router.destroy();
});

test("route matching leaves malformed encoded params raw", () => {
  const routes = createRouteRegistry({
    "/products/:id": route("product.page")
  });

  assert.deepEqual(routes.match("/products/%E0%A4%A").params, {
    id: "%E0%A4%A"
  });
});

test("CSR router renders malformed encoded params without crashing", async () => {
  const window = new Window({ url: "http://app.test/products/%E0%A4%A" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "csr",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": route("product.page")
    }),
    loader,
    partials: createPartialRegistry({
      "product.page"({ id }) {
        return `<h1 id="product-id">${id}</h1>`;
      }
    })
  }).start();

  await delay(0);

  assert.equal(document.querySelector("#product-id").textContent, "%E0%A4%A");
  assert.deepEqual(signals.get("router.params"), { id: "%E0%A4%A" });
  assert.equal(signals.get("router.error"), null);

  router.destroy();
  loader.destroy();
});

test("CSR router passes custom attribute config to its owned loader", async () => {
  const window = new Window({ url: "http://app.test/custom/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section data-async-boundary="route"></section>`;

  let selected = false;
  const router = createRouter({
    mode: "csr",
    root: document.body,
    boundary: "route",
    attributes: {
      async: "data-async-",
      class: "data-class-",
      signal: "data-signal-",
      on: "data-on-"
    },
    routes: createRouteRegistry({
      "/custom/:id": route("custom.page")
    }),
    handlers: createHandlerRegistry({
      select() {
        selected = true;
      }
    }),
    partials: createPartialRegistry({
      "custom.page"({ id }) {
        return `<button id="custom-select" data-on-click="select">${id}</button>`;
      }
    })
  }).start();

  await delay(0);

  const button = document.querySelector("#custom-select");
  assert.equal(button.textContent, "sku-1");
  button.click();
  await delay(0);
  assert.equal(selected, true);

  router.destroy();
});

async function collectUnhandledRejections(fn) {
  const unhandled = [];
  const onUnhandled = (reason) => {
    unhandled.push(reason);
  };
  process.on("unhandledRejection", onUnhandled);
  try {
    await fn();
    await delay(0);
    await delay(0);
    return unhandled;
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
}

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}

// ---------------------------------------------------------------------------
// Splat patterns, document fallback, server route partials, master-detail.

function fakePartialResponse(envelope, overrides = {}) {
  return {
    ok: true,
    status: 200,
    redirected: false,
    url: "",
    json: async () => envelope,
    ...overrides
  };
}

test("route matching captures multi-segment splat params and ranks them above wildcards", () => {
  const routes = createRouteRegistry({
    "*": route("fallback.page"),
    "/:org/:name/tree/*rest": route("tree.page"),
    "/:org/:name/commits/*rest": route("commits.page"),
    "/:org/:name/commit/:sha": route("commit.page")
  });

  const tree = routes.match("http://app.test/async/framework/tree/feature/deep/path");
  assert.equal(tree.pattern, "/:org/:name/tree/*rest");
  assert.deepEqual(tree.params, { org: "async", name: "framework", rest: "feature/deep/path" });

  const encoded = routes.match("http://app.test/async/framework/commits/feat%2Fone/two");
  assert.deepEqual(encoded.params.rest, "feat/one/two");

  const commit = routes.match("http://app.test/async/framework/commit/abc123");
  assert.equal(commit.pattern, "/:org/:name/commit/:sha");

  const unmatched = routes.match("http://app.test/totally/elsewhere");
  assert.equal(unmatched.pattern, "*");
});

test("splat segments must terminate the pattern", () => {
  assert.throws(() => createRouteRegistry({ "/a/*rest/b": route("x") }), /must be the last segment/);
});

test("SPA router with document fallback assigns unmatched URLs natively", async () => {
  const window = new Window({ url: "http://app.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1>sku-1</h1></section>`;
  const assigned = [];
  window.location.assign = (href) => assigned.push(String(href));

  const router = createRouter({
    mode: "spa",
    fallback: "document",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({ "/products/:id": route("product.page") }),
    partials: createPartialRegistry({ "product.page": ({ id }) => `<h1>${id}</h1>` })
  }).start();

  await router.navigate("/raw/download/path");
  assert.deepEqual(assigned, ["http://app.test/raw/download/path"]);
  assert.equal(router.signals.get("router.error"), null);

  router.destroy();
});

test("document fallback refuses to reassign the current URL", async () => {
  const window = new Window({ url: "http://app.test/not-registered" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;
  const assigned = [];
  window.location.assign = (href) => assigned.push(String(href));

  const router = createRouter({
    mode: "spa",
    fallback: "document",
    root: document.body,
    routes: createRouteRegistry({ "/products/:id": route("product.page") }),
    partials: createPartialRegistry({ "product.page": ({ id }) => `<h1>${id}</h1>` })
  }).start();

  await router.navigate("/not-registered");
  assert.deepEqual(assigned, []);
  assert.match(String(router.signals.get("router.error")?.message), /No route matched/);

  router.destroy();
});

test("render document routes navigate natively even when matched", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;
  const assigned = [];
  window.location.assign = (href) => assigned.push(String(href));

  const router = createRouter({
    mode: "spa",
    root: document.body,
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/archive/*rest": defineRoute({ render: "document" })
    }),
    partials: createPartialRegistry({ "home.page": () => "<h1>Home</h1>" })
  }).start();

  await router.navigate("/archive/v1.0.zip");
  assert.deepEqual(assigned, ["http://app.test/archive/v1.0.zip"]);

  router.destroy();
});

test("SPA router fetches server route partials and applies the envelope", async () => {
  const window = new Window({ url: "http://app.test/async/framework/tree/main" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"><h1 id="page-title">tree</h1></section>`;
  const scrolls = [];
  window.scrollTo = (x, y) => scrolls.push([x, y]);

  const requests = [];
  const router = createRouter({
    mode: "spa",
    fallback: "document",
    root: document.body,
    boundary: "page",
    fetch: async (url, init) => {
      requests.push({ url: String(url), headers: init.headers });
      return fakePartialResponse(serverEnvelope({
        title: "History · async/framework",
        html: `<h1 id="page-title">history</h1>`,
        signals: { "repo.tab": "commits" }
      }), { url: String(url) });
    },
    routes: createRouteRegistry({
      "/:org/:name/tree/*rest": defineRoute({ server: true }),
      "/:org/:name/commits/*rest": defineRoute({ server: true })
    })
  }).start();
  router.signals.ensure("repo", {});

  const result = await router.navigate("/async/framework/commits/main");

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "http://app.test/async/framework/commits/main");
  assert.match(requests[0].headers.accept, /application\/x-async-partial/);
  assert.equal(requests[0].headers["x-async-boundary"], "page");
  assert.equal(result.__async_server_result__, 1);
  assert.equal(document.querySelector("#page-title").textContent, "history");
  assert.equal(router.signals.get("repo.tab"), "commits");
  assert.equal(document.title, "History · async/framework");
  assert.equal(window.location.href, "http://app.test/async/framework/commits/main");
  assert.deepEqual(scrolls, [[0, 0]]);

  router.destroy();
});

test("server route partials follow HTTP redirects into router state and history", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"><h1 id="page-title">home</h1></section>`;

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    fetch: async () => fakePartialResponse(
      serverEnvelope({ html: `<h1 id="page-title">tree main</h1>` }),
      { redirected: true, url: "http://app.test/async/framework/tree/main" }
    ),
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/:org/:name": defineRoute({ server: true }),
      "/:org/:name/tree/*rest": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => "<h1>Home</h1>" })
  }).start();

  await router.navigate("/async/framework");

  assert.equal(document.querySelector("#page-title").textContent, "tree main");
  assert.equal(router.signals.get("router.path"), "/async/framework/tree/main");
  assert.deepEqual(router.signals.get("router.params"), { org: "async", name: "framework", rest: "main" });
  assert.equal(window.location.href, "http://app.test/async/framework/tree/main");

  router.destroy();
});

test("server route partials fall back to document navigation for non-envelope responses", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"><h1 id="page-title">home</h1></section>`;
  const assigned = [];
  window.location.assign = (href) => assigned.push(String(href));

  const router = createRouter({
    mode: "spa",
    fallback: "document",
    root: document.body,
    boundary: "page",
    fetch: async (url) => fakePartialResponse("<!doctype html><html></html>", {
      url: String(url),
      json: async () => {
        throw new Error("not json");
      }
    }),
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/legacy/:id": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => "<h1>Home</h1>" })
  }).start();

  await router.navigate("/legacy/42");

  assert.deepEqual(assigned, ["http://app.test/legacy/42"]);
  assert.equal(document.querySelector("#page-title").textContent, "home");
  assert.equal(router.signals.get("router.error"), null);

  router.destroy();
});

test("server route partials surface fetch failures as router errors without document fallback", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"></section>`;

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    fetch: async () => fakePartialResponse(null, { ok: false, status: 500 }),
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/broken": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => "<h1>Home</h1>" })
  }).start();

  await assert.rejects(() => router.navigate("/broken"), /failed with 500/);
  assert.match(String(router.signals.get("router.error")?.message), /failed with 500/);

  router.destroy();
});

test("same-view server routes with a subBoundary fetch and swap only the detail region", async () => {
  const window = new Window({ url: "http://app.test/async/framework/commits/main" });
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="page">
      <div id="rail">rail</div>
      <div async:boundary="history-detail"><p id="detail">first commit</p></div>
    </section>
  `;

  const requests = [];
  const commitsRoute = defineRoute({
    server: true,
    viewKey: ({ params }) => `commits:${params.org}/${params.name}/${params.rest}`,
    subBoundary: "history-detail"
  });
  const router = createRouter({
    mode: "spa",
    fallback: "document",
    root: document.body,
    boundary: "page",
    fetch: async (url, init) => {
      requests.push({ url: String(url), boundary: init.headers["x-async-boundary"] });
      if (init.headers["x-async-boundary"] === "history-detail") {
        return fakePartialResponse(serverEnvelope({
          boundary: "history-detail",
          html: `<p id="detail">commit ${new URL(String(url)).searchParams.get("commit")}</p>`
        }), { url: String(url) });
      }
      return fakePartialResponse(serverEnvelope({
        html: `<div id="rail">rail v2</div><div async:boundary="history-detail"><p id="detail">head of v2</p></div>`
      }), { url: String(url) });
    },
    routes: createRouteRegistry({ "/:org/:name/commits/*rest": commitsRoute })
  }).start();

  // Same view (same org/name/rest): only the detail boundary refreshes.
  await router.navigate("/async/framework/commits/main?commit=abc1234");
  assert.deepEqual(requests.at(-1), {
    url: "http://app.test/async/framework/commits/main?commit=abc1234",
    boundary: "history-detail"
  });
  assert.equal(document.querySelector("#detail").textContent, "commit abc1234");
  assert.equal(document.querySelector("#rail").textContent, "rail");
  assert.equal(window.location.href, "http://app.test/async/framework/commits/main?commit=abc1234");
  assert.deepEqual(router.signals.get("router.query"), { commit: "abc1234" });

  // Another selection keeps using the detail boundary.
  await router.navigate("/async/framework/commits/main?commit=def5678");
  assert.equal(document.querySelector("#detail").textContent, "commit def5678");
  assert.equal(document.querySelector("#rail").textContent, "rail");

  // A different ref is a different view: the full page boundary refreshes.
  await router.navigate("/async/framework/commits/feature/x");
  assert.deepEqual(requests.at(-1), {
    url: "http://app.test/async/framework/commits/feature/x",
    boundary: "page"
  });
  assert.equal(document.querySelector("#rail").textContent, "rail v2");
  assert.equal(document.querySelector("#detail").textContent, "head of v2");

  // And the new view keeps master-detail behavior for its own selections.
  await router.navigate("/async/framework/commits/feature/x?commit=fff0000");
  assert.deepEqual(requests.at(-1), {
    url: "http://app.test/async/framework/commits/feature/x?commit=fff0000",
    boundary: "history-detail"
  });
  assert.equal(document.querySelector("#rail").textContent, "rail v2");
  assert.equal(document.querySelector("#detail").textContent, "commit fff0000");

  router.destroy();
});

test("server route prefetch returns the envelope without applying it", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"><h1 id="page-title">home</h1></section>`;

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    fetch: async (url) => fakePartialResponse(serverEnvelope({ html: "<h1>preview</h1>" }), { url: String(url) }),
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/preview/:id": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => "<h1>Home</h1>" })
  }).start();

  const preview = await router.prefetch("/preview/9");

  assert.equal(preview.__async_server_result__, 1);
  assert.equal(preview.html, "<h1>preview</h1>");
  assert.equal(document.querySelector("#page-title").textContent, "home");
  assert.equal(window.location.href, "http://app.test/");
  // Router state still describes the attached route, not the prefetched one.
  assert.equal(router.signals.get("router.path"), "/");

  router.destroy();
});

test("prefetched server routes are consumed by the next matching navigation", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"><h1 id="page-title">home</h1></section>`;

  let fetches = 0;
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    fetch: async (url) => {
      fetches += 1;
      return fakePartialResponse(serverEnvelope({ html: `<h1 id="page-title">detail</h1>` }), { url: String(url) });
    },
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/detail/:id": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => `<h1 id="page-title">home</h1>` })
  }).start();

  await router.prefetch("/detail/9");
  assert.equal(fetches, 1);
  assert.equal(document.querySelector("#page-title").textContent, "home", "prefetch must not touch the DOM");

  await router.navigate("/detail/9");
  assert.equal(fetches, 1, "navigation must consume the prefetched envelope instead of refetching");
  assert.equal(document.querySelector("#page-title").textContent, "detail");
  assert.equal(window.location.href, "http://app.test/detail/9");

  // Single use: navigating again after leaving refetches.
  await router.navigate("/");
  await router.navigate("/detail/9");
  assert.equal(fetches, 2);

  router.destroy();
});

test("expired prefetch entries are not consumed", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"><h1 id="page-title">home</h1></section>`;

  let fetches = 0;
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    prefetchTtlMs: 10,
    fetch: async (url) => {
      fetches += 1;
      return fakePartialResponse(serverEnvelope({ html: `<h1 id="page-title">detail</h1>` }), { url: String(url) });
    },
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/detail/:id": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => `<h1 id="page-title">home</h1>` })
  }).start();

  await router.prefetch("/detail/9");
  await delay(30);
  await router.navigate("/detail/9");

  assert.equal(fetches, 2, "a stale prefetch entry must be refetched");
  router.destroy();
});

test("event-driven navigation failures are logged to the console", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <main async:container>
      <a id="broken" href="/broken">broken</a>
      <section async:boundary="route"><h1>home</h1></section>
    </main>
  `;

  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.map(String).join(" "));
  try {
    const router = createRouter({
      mode: "spa",
      root: document.body,
      boundary: "route",
      routes: createRouteRegistry({
        "/": route("home.page"),
        "/broken": route("broken.page")
      }),
      partials: createPartialRegistry({
        "home.page": () => "<h1>home</h1>",
        "broken.page"() {
          throw new Error("partial exploded");
        }
      })
    }).start();

    document.querySelector("#broken").click();
    await delay(20);

    assert.ok(
      logged.some((line) => line.includes("navigation failed") && line.includes("partial exploded")),
      `expected a navigation failure log, saw: ${JSON.stringify(logged)}`
    );
    assert.match(String(router.signals.get("router.error")?.message), /partial exploded/);
    router.destroy();
  } finally {
    console.error = originalError;
  }
});

test("unmatched navigation without document fallback warns with guidance", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    const router = createRouter({
      mode: "spa",
      root: document.body,
      routes: createRouteRegistry({ "/": route("home.page") }),
      partials: createPartialRegistry({ "home.page": () => "<h1>home</h1>" })
    }).start();

    await router.navigate("/nowhere");

    assert.ok(
      warnings.some((line) => line.includes("No route matched /nowhere") && line.includes('fallback: "document"')),
      `expected a no-route warning, saw: ${JSON.stringify(warnings)}`
    );
    router.destroy();
  } finally {
    console.warn = originalWarn;
  }
});
