import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  createScheduler,
  createServerProxy,
  createServerRegistry,
  createSignalRegistry,
  delay,
  signal
} from "../../src/index.js";

test("async signals track sync reads, abort reruns, and suppress stale completion", async () => {
  const signals = createSignalRegistry({
    productId: signal("a")
  });
  const runs = [];

  signals.asyncSignal("product", async function () {
    const id = this.signals.get("productId");
    runs.push({ id, abort: this.abort, version: this.version });
    await delay(id === "a" ? 30 : 5, this.abort);
    return { id, title: `Product ${id}` };
  });

  await delay(0);
  assert.equal(signals.get("product.$loading"), true);
  assert.equal(runs[0].abort instanceof AbortSignal, true);
  assert.equal(typeof runs[0].abort.cancel, "function");

  signals.set("productId", "b");
  assert.equal(runs[0].abort.aborted, true);

  await delay(40);
  assert.equal(signals.get("product.$status"), "ready");
  assert.equal(signals.get("product.id"), "b");
  assert.equal(signals.get("product.title"), "Product b");
  assert.equal(signals.get("product.$version"), 2);
});

test("async signals expose loading, ready, and error states", async () => {
  const signals = createSignalRegistry();
  signals.asyncSignal("broken", async function () {
    await delay(0, this.abort);
    throw new Error("no product");
  });

  await delay(0);
  assert.equal(signals.get("broken.$loading"), true);

  await delay(5);
  assert.equal(signals.get("broken.$status"), "error");
  assert.equal(signals.get("broken.$loading"), false);
  assert.equal(signals.get("broken.$error").message, "no product");
});

test("async signal snapshots serialize rejected errors with stable public fields", async () => {
  const signals = createSignalRegistry();
  const cause = new Error("Product unavailable");
  cause.code = "PRODUCT_UNAVAILABLE";
  cause.secret = "do not serialize";

  const ref = signals.asyncSignal("product", async function () {
    await delay(0, this.abort);
    throw cause;
  });

  await delay(5);

  assert.equal(ref.error, cause);
  const snapshot = JSON.parse(JSON.stringify(signals._entry("product").snapshot()));

  assert.deepEqual(snapshot, {
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
  assert.equal(Object.hasOwn(snapshot.error, "secret"), false);

  const restored = createSignalRegistry();
  restored.asyncSignal("product", async () => ({ title: "Client Keyboard" }));
  restored._entry("product")._restore(snapshot);

  assert.equal(restored.get("product.$status"), "error");
  assert.equal(restored.get("product.$error.message"), "Product unavailable");
  assert.equal(restored.get("product.$error.code"), "PRODUCT_UNAVAILABLE");
});

test("async signal snapshots normalize non-Error rejections", async () => {
  const signals = createSignalRegistry();
  const ref = signals.asyncSignal("product", async function () {
    await delay(0, this.abort);
    throw "offline";
  });

  await delay(5);

  const snapshot = JSON.parse(JSON.stringify(signals._entry("product").snapshot()));

  assert.deepEqual(snapshot.error, {
    name: "Error",
    message: "offline"
  });
});

test("async signal cancel aborts the native signal", async () => {
  const signals = createSignalRegistry();
  let abort;

  const ref = signals.asyncSignal("slow", async function () {
    abort = this.abort;
    await delay(50, this.abort);
    return "done";
  });

  await delay(0);
  assert.equal(ref.status, "loading");
  assert.equal(ref.loading, true);

  ref.cancel(new Error("manual"));
  await delay(0);

  assert.equal(abort.aborted, true);
  assert.equal(ref.loading, false);
  assert.equal(signals.get("slow.$status"), "idle");
});

test("async signal cancel invalidates non-cooperative fulfillment and settles immediately", async () => {
  const signals = createSignalRegistry();
  const pending = deferred();
  const ref = signals.asyncSignal("slow", function () {
    return pending.promise;
  });

  await delay(0);
  assert.equal(ref.status, "loading");

  let notifications = 0;
  ref.subscribe(() => {
    notifications += 1;
  });

  ref.cancel(new Error("manual"));
  assert.equal(ref.loading, false);
  assert.equal(ref.status, "idle");

  const afterCancelNotifications = notifications;
  pending.resolve("late");
  await delay(0);

  assert.equal(ref.value, undefined);
  assert.equal(ref.status, "idle");
  assert.equal(ref.error, null);
  assert.equal(notifications, afterCancelNotifications);
});

test("async signal cancel invalidates non-cooperative rejection", async () => {
  const signals = createSignalRegistry();
  const pending = deferred();
  const ref = signals.asyncSignal("slow", function () {
    return pending.promise;
  });

  await delay(0);
  ref.cancel(new Error("manual"));
  pending.reject(new Error("late failure"));
  await delay(0);

  assert.equal(ref.value, undefined);
  assert.equal(ref.loading, false);
  assert.equal(ref.status, "idle");
  assert.equal(ref.error, null);
});

test("async signal restore invalidates pending non-cooperative runs", async () => {
  const signals = createSignalRegistry();
  const pending = deferred();
  signals.asyncSignal("product", function () {
    return pending.promise;
  });

  await delay(0);
  signals._entry("product")._restore({
    value: {
      id: "restored"
    },
    loading: false,
    error: null,
    status: "ready",
    version: 1
  });

  pending.resolve({
    id: "late"
  });
  await delay(0);

  assert.equal(signals.get("product.id"), "restored");
  assert.equal(signals.get("product.$status"), "ready");
  assert.equal(signals.get("product.$version"), 1);
});

test("async signal unregister prevents late non-cooperative notifications", async () => {
  const signals = createSignalRegistry();
  const pending = deferred();
  const ref = signals.asyncSignal("slow", function () {
    return pending.promise;
  });

  await delay(0);
  let notifications = 0;
  ref.subscribe(() => {
    notifications += 1;
  });

  assert.equal(signals.unregister("slow"), true);
  pending.resolve("late");
  await delay(0);

  assert.equal(signals.has("slow"), false);
  assert.equal(notifications, 0);
});

test("async signal unregister before scheduler flush cancels queued initial work", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  const signals = createSignalRegistry();
  signals._setContext({ scheduler });
  let calls = 0;

  signals.asyncSignal("slow", async function () {
    calls += 1;
    return "done";
  });

  assert.equal(scheduler.inspect().pending.async, 1);
  assert.equal(signals.unregister("slow"), true);
  await scheduler.flush();

  assert.equal(calls, 0);
  assert.equal(scheduler.inspect().pending.async, 0);
});

test("async signal run abort context is stable and cannot cancel newer runs", async () => {
  const signals = createSignalRegistry({
    productId: signal("a")
  });
  const firstGate = deferred();
  const contexts = [];

  signals.asyncSignal("product", async function () {
    const productId = this.signals.get("productId");
    const record = {
      productId,
      before: this.abort,
      after: null
    };
    contexts.push(record);

    if (productId === "a") {
      await firstGate.promise;
      record.after = this.abort;
      this.abort.cancel(new Error("old run cancel"));
      return { id: productId };
    }

    await delay(10, this.abort);
    record.after = this.abort;
    return { id: productId };
  });

  await delay(0);
  signals.set("productId", "b");
  await delay(0);
  firstGate.resolve();
  await delay(20);

  assert.equal(contexts[0].before, contexts[0].after);
  assert.equal(contexts[1].before, contexts[1].after);
  assert.notEqual(contexts[0].before, contexts[1].before);
  assert.equal(contexts[0].before.aborted, true);
  assert.equal(contexts[1].before.aborted, false);
  assert.equal(signals.get("product.id"), "b");
  assert.equal(signals.get("product.$status"), "ready");
});

test("async signal delayed server calls use the originating run abort signal", async () => {
  const signals = createSignalRegistry({
    productId: signal("sku-1")
  });
  const firstGate = deferred();
  const runAborts = [];
  const serverCalls = [];
  const server = createServerProxy({
    endpoint: "/__async/server",
    signals,
    transport: async (_url, init) => {
      const body = JSON.parse(init.body);
      serverCalls.push({
        id: body.args[0],
        signal: init.signal
      });
      return new Response(
        JSON.stringify(serverEnvelope({
          value: {
            id: body.args[0]
          }
        })),
        {
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }
  });

  signals._setContext({ server });
  signals.asyncSignal("product", async function () {
    const id = this.signals.get("productId");
    runAborts.push({
      id,
      abort: this.abort
    });
    if (id === "sku-1") {
      await firstGate.promise;
    }
    return this.server.products.get(id);
  });

  await delay(0);
  signals.set("productId", "sku-2");
  await delay(0);
  firstGate.resolve();
  await delay(0);

  const firstCall = serverCalls.find((call) => call.id === "sku-1");
  const secondCall = serverCalls.find((call) => call.id === "sku-2");

  assert.equal(firstCall.signal, runAborts.find((run) => run.id === "sku-1").abort);
  assert.equal(secondCall.signal, runAborts.find((run) => run.id === "sku-2").abort);
  assert.notEqual(firstCall.signal, secondCall.signal);
  assert.equal(signals.get("product.id"), "sku-2");
});

test("async signal context exposes this.server from the loader runtime", async () => {
  const window = new Window();
  const signals = createSignalRegistry({
    cartCount: signal(0)
  });
  const server = createServerRegistry({
    "products.get"(id) {
      return serverEnvelope({
        value: {
          id,
          title: "Keyboard"
        },
        signals: {
          cartCount: 1
        }
      });
    }
  });

  signals.asyncSignal("product", async function () {
    return this.server.products.get("sku-1");
  });

  const loader = Loader({ root: window.document, signals, server }).start();
  await delay(5);

  assert.equal(signals.get("product.$status"), "ready");
  assert.equal(signals.get("product.title"), "Keyboard");
  assert.equal(signals.get("cartCount"), 1);

  loader.destroy();
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

test("async signal server proxy calls unwrap values and apply returned effects", async () => {
  const window = new Window();
  const signals = createSignalRegistry({
    cartCount: signal(0)
  });
  const server = createServerProxy({
    endpoint: "/__async/server",
    signals,
    transport: async () => new Response(
      JSON.stringify(serverEnvelope({
        value: {
          id: "sku-1",
          title: "Keyboard"
        },
        signals: {
          cartCount: 2
        }
      })),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    )
  });

  signals.asyncSignal("product", async function () {
    return this.server.products.get("sku-1");
  });

  const loader = Loader({ root: window.document, signals, server }).start();
  await delay(5);

  assert.equal(signals.get("product.$status"), "ready");
  assert.equal(signals.get("product.title"), "Keyboard");
  assert.equal(signals.get("cartCount"), 2);

  loader.destroy();
});

test("async signal server proxy calls receive the active abort signal", async () => {
  const window = new Window();
  const signals = createSignalRegistry({
    productId: signal("sku-1")
  });
  const aborts = [];
  const server = createServerProxy({
    endpoint: "/__async/server",
    signals,
    transport: async (_url, init) => {
      aborts.push(init.signal);
      await delay(aborts.length === 1 ? 30 : 0, init.signal);
      return new Response(
        JSON.stringify(serverEnvelope({
          value: {
            id: signals.get("productId")
          }
        })),
        {
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }
  });

  signals.asyncSignal("product", async function () {
    const id = this.signals.get("productId");
    return this.server.products.get(id);
  });

  const loader = Loader({ root: window.document, signals, server }).start();
  await delay(0);

  signals.set("productId", "sku-2");
  await delay(10);

  assert.equal(aborts[0].aborted, true);
  assert.equal(aborts[1] instanceof AbortSignal, true);
  assert.equal(signals.get("product.$status"), "ready");
  assert.equal(signals.get("product.id"), "sku-2");

  loader.destroy();
});

test("async signal stores normalized server errors with stable messages", async () => {
  const window = new Window();
  const signals = createSignalRegistry();
  const server = createServerProxy({
    endpoint: "/__async/server",
    transport: async () => new Response(
      JSON.stringify(serverEnvelope({
        error: {
          message: "No product",
          code: "NOT_FOUND"
        }
      })),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    )
  });

  signals.asyncSignal("product", async function () {
    return this.server.products.get("missing");
  });

  const loader = Loader({ root: window.document, signals, server }).start();
  await delay(5);

  assert.equal(signals.get("product.$status"), "error");
  assert.equal(signals.get("product.$error").message, "No product");
  assert.equal(signals.get("product.$error").code, "NOT_FOUND");

  loader.destroy();
});

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}
