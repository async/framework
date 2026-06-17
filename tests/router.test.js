import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  AsyncLoader,
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

test("SPA router swaps route boundaries and rescans inserted handlers", async () => {
  const window = new Window({ url: "http://app.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <a id="product-link" href="/products/sku-1">Product</a>
      <section data-async-boundary="route"></section>
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
          <button id="select" on:click="select" data-async-class:selected="selected">
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
      <section data-async-boundary="route"><h1>Home</h1></section>
      <a id="next" href="/next">Next</a>
    </main>
  `;

  const signals = createSignalRegistry();
  const partials = createPartialRegistry({
    next() {
      return `<h1 id="next-page">Next</h1>`;
    }
  });
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
    partials
  }).start();

  assert.equal(document.querySelector("h1").textContent, "Home");

  document.querySelector("#next").click();
  await delay(0);

  assert.equal(document.querySelector("#next-page").textContent, "Next");
  assert.equal(signals.get("router.path"), "/next");

  router.destroy();
  loader.destroy();
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
