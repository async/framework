import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  AsyncLoader,
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
  const loader = AsyncLoader({ root: document.body, signals, handlers, cache }).start();
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
  const loader = AsyncLoader({ root: document.body, signals }).start();
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
  const loader = AsyncLoader({ root: document.body, signals }).start();
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
  const loader = AsyncLoader({ root: document.body, signals, handlers }).start();
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
  const loader = AsyncLoader({ root: document.body, signals }).start();
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
