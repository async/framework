// Rendering under frame-timed commits: loader swaps, rebinding, handler
// composition, and router navigation.
//
// These are the browser-shaped failure modes that synchronous node commits
// hide: a hidden tab suspending requestAnimationFrame froze every boundary
// commit, and awaiting commit completion inside scheduler.batch(...)
// deadlocked SPA navigation. Each test forces frame timing explicitly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  createHandlerRegistry,
  createRouter,
  createScheduler,
  createSignalRegistry,
  defineRoute,
  delay,
  route,
  signal
} from "../../src/index.js";
import { createPartialRegistry } from "../../src/partials.js";
import { createRouteRegistry } from "../../src/router.js";

const NEVER = () => {}; // suspended rAF: hidden/backgrounded tab
const frame = (ms = 4) => (cb) => setTimeout(() => cb(Date.now()), ms);

const withTimeout = (promise, label, ms = 3000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms))
  ]);

function frameScheduler(options = {}) {
  return createScheduler({ requestAnimationFrame: frame(), frameFallbackMs: 40, ...options });
}

function makeDom(bodyHtml, url = "http://app.test/") {
  const window = new Window({ url });
  window.document.body.innerHTML = bodyHtml;
  return { window, document: window.document };
}

function serverEnvelope(fields = {}) {
  return { __async_server_result__: 1, ...fields };
}

function fakePartialResponse(envelope, overrides = {}) {
  return { ok: true, status: 200, redirected: false, url: "", json: async () => envelope, ...overrides };
}

// ------------------------------------------------------------------- loader

test("loader.swap commits under frame timing and _whenCommitted resolves", async () => {
  const { document } = makeDom(`<section async:boundary="view"><p id="content">old</p></section>`);
  const scheduler = frameScheduler();
  const loader = Loader({ root: document.body, scheduler });
  loader.start();

  const swapped = loader.swap("view", `<p id="content">new</p>`);
  await withTimeout(loader._whenCommitted(swapped), "swap commit");

  assert.equal(document.querySelector("#content").textContent, "new");
  scheduler.destroy();
});

test("loader.swap commits while animation frames are suspended", async () => {
  const { document } = makeDom(`<section async:boundary="view"><p id="content">old</p></section>`);
  const scheduler = createScheduler({ requestAnimationFrame: NEVER, frameFallbackMs: 10 });
  const loader = Loader({ root: document.body, scheduler });
  loader.start();

  const swapped = loader.swap("view", `<p id="content">hidden tab</p>`);
  await withTimeout(loader._whenCommitted(swapped), "suspended-rAF swap commit");

  assert.equal(document.querySelector("#content").textContent, "hidden tab");
  scheduler.destroy();
});

test("swapped content rebinds handlers under frame timing", async () => {
  const { document } = makeDom(`<section async:boundary="view"><p>old</p></section>`);
  const scheduler = frameScheduler();
  let clicks = 0;
  const handlers = createHandlerRegistry({
    bump() {
      clicks += 1;
    }
  });
  const loader = Loader({ root: document.body, scheduler, handlers });
  loader.start();

  const swapped = loader.swap("view", `<button id="go" on:click="bump">go</button>`);
  await withTimeout(loader._whenCommitted(swapped), "swap commit");

  document.querySelector("#go").click();
  await delay(20);

  assert.equal(clicks, 1, "on:click in swapped HTML must be rebound");
  scheduler.destroy();
});

test("rapid swaps to the same boundary apply in order and finish on the last", async () => {
  const { document } = makeDom(`<section async:boundary="view"><p id="content">0</p></section>`);
  const scheduler = frameScheduler();
  const loader = Loader({ root: document.body, scheduler });
  loader.start();

  const first = loader.swap("view", `<p id="content">1</p>`);
  const second = loader.swap("view", `<p id="content">2</p>`);
  await withTimeout(Promise.all([loader._whenCommitted(first), loader._whenCommitted(second)]), "both swaps");

  assert.equal(document.querySelector("#content").textContent, "2");
  scheduler.destroy();
});

test("fire-and-forget swaps inside handlers commit after the handler batch ends", async () => {
  // Handler dispatch runs inside scheduler.batch(...). The safe composition
  // is fire-and-forget: swap now, let the commit land when the batch settles.
  // (Awaiting commit completion inside the handler is the documented
  // deadlock; the router had exactly that bug.)
  const { document } = makeDom(
    `<section async:boundary="view"><button id="go" on:click="show">go</button></section>`
  );
  const scheduler = frameScheduler();
  const handlers = createHandlerRegistry({
    show() {
      this.loader.swap("view", `<p id="content">from handler</p>`);
    }
  });
  const loader = Loader({ root: document.body, scheduler, handlers });
  loader.start();

  document.querySelector("#go").click();
  await withTimeout(
    (async () => {
      while (!document.querySelector("#content")) {
        await delay(10);
      }
    })(),
    "handler-initiated swap"
  );

  assert.equal(document.querySelector("#content").textContent, "from handler");
  scheduler.destroy();
});

test("signal writes and boundary swaps from the same tick both land under frame timing", async () => {
  const { document } = makeDom(`
    <output signal:text="status">start</output>
    <section async:boundary="view"><p id="content">old</p></section>
  `);
  const scheduler = frameScheduler();
  const signals = createSignalRegistry({ status: signal("start") });
  const loader = Loader({ root: document.body, scheduler, signals });
  loader.start();

  signals.set("status", "done");
  const swapped = loader.swap("view", `<p id="content">new</p>`);
  await withTimeout(loader._whenCommitted(swapped), "swap commit");
  await scheduler.flush();

  assert.equal(document.querySelector("output").textContent, "done");
  assert.equal(document.querySelector("#content").textContent, "new");
  scheduler.destroy();
});

// ------------------------------------------------------------------- router

test("SPA navigation completes with frame-timed commits (no batch deadlock)", async () => {
  const { window, document } = makeDom(
    `<section async:boundary="route"><h1 id="route-title">sku-1</h1></section>`,
    "http://app.test/products/sku-1"
  );
  const scheduler = frameScheduler();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    scheduler,
    routes: createRouteRegistry({ "/products/:id": route("product.page") }),
    partials: createPartialRegistry({ "product.page": ({ id }) => `<h1 id="route-title">${id}</h1>` })
  }).start();

  await withTimeout(router.navigate("/products/sku-2"), "frame-timed navigation");

  assert.equal(document.querySelector("#route-title").textContent, "sku-2");
  assert.equal(window.location.href, "http://app.test/products/sku-2");

  router.destroy();
  scheduler.destroy();
});

test("frame-timed server route partials swap the sub-boundary without deadlock", async () => {
  const { window, document } = makeDom(
    `
    <section async:boundary="page">
      <div id="rail">rail</div>
      <div async:boundary="history-detail"><p id="detail">first</p></div>
    </section>
    `,
    "http://app.test/r/n/commits/main"
  );
  const scheduler = frameScheduler();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    scheduler,
    fetch: async (url) => fakePartialResponse(serverEnvelope({
      boundary: "history-detail",
      html: `<p id="detail">commit ${new URL(String(url)).searchParams.get("commit")}</p>`
    }), { url: String(url) }),
    routes: createRouteRegistry({
      "/:org/:name/commits/*rest": defineRoute({
        server: true,
        viewKey: ({ params }) => `c:${params.org}/${params.name}/${params.rest}`,
        subBoundary: "history-detail"
      })
    })
  }).start();

  await withTimeout(router.navigate("/r/n/commits/main?commit=abc1234"), "sub-boundary navigation");

  assert.equal(document.querySelector("#detail").textContent, "commit abc1234");
  assert.equal(document.querySelector("#rail").textContent, "rail");
  assert.equal(window.location.href, "http://app.test/r/n/commits/main?commit=abc1234");

  router.destroy();
  scheduler.destroy();
});

test("server route navigation completes while animation frames are suspended", async () => {
  // The production incident: a hidden tab suspends rAF, and navigation used
  // to freeze awaiting a commit that could never run.
  const { window, document } = makeDom(
    `<section async:boundary="page"><h1 id="page-title">home</h1></section>`,
    "http://app.test/"
  );
  const scheduler = createScheduler({ requestAnimationFrame: NEVER, frameFallbackMs: 10 });
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "page",
    scheduler,
    fetch: async (url) => fakePartialResponse(serverEnvelope({
      title: "Detail · app",
      html: `<h1 id="page-title">detail</h1>`
    }), { url: String(url) }),
    routes: createRouteRegistry({
      "/": route("home.page"),
      "/detail/:id": defineRoute({ server: true })
    }),
    partials: createPartialRegistry({ "home.page": () => `<h1 id="page-title">home</h1>` })
  }).start();

  await withTimeout(router.navigate("/detail/9"), "hidden-tab navigation");

  assert.equal(document.querySelector("#page-title").textContent, "detail");
  assert.equal(document.title, "Detail · app");
  assert.equal(window.location.href, "http://app.test/detail/9");

  router.destroy();
  scheduler.destroy();
});

test("popstate navigation re-renders under frame timing", async () => {
  const { window, document } = makeDom(
    `<section async:boundary="route"><h1 id="route-title">sku-1</h1></section>`,
    "http://app.test/products/sku-1"
  );
  const scheduler = frameScheduler();
  const router = createRouter({
    mode: "spa",
    root: document.body,
    boundary: "route",
    scheduler,
    routes: createRouteRegistry({ "/products/:id": route("product.page") }),
    partials: createPartialRegistry({ "product.page": ({ id }) => `<h1 id="route-title">${id}</h1>` })
  }).start();

  await withTimeout(router.navigate("/products/sku-2"), "forward navigation");
  assert.equal(document.querySelector("#route-title").textContent, "sku-2");

  // Deterministic browser back: rewind the URL, then fire popstate.
  window.history.replaceState({}, "", "http://app.test/products/sku-1");
  window.dispatchEvent(new window.PopStateEvent("popstate"));
  await withTimeout(
    (async () => {
      while (document.querySelector("#route-title").textContent !== "sku-1") {
        await delay(10);
      }
    })(),
    "popstate re-render"
  );

  assert.equal(document.querySelector("#route-title").textContent, "sku-1");
  assert.deepEqual(router.signals.get("router.params"), { id: "sku-1" });

  router.destroy();
  scheduler.destroy();
});

test("a commit awaited inside an open batch triggers the stall watchdog", async () => {
  // The deadlock composition itself: handler dispatch (or any user code)
  // holds a batch open while awaiting commit completion. Automatic flushes
  // stay suppressed, the commit never settles — the watchdog names it.
  // Frame timing matters: without requestAnimationFrame, node commits run
  // synchronously and the hazard cannot occur.
  const { document } = makeDom(`<section async:boundary="view"><p>old</p></section>`);
  const scheduler = frameScheduler();
  const loader = Loader({ root: document.body, scheduler, commitStallWarningMs: 25 });
  loader.start();

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    // Hold a batch open forever, then schedule a swap: its commit can never
    // flush while the batch is pending.
    void scheduler.batch(() => new Promise(() => {}));
    const swapped = loader.swap("view", `<p>never lands</p>`);
    void loader._whenCommitted(swapped).catch(() => {});
    await delay(80);

    assert.ok(
      warnings.some((line) => line.includes("has not settled") && line.includes("scheduler.batch")),
      `expected a commit stall warning, saw: ${JSON.stringify(warnings)}`
    );
  } finally {
    console.warn = originalWarn;
  }
});

test("settled commits never trigger the stall watchdog", async () => {
  const { document } = makeDom(`<section async:boundary="view"><p>old</p></section>`);
  const scheduler = frameScheduler();
  const loader = Loader({ root: document.body, scheduler, commitStallWarningMs: 30 });
  loader.start();

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));
  try {
    await withTimeout(loader._whenCommitted(loader.swap("view", `<p id="c">new</p>`)), "healthy swap");
    await delay(60); // past the watchdog window

    assert.equal(document.querySelector("#c").textContent, "new");
    assert.deepEqual(warnings, []);
  } finally {
    console.warn = originalWarn;
    scheduler.destroy();
  }
});
