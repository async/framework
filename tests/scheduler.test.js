import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  component,
  createScheduler,
  createSignalRegistry,
  delay,
  html,
  signal
} from "../src/index.js";

test("scheduler flushes phases in deterministic order and runs post callbacks last", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  const seen = [];

  scheduler.enqueue("effect", () => seen.push("effect"));
  scheduler.enqueue("binding", () => seen.push("binding"));
  scheduler.enqueue("async", () => seen.push("async"));
  scheduler.afterFlush(() => seen.push("post"));
  scheduler.enqueue("lifecycle", () => seen.push("lifecycle"));

  await scheduler.flush();

  assert.deepEqual(seen, ["binding", "lifecycle", "effect", "async", "post"]);
});

test("scheduler dedupes keyed jobs in the same phase and scope", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  let runs = 0;

  scheduler.enqueue("binding", () => {
    runs += 1;
  }, { key: "text" });
  scheduler.enqueue("binding", () => {
    runs += 1;
  }, { key: "text" });

  await scheduler.flush();

  assert.equal(runs, 1);
});

test("scheduler tracks destroyed object scopes weakly and can revive scopes", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  const objectScope = {};
  const seen = [];

  scheduler.markScopeDestroyed(objectScope);
  scheduler.markScopeDestroyed("component.scope");

  assert.equal(scheduler.isScopeDestroyed(objectScope), true);
  assert.equal(scheduler.isScopeDestroyed("component.scope"), true);
  assert.equal(scheduler.inspect().scopesDestroyed, 1);

  scheduler.enqueue("binding", () => {
    seen.push("blocked-object");
  }, { scope: objectScope });
  scheduler.enqueue("binding", () => {
    seen.push("blocked-primitive");
  }, { scope: "component.scope" });
  await scheduler.flush();
  assert.deepEqual(seen, []);

  scheduler.reviveScope(objectScope);
  scheduler.reviveScope("component.scope");

  assert.equal(scheduler.isScopeDestroyed(objectScope), false);
  assert.equal(scheduler.isScopeDestroyed("component.scope"), false);
  assert.equal(scheduler.inspect().scopesDestroyed, 0);

  scheduler.enqueue("binding", () => {
    seen.push("object");
  }, { scope: objectScope });
  scheduler.enqueue("binding", () => {
    seen.push("primitive");
  }, { scope: "component.scope" });
  await scheduler.flush();

  assert.deepEqual(seen, ["object", "primitive"]);
});

test("manual scheduler keeps signal reads synchronous while delaying DOM bindings", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<span signal:text="count"></span>`;

  const scheduler = createScheduler({ strategy: "manual" });
  const signals = createSignalRegistry({
    count: signal("zero")
  });
  const loader = Loader({ root: document.body, signals, scheduler }).start();

  signals.set("count", "three");

  assert.equal(signals.get("count"), "three");
  assert.equal(document.querySelector("span").textContent, "zero");

  await scheduler.flush();

  assert.equal(document.querySelector("span").textContent, "three");
  loader.destroy();
});

test("component cleanup cancels pending scoped effect jobs", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<main id="app"></main>`;

  const scheduler = createScheduler({ strategy: "manual" });
  const seen = [];
  let flag;

  const Scoped = component(function Scoped() {
    flag = this.signal("flag", false);
    this.effect(() => {
      seen.push(flag.value);
    });
    return html`<button>Scoped</button>`;
  });

  const loader = Loader({ root: document.body, scheduler });
  loader.mount(document.querySelector("#app"), Scoped);

  assert.deepEqual(seen, [false]);

  flag.set(true);
  loader.destroy();
  await scheduler.flush();

  assert.deepEqual(seen, [false]);
});

test("async signal dependency refreshes run through the async phase", async () => {
  const window = new Window();
  const scheduler = createScheduler({ strategy: "manual" });
  const signals = createSignalRegistry({
    productId: signal("sku-1")
  });
  const loader = Loader({ root: window.document, signals, scheduler }).start();
  const runs = [];

  signals.asyncSignal("product", async function () {
    const id = this.signals.get("productId");
    runs.push(id);
    return { id };
  });

  assert.deepEqual(runs, []);
  await scheduler.flush();
  assert.deepEqual(runs, ["sku-1"]);

  signals.set("productId", "sku-2");
  assert.deepEqual(runs, ["sku-1"]);

  await scheduler.flush();
  assert.deepEqual(runs, ["sku-1", "sku-2"]);
  assert.equal(signals.get("product.id"), "sku-2");

  loader.destroy();
});

test("scheduler runs jobs enqueued during the current flush before completing", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  const seen = [];

  scheduler.enqueue("binding", () => {
    seen.push("outer");
    scheduler.enqueue("binding", () => {
      seen.push("inner");
    });
  });

  await scheduler.flush();

  assert.deepEqual(seen, ["outer", "inner"]);
});

test("scheduler does not starve jobs when a job calls flush", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  const seen = [];

  scheduler.enqueue("binding", async () => {
    seen.push("outer");
    scheduler.enqueue("binding", () => {
      seen.push("inner");
    });
    await scheduler.flush();
    seen.push("nested-flush-returned");
  });

  await scheduler.flush();

  assert.deepEqual(seen, ["outer", "nested-flush-returned", "inner"]);
});

test("scheduler preserves phase order for nested future-phase jobs", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  const seen = [];

  scheduler.enqueue("binding", () => {
    seen.push("binding");
    scheduler.enqueue("lifecycle", () => {
      seen.push("lifecycle");
    });
    scheduler.enqueue("effect", () => {
      seen.push("effect");
    });
  });
  scheduler.afterFlush(() => {
    seen.push("post");
  });

  await scheduler.flush();

  assert.deepEqual(seen, ["binding", "lifecycle", "effect", "post"]);
});

test("scheduler onError receives job metadata and flush continues", async () => {
  const scope = {};
  const failures = [];
  const seen = [];
  const scheduler = createScheduler({
    strategy: "manual",
    onError(error, job) {
      failures.push({ error, job });
    }
  });
  const expected = new Error("effect failed");

  scheduler.enqueue("effect", () => {
    throw expected;
  }, {
    scope,
    boundary: "product",
    key: "failing-effect"
  });
  scheduler.afterFlush(() => {
    seen.push("post");
  });

  await scheduler.flush();

  assert.equal(failures.length, 1);
  assert.equal(failures[0].error, expected);
  assert.equal(failures[0].job.phase, "effect");
  assert.equal(failures[0].job.scope, scope);
  assert.equal(failures[0].job.boundary, "product");
  assert.equal(typeof failures[0].job.id, "number");
  assert.deepEqual(seen, ["post"]);
});

test("scheduler maxDepth catches runaway enqueue loops", async () => {
  const scheduler = createScheduler({ strategy: "manual", maxDepth: 2 });

  const loop = () => scheduler.enqueue("post", loop);
  scheduler.enqueue("post", loop);

  await assert.rejects(
    scheduler.flush(),
    /Scheduler exceeded maxDepth 2/
  );
});

test("microtask scheduler flushes automatically", async () => {
  const scheduler = createScheduler();
  let flushed = false;

  scheduler.enqueue("binding", () => {
    flushed = true;
  });

  assert.equal(flushed, false);
  await delay(0);
  assert.equal(flushed, true);
});
