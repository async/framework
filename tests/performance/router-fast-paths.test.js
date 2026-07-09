// @hot-paths: src/router.js
//
// Performance contracts for the navigation planner: every click pays exactly
// the work its transition plan calls for — and nothing else. Counts partial
// renders, server fetches, history writes, and DOM mutations per navigation
// kind, so a planner regression (noop navigations re-rendering, same-view
// state updates fetching, prefetch touching the document) fails loudly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { createRouter, defineRoute, route } from "../../src/index.js";
import { createPartialRegistry } from "../../src/partials.js";
import { createRouteRegistry } from "../../src/router.js";

function counters(window) {
  const counts = { renders: 0, fetches: 0, pushes: 0, replaces: 0 };
  const { history } = window;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState = (...args) => {
    counts.pushes += 1;
    return push(...args);
  };
  history.replaceState = (...args) => {
    counts.replaces += 1;
    return replace(...args);
  };
  return counts;
}

function envelope(html) {
  return { ok: true, status: 200, redirected: false, url: "", json: async () => ({ __async_server_result__: 1, html }) };
}

test("same-URL navigation is a full noop: no render, no fetch, no history write", async () => {
  const window = new Window({ url: "http://perf.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1>sku-1</h1></section>`;
  const counts = counters(window);

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    fetch: async () => {
      counts.fetches += 1;
      return envelope("<h1>never</h1>");
    },
    routes: createRouteRegistry({ "/products/:id": route("product.page") }),
    partials: createPartialRegistry({
      "product.page"({ id }) {
        counts.renders += 1;
        return `<h1>${id}</h1>`;
      }
    })
  }).start();

  await router.navigate("/products/sku-1");
  await router.navigate("/products/sku-1");

  assert.deepEqual(counts, { renders: 0, fetches: 0, pushes: 0, replaces: 0 });
  router.destroy();
});

test("same-view navigation updates state and history only", async () => {
  const window = new Window({ url: "http://perf.test/products/sku-1" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="t">sku-1</h1></section>`;
  const counts = counters(window);

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/products/:id": defineRoute("product.page", { viewKey: "product" })
    }),
    partials: createPartialRegistry({
      "product.page"({ id }) {
        counts.renders += 1;
        return `<h1 id="t">${id}</h1>`;
      }
    })
  }).start();

  await router.navigate("/products/sku-1?tab=specs");
  await router.navigate("/products/sku-2?tab=specs");

  assert.equal(counts.renders, 0, "same-view navigation must not render partials");
  assert.equal(counts.pushes, 2, "same-view navigation still writes history");
  assert.equal(document.querySelector("#t").textContent, "sku-1", "mounted DOM stays untouched");
  router.destroy();
});

test("master-detail selection pays exactly one fetch into the sub-boundary", async () => {
  const window = new Window({ url: "http://perf.test/r/n/commits/main" });
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="page">
      <div id="rail">rail</div>
      <div async:boundary="detail"><p>first</p></div>
    </section>
  `;
  const counts = counters(window);

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    fetch: async (url, init) => {
      counts.fetches += 1;
      assert.equal(init.headers["x-async-boundary"], "detail", "selection must ask for the sub-boundary");
      return envelope(`<p>commit</p>`);
    },
    routes: createRouteRegistry({
      "/:org/:name/commits/*rest": defineRoute({
        server: true,
        viewKey: ({ params }) => `c:${params.org}/${params.name}/${params.rest}`,
        subBoundary: "detail"
      })
    })
  }).start();

  await router.navigate("/r/n/commits/main?commit=abc");

  assert.equal(counts.fetches, 1, `selection cost ${counts.fetches} fetches`);
  assert.equal(counts.pushes, 1);
  assert.equal(document.querySelector("#rail").textContent, "rail", "rail is not re-rendered");
  router.destroy();
});

test("prefetch renders without touching DOM, history, or router state", async () => {
  const window = new Window({ url: "http://perf.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"><h1 id="t">home</h1></section>`;
  const counts = counters(window);

  let mutations = 0;
  const observer = new window.MutationObserver((records) => {
    mutations += records.length;
  });
  observer.observe(document.body, { childList: true, characterData: true, attributes: true, subtree: true });

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/products/:id": route("product.page")
    }),
    partials: createPartialRegistry({
      "home.page": () => `<h1 id="t">home</h1>`,
      "product.page": ({ id }) => `<h1>${id}</h1>`
    })
  }).start();

  const preview = await router.prefetch("/products/sku-9");
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.ok(preview, "prefetch returns the rendered preview");
  assert.equal(document.querySelector("#t").textContent, "home");
  assert.equal(mutations, 0, `prefetch caused ${mutations} DOM mutations`);
  assert.deepEqual(
    { pushes: counts.pushes, replaces: counts.replaces },
    { pushes: 0, replaces: 0 },
    "prefetch must not write history"
  );
  observer.disconnect();
  router.destroy();
});

test("a prefetched navigation pays zero additional fetches", async () => {
  const window = new Window({ url: "http://perf.test/" });
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="page"><h1 id="t">home</h1></section>`;
  const counts = counters(window);

  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    fetch: async (url) => {
      counts.fetches += 1;
      return envelope(`<h1 id="t">detail</h1>`);
    },
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/detail/:id": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => `<h1 id="t">home</h1>` })
  }).start();

  await router.prefetch("/detail/9");
  assert.equal(counts.fetches, 1);

  await router.navigate("/detail/9");

  assert.equal(counts.fetches, 1, `prefetch + navigate cost ${counts.fetches} fetches; the envelope must be reused`);
  assert.equal(document.querySelector("#t").textContent, "detail");
  router.destroy();
});
