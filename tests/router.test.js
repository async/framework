import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  createCacheRegistry,
  createHandlerRegistry,
  createPartialRegistry,
  createRouteRegistry,
  createRouter,
  createSignalRegistry,
  delay,
  html,
  route,
  signal
} from "../src/index.js";

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
      return {
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
      };
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
    signals,
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
    signals,
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
    signals,
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

test("SPA router aborts stale navigations and ignores late partial results", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const pending = new Map();
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
    signals,
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
  assert.equal(signals.get("router.pending"), false);

  slowRecord.resolve();
  await slow;
  assert.equal(document.querySelector("#route-title").textContent, "fast");
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
    signals,
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
    signals,
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

test("SSR-SPA router aborts stale fetch navigations and ignores late route responses", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const pending = new Map();
  const signals = createSignalRegistry({
    routerTest: signal({})
  });
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "ssr-spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": route("product.page")
    }),
    loader,
    signals,
    fetch: async (url, init = {}) => {
      const to = new URL(new URL(url, "http://app.test").searchParams.get("to"));
      const id = to.pathname.split("/").at(-1);
      const record = {
        id,
        signal: init.signal
      };
      pending.set(id, record);
      return new Promise((resolve) => {
        record.resolve = () => resolve(new Response(JSON.stringify({
          html: `<h1 id="route-title">${id}</h1>`,
          signals: {
            "routerTest.loaded": id
          }
        }), {
          headers: {
            "content-type": "application/json"
          }
        }));
      });
    }
  }).start();

  const slow = router.navigate("/products/slow");
  await delay(0);
  const slowRecord = pending.get("slow");

  const fast = router.navigate("/products/fast");
  await delay(0);
  const fastRecord = pending.get("fast");

  assert.equal(slowRecord.signal.aborted, true);
  assert.equal(fastRecord.signal.aborted, false);

  fastRecord.resolve();
  await fast;
  assert.equal(document.querySelector("#route-title").textContent, "fast");
  assert.equal(signals.get("routerTest.loaded"), "fast");
  assert.equal(signals.get("router.pending"), false);

  slowRecord.resolve();
  assert.equal(await slow, null);
  assert.equal(document.querySelector("#route-title").textContent, "fast");
  assert.equal(signals.get("routerTest.loaded"), "fast");
  assert.equal(signals.get("router.path"), "/products/fast");

  router.destroy();
  loader.destroy();
});

test("SSR-SPA router ignores stale fetch rejections after a newer navigation completes", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const pending = new Map();
  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "ssr-spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": route("product.page")
    }),
    loader,
    signals,
    fetch: async (url) => {
      const to = new URL(new URL(url, "http://app.test").searchParams.get("to"));
      const id = to.pathname.split("/").at(-1);
      const record = {};
      pending.set(id, record);
      return new Promise((resolve, reject) => {
        record.resolve = () => resolve(new Response(JSON.stringify({
          html: `<h1 id="route-title">${id}</h1>`
        }), {
          headers: {
            "content-type": "application/json"
          }
        }));
        record.reject = reject;
      });
    }
  }).start();

  const slow = router.navigate("/products/slow");
  await delay(0);
  const fast = router.navigate("/products/fast");
  await delay(0);

  pending.get("fast").resolve();
  await fast;

  pending.get("slow").reject(new Error("slow fetch failed late"));
  assert.equal(await slow, null);
  assert.equal(document.querySelector("#route-title").textContent, "fast");
  assert.equal(signals.get("router.error"), null);

  router.destroy();
  loader.destroy();
});

test("SSR-SPA router starts from existing HTML and intercepts later same-origin links", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <section async:boundary="route"><h1>Home</h1></section>
      <a id="next" href="/next">Next</a>
    </main>
  `;

  const signals = createSignalRegistry();
  let requestedUrl;
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "ssr-spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/": route("home"),
      "/next": route("next")
    }),
    loader,
    signals,
    partials: createPartialRegistry({
      next() {
        throw new Error("ssr-spa should fetch route HTML instead of rendering local partials.");
      }
    }),
    fetch: async (url) => {
      requestedUrl = url;
      return new Response(JSON.stringify({ html: `<h1 id="next-page">Next</h1>` }), {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  }).start();

  assert.equal(document.querySelector("h1").textContent, "Home");

  document.querySelector("#next").click();
  await delay(0);

  assert.equal(document.querySelector("#next-page").textContent, "Next");
  assert.equal(signals.get("router.path"), "/next");
  assert.equal(signals.get("router.route").partial, "next");
  assert.match(requestedUrl, /\/__async\/route\?to=/);

  router.destroy();
  loader.destroy();
});

test("SSR-SPA router catches intercepted link navigation failures", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <a id="broken" href="/broken">Broken</a>
    <section async:boundary="route"></section>
  `;

  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "ssr-spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/broken": route("broken")
    }),
    loader,
    signals,
    fetch: async () => new Response("nope", { status: 500 })
  }).start();

  const unhandled = await collectUnhandledRejections(async () => {
    document.querySelector("#broken").click();
    await delay(0);
  });

  assert.deepEqual(unhandled, []);
  assert.equal(signals.get("router.pending"), false);
  assert.match(signals.get("router.error").message, /failed with 500/);

  router.destroy();
  loader.destroy();
});

test("SSR-SPA router catches intercepted submit navigation failures", async () => {
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
    mode: "ssr-spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/search": route("search")
    }),
    loader,
    signals,
    fetch: async () => new Response("nope", { status: 503 })
  }).start();

  const submit = new window.Event("submit", { bubbles: true, cancelable: true });
  const unhandled = await collectUnhandledRejections(async () => {
    document.querySelector("#search").dispatchEvent(submit);
    await delay(0);
  });

  assert.equal(submit.defaultPrevented, true);
  assert.deepEqual(unhandled, []);
  assert.equal(signals.get("router.pending"), false);
  assert.match(signals.get("router.error").message, /failed with 503/);

  router.destroy();
  loader.destroy();
});

test("SSR-SPA router catches popstate navigation failures", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;

  const signals = createSignalRegistry();
  const loader = Loader({ root: document.body, signals }).start();
  const router = createRouter({
    mode: "ssr-spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/broken": route("broken")
    }),
    loader,
    signals,
    fetch: async () => new Response("nope", { status: 502 })
  }).start();

  window.history.pushState({}, "", "/broken");
  const unhandled = await collectUnhandledRejections(async () => {
    window.dispatchEvent(new window.PopStateEvent("popstate"));
    await delay(0);
  });

  assert.deepEqual(unhandled, []);
  assert.equal(signals.get("router.path"), "/broken");
  assert.equal(signals.get("router.pending"), false);
  assert.match(signals.get("router.error").message, /failed with 502/);

  router.destroy();
  loader.destroy();
});

test("SSR-SPA router ignores same-document hash links", async () => {
  const window = new Window({ url: "http://app.test/products?tab=info" });
  const { document } = window;
  document.body.innerHTML = `
    <a id="hash-only" href="#details">Details</a>
    <a id="same-path-hash" href="/products?tab=info#reviews">Reviews</a>
    <a id="next" href="/products?tab=specs#details">Specs</a>
    <section async:boundary="route"><h1>Product</h1></section>
  `;

  let requests = 0;
  const router = createRouter({
    mode: "ssr-spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products": route("product")
    }),
    fetch: async () => {
      requests += 1;
      return new Response(JSON.stringify({ html: "<h1>Updated</h1>" }), {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  }).start();

  const hashOnly = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#hash-only").dispatchEvent(hashOnly);
  const samePathHash = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#same-path-hash").dispatchEvent(samePathHash);
  await delay(0);

  assert.equal(hashOnly.defaultPrevented, false);
  assert.equal(samePathHash.defaultPrevented, false);
  assert.equal(requests, 0);

  const next = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  document.querySelector("#next").dispatchEvent(next);
  await delay(0);

  assert.equal(next.defaultPrevented, true);
  assert.equal(requests, 1);

  router.destroy();
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
    signals,
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

  const signals = createSignalRegistry({
    selected: signal(false)
  });
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
    signals,
    handlers: createHandlerRegistry({
      select() {
        this.signals.set("selected", true);
      }
    }),
    partials: createPartialRegistry({
      "custom.page"({ id }) {
        return `<button id="custom-select" data-on-click="select" data-class-selected="selected">${id}</button>`;
      }
    })
  }).start();

  await delay(0);

  const button = document.querySelector("#custom-select");
  assert.equal(button.textContent, "sku-1");
  button.click();
  await delay(0);
  assert.equal(button.classList.contains("selected"), true);

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
