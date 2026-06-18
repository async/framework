import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  createBoundaryReceiver,
  createCacheRegistry,
  createHandlerRegistry,
  createScheduler,
  createSignalRegistry,
  delay,
  signal
} from "../src/index.js";

test("boundary receiver applies signals before swapping HTML", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const signals = createSignalRegistry({
    product: signal({})
  });
  const loader = Loader({ root: document.body, signals }).start();
  const receiver = createBoundaryReceiver({ loader });

  const result = await receiver.apply({
    boundary: "product",
    seq: 1,
    signals: {
      "product.title": "Keyboard"
    },
    html: `<article><h1 signal:text="product.title"></h1></article>`
  });

  assert.deepEqual(result, { status: "applied", boundary: "product", seq: 1 });
  assert.equal(document.querySelector("h1").textContent, "Keyboard");
  loader.destroy();
});

test("boundary receiver restores browser cache patches", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const cache = createCacheRegistry();
  const loader = Loader({ root: document.body, cache }).start();
  const receiver = createBoundaryReceiver({ loader, cache });

  await receiver.apply({
    boundary: "product",
    seq: 1,
    cache: {
      browser: {
        "product:sku-1": { title: "Keyboard" }
      }
    }
  });

  assert.deepEqual(cache.get("product:sku-1"), { title: "Keyboard" });
  loader.destroy();
});

test("boundary receiver applies signals-only patches", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const signals = createSignalRegistry({
    product: signal({})
  });
  const loader = Loader({ root: document.body, signals }).start();
  const receiver = createBoundaryReceiver({ loader, signals });

  const result = await receiver.apply({
    boundary: "product",
    seq: 1,
    signals: {
      "product.status": "ready"
    }
  });

  assert.deepEqual(result, { status: "applied", boundary: "product", seq: 1 });
  assert.equal(signals.get("product.status"), "ready");
  assert.equal(document.querySelector("[async\\:boundary='product']").textContent, "");
  loader.destroy();
});

test("boundary receiver ignores stale seq for the same boundary", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="hero"></section>`;
  const loader = Loader({ root: document.body }).start();
  const receiver = createBoundaryReceiver({ loader });

  await receiver.apply({ boundary: "hero", seq: 5, html: `<h1>Fresh</h1>` });
  const result = await receiver.apply({ boundary: "hero", seq: 4, html: `<h1>Stale</h1>` });

  assert.deepEqual(result, {
    status: "ignored-stale",
    boundary: "hero",
    seq: 4,
    lastSeq: 5
  });
  assert.equal(document.querySelector("h1").textContent, "Fresh");
  assert.equal(receiver.inspect().boundaries.hero.ignored, 1);
  loader.destroy();
});

test("boundary receiver retries the same seq after DOM swap failure", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const signals = createSignalRegistry({
    product: signal({})
  });
  const loader = Loader({ root: document.body, signals }).start();
  const originalSwap = loader.swap.bind(loader);
  let attempts = 0;
  loader.swap = (boundary, html) => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("swap failed");
    }
    return originalSwap(boundary, html);
  };
  const receiver = createBoundaryReceiver({ loader, signals });
  const patch = {
    boundary: "product",
    seq: 1,
    signals: {
      "product.title": "Keyboard"
    },
    html: `<article><h1 signal:text="product.title"></h1></article>`
  };

  await assert.rejects(receiver.apply(patch), /swap failed/);

  assert.equal(receiver.inspect().boundaries.product.lastSeq, -Infinity);
  assert.equal(signals.get("product.title"), "Keyboard");

  const result = await receiver.apply(patch);

  assert.deepEqual(result, { status: "applied", boundary: "product", seq: 1 });
  assert.equal(receiver.inspect().boundaries.product.lastSeq, 1);
  assert.equal(document.querySelector("h1").textContent, "Keyboard");
  loader.destroy();
});

test("boundary receiver missing signal capability does not consume seq", async () => {
  let swappedHtml;
  const loader = {
    swap(boundary, html) {
      swappedHtml = { boundary, html };
    }
  };
  const receiver = createBoundaryReceiver({ loader });

  await assert.rejects(
    receiver.apply({
      boundary: "product",
      seq: 1,
      signals: {
        "product.title": "Keyboard"
      }
    }),
    /no signal registry is available/
  );

  assert.equal(receiver.inspect().boundaries.product.lastSeq, -Infinity);

  const result = await receiver.apply({
    boundary: "product",
    seq: 1,
    html: `<h1>Retry</h1>`
  });

  assert.deepEqual(result, { status: "applied", boundary: "product", seq: 1 });
  assert.deepEqual(swappedHtml, { boundary: "product", html: `<h1>Retry</h1>` });
  assert.equal(receiver.inspect().boundaries.product.lastSeq, 1);
});

test("boundary receiver retries the same seq after scheduler flush failure", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const loader = Loader({ root: document.body }).start();
  let flushes = 0;
  const scheduler = {
    async flush() {
      flushes += 1;
      if (flushes === 1) {
        throw new Error("flush failed");
      }
    }
  };
  const receiver = createBoundaryReceiver({ loader, scheduler });

  await assert.rejects(
    receiver.apply({ boundary: "product", seq: 1, html: `<h1>First</h1>` }),
    /flush failed/
  );

  assert.equal(receiver.inspect().boundaries.product.lastSeq, -Infinity);
  assert.equal(document.querySelector("h1").textContent, "First");

  const result = await receiver.apply({ boundary: "product", seq: 1, html: `<h1>Retry</h1>` });

  assert.deepEqual(result, { status: "applied", boundary: "product", seq: 1 });
  assert.equal(receiver.inspect().boundaries.product.lastSeq, 1);
  assert.equal(document.querySelector("h1").textContent, "Retry");
  loader.destroy();
});

test("boundary receiver retries the same seq after redirect failure", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;
  const navigations = [];
  let attempts = 0;
  const router = {
    async navigate(to) {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("redirect failed");
      }
      navigations.push(to);
    }
  };
  const loader = Loader({ root: document.body, router }).start();
  const receiver = createBoundaryReceiver({ loader, router });
  const patch = {
    boundary: "route",
    seq: 1,
    redirect: "/next"
  };

  await assert.rejects(receiver.apply(patch), /redirect failed/);

  assert.equal(receiver.inspect().boundaries.route.lastSeq, -Infinity);

  const result = await receiver.apply(patch);

  assert.deepEqual(result, {
    status: "redirected",
    boundary: "route",
    seq: 1,
    redirect: "/next"
  });
  assert.deepEqual(navigations, ["/next"]);
  assert.equal(receiver.inspect().boundaries.route.lastSeq, 1);
  loader.destroy();
});

test("boundary receiver serializes concurrent same-boundary patches", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;
  const loader = Loader({ root: document.body }).start();
  let releaseFirstFlush;
  let flushes = 0;
  const scheduler = {
    flush() {
      flushes += 1;
      if (flushes === 1) {
        return new Promise((resolve) => {
          releaseFirstFlush = resolve;
        });
      }
      return Promise.resolve();
    }
  };
  const receiver = createBoundaryReceiver({ loader, scheduler });

  const first = receiver.apply({ boundary: "route", seq: 1, html: `<h1>One</h1>` });
  await delay(0);
  const second = receiver.apply({ boundary: "route", seq: 2, html: `<h1>Two</h1>` });
  await delay(0);

  assert.equal(typeof releaseFirstFlush, "function");
  assert.equal(document.querySelector("h1").textContent, "One");
  assert.equal(receiver.inspect().boundaries.route.lastSeq, -Infinity);

  releaseFirstFlush();

  assert.deepEqual(await first, { status: "applied", boundary: "route", seq: 1 });
  assert.deepEqual(await second, { status: "applied", boundary: "route", seq: 2 });
  assert.equal(document.querySelector("h1").textContent, "Two");
  assert.equal(receiver.inspect().boundaries.route.lastSeq, 2);
  loader.destroy();
});

test("boundary receiver allows independent out-of-order boundary patches", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="hero"></section>
    <section async:boundary="reviews"></section>
  `;
  const loader = Loader({ root: document.body }).start();
  const receiver = createBoundaryReceiver({ loader });

  const hero = await receiver.apply({ boundary: "hero", seq: 10, html: `<h1>Hero</h1>` });
  const reviews = await receiver.apply({ boundary: "reviews", seq: 2, html: `<p>Reviews</p>` });

  assert.equal(hero.status, "applied");
  assert.equal(reviews.status, "applied");
  assert.equal(document.querySelector("[async\\:boundary='hero']").textContent, "Hero");
  assert.equal(document.querySelector("[async\\:boundary='reviews']").textContent, "Reviews");
  loader.destroy();
});

test("boundary receiver rescans inserted handlers after swap", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const signals = createSignalRegistry({
    selected: signal(false)
  });
  const handlers = createHandlerRegistry({
    select() {
      this.signals.set("selected", true);
    }
  });
  const loader = Loader({ root: document.body, signals, handlers }).start();
  const receiver = createBoundaryReceiver({ loader });

  await receiver.apply({
    boundary: "product",
    seq: 1,
    html: `<button id="select" on:click="select" signal:class:selected="selected">Select</button>`
  });

  document.querySelector("#select").click();
  await delay(0);

  assert.equal(signals.get("selected"), true);
  assert.equal(document.querySelector("#select").classList.contains("selected"), true);
  loader.destroy();
});

test("boundary receiver flushes scheduled bindings after swap", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <p id="mirror" signal:text="count"></p>
    <section async:boundary="counter"></section>
  `;
  const scheduler = createScheduler({ strategy: "manual" });
  const signals = createSignalRegistry({
    count: signal("old")
  });
  const loader = Loader({ root: document.body, signals, scheduler }).start();
  const receiver = createBoundaryReceiver({ loader, scheduler });

  assert.equal(document.querySelector("#mirror").textContent, "old");
  await receiver.apply({
    boundary: "counter",
    seq: 1,
    signals: {
      count: "new"
    },
    html: `<span>patched</span>`
  });

  assert.equal(document.querySelector("#mirror").textContent, "new");
  loader.destroy();
});

test("boundary receiver redirects through router after effects", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;
  const navigations = [];
  const router = {
    async navigate(to) {
      navigations.push(to);
    }
  };
  const loader = Loader({ root: document.body, router }).start();
  const receiver = createBoundaryReceiver({ loader, router });

  const result = await receiver.apply({
    boundary: "route",
    seq: 1,
    redirect: "/next"
  });

  assert.deepEqual(result, {
    status: "redirected",
    boundary: "route",
    seq: 1,
    redirect: "/next"
  });
  assert.deepEqual(navigations, ["/next"]);
  loader.destroy();
});

test("boundary receiver applies html before reporting redirect", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="route"></section>`;
  const navigations = [];
  const router = {
    async navigate(to) {
      navigations.push({
        to,
        html: document.querySelector("[async\\:boundary='route']").innerHTML
      });
    }
  };
  const loader = Loader({ root: document.body, router }).start();
  const receiver = createBoundaryReceiver({ loader, router });

  const result = await receiver.apply({
    boundary: "route",
    seq: 1,
    html: `<h1>Redirecting</h1>`,
    redirect: "/next"
  });

  assert.equal(result.status, "redirected");
  assert.deepEqual(navigations, [{
    to: "/next",
    html: "<h1>Redirecting</h1>"
  }]);
  loader.destroy();
});

test("boundary receiver returns errored for patch errors by default", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const loader = Loader({ root: document.body }).start();
  let seen;
  const receiver = createBoundaryReceiver({
    loader,
    onError(error) {
      seen = error;
    }
  });

  const result = await receiver.apply({
    boundary: "product",
    seq: 1,
    error: {
      message: "Product failed",
      code: "E_PRODUCT"
    }
  });

  assert.equal(result.status, "errored");
  assert.equal(result.error.message, "Product failed");
  assert.equal(result.error.code, "E_PRODUCT");
  assert.equal(seen, result.error);
  loader.destroy();
});

test("boundary receiver throwOnError throws stable errors and records status", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const loader = Loader({ root: document.body }).start();
  const receiver = createBoundaryReceiver({
    loader,
    throwOnError: true
  });

  await assert.rejects(
    receiver.apply({
      boundary: "product",
      seq: 1,
      error: {
        message: "Product failed",
        code: "E_PRODUCT"
      }
    }),
    (error) => {
      assert.equal(error.message, "Product failed");
      assert.equal(error.code, "E_PRODUCT");
      return true;
    }
  );

  assert.equal(receiver.inspect().boundaries.product.lastStatus, "errored");
  assert.equal(receiver.inspect().boundaries.product.errored, 1);
  loader.destroy();
});

test("boundary receiver throws TypeError for invalid patch shapes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const loader = Loader({ root: document.body }).start();
  const receiver = createBoundaryReceiver({ loader });

  await assert.rejects(
    receiver.apply({ boundary: "product", seq: 1 }),
    {
      name: "TypeError",
      message: /Boundary patch must include/
    }
  );
  await assert.rejects(
    receiver.apply({ boundary: "", seq: 1, html: "x" }),
    {
      name: "TypeError",
      message: /boundary must be a non-empty string/
    }
  );
  await assert.rejects(
    receiver.apply({ boundary: "product", seq: Number.NaN, html: "x" }),
    {
      name: "TypeError",
      message: /seq must be a finite number/
    }
  );
  await assert.rejects(
    receiver.apply({ boundary: "product", seq: 1, signals: [] }),
    {
      name: "TypeError",
      message: /signals must be an object/
    }
  );
  await assert.rejects(
    receiver.apply({ boundary: "product", seq: 1, cache: [] }),
    {
      name: "TypeError",
      message: /cache must be an object/
    }
  );
  await assert.rejects(
    receiver.apply({ boundary: "product", seq: 1, cache: { browser: [] } }),
    {
      name: "TypeError",
      message: /cache\.browser must be an object/
    }
  );
  loader.destroy();
});

test("boundary receiver reset clears sequence state", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="hero"></section>`;
  const loader = Loader({ root: document.body }).start();
  const receiver = createBoundaryReceiver({ loader });

  await receiver.apply({ boundary: "hero", seq: 2, html: `<h1>Second</h1>` });
  assert.equal((await receiver.apply({ boundary: "hero", seq: 1, html: `<h1>First</h1>` })).status, "ignored-stale");

  receiver.reset("hero");
  assert.equal((await receiver.apply({ boundary: "hero", seq: 1, html: `<h1>Reset</h1>` })).status, "applied");
  assert.equal(document.querySelector("h1").textContent, "Reset");
  assert.equal(receiver.inspect().boundaries.hero.lastSeq, 1);
  loader.destroy();
});

test("boundary receiver reset(boundary) removes recent entries only for that boundary", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section async:boundary="hero"></section>
    <section async:boundary="reviews"></section>
  `;
  const loader = Loader({ root: document.body }).start();
  const receiver = createBoundaryReceiver({ loader });

  await receiver.apply({ boundary: "hero", seq: 1, html: `<h1>Hero</h1>` });
  await receiver.apply({ boundary: "reviews", seq: 1, html: `<p>Reviews</p>` });
  await receiver.apply({ boundary: "hero", seq: 0, html: `<h1>Old Hero</h1>` });

  receiver.reset("hero");

  const inspected = receiver.inspect();
  assert.equal(inspected.boundaries.hero, undefined);
  assert.equal(inspected.boundaries.reviews.lastSeq, 1);
  assert.deepEqual(inspected.recent, [{
    boundary: "reviews",
    seq: 1,
    status: "applied"
  }]);
  loader.destroy();
});

test("boundary receiver destroy prevents future apply", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="product"></section>`;
  const loader = Loader({ root: document.body }).start();
  const receiver = createBoundaryReceiver({ loader });

  receiver.destroy();

  await assert.rejects(
    receiver.apply({ boundary: "product", seq: 1, html: "x" }),
    /Boundary receiver has been destroyed/
  );
  loader.destroy();
});

test("boundary receiver ignores child patches when parent scope is destroyed", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="child"></section>`;
  const scheduler = createScheduler({ strategy: "manual" });
  const loader = Loader({ root: document.body, scheduler }).start();
  const receiver = createBoundaryReceiver({ loader, scheduler });

  scheduler.markScopeDestroyed("component.Parent.1");
  const result = await receiver.apply({
    boundary: "child",
    seq: 1,
    parentScope: "component.Parent.1",
    html: `<p>Late child</p>`
  });

  assert.deepEqual(result, {
    status: "ignored-destroyed",
    boundary: "child",
    seq: 1,
    parentScope: "component.Parent.1"
  });
  assert.equal(document.querySelector("[async\\:boundary='child']").textContent, "");
  assert.equal(scheduler.isScopeDestroyed("component.Parent.1"), true);
  loader.destroy();
});
