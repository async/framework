import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  createServerProxy,
  createServerRegistry,
  createSignalRegistry,
  delay,
  signal
} from "../src/index.js";

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

test("async signal context exposes this.server from the loader runtime", async () => {
  const window = new Window();
  const signals = createSignalRegistry({
    cartCount: signal(0)
  });
  const server = createServerRegistry({
    "products.get"(id) {
      return {
        value: {
          id,
          title: "Keyboard"
        },
        signals: {
          cartCount: 1
        }
      };
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

test("async signal server proxy calls unwrap values and apply returned effects", async () => {
  const window = new Window();
  const signals = createSignalRegistry({
    cartCount: signal(0)
  });
  const server = createServerProxy({
    endpoint: "/__async/server",
    signals,
    transport: async () => new Response(
      JSON.stringify({
        value: {
          id: "sku-1",
          title: "Keyboard"
        },
        signals: {
          cartCount: 2
        }
      }),
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
        JSON.stringify({
          value: {
            id: signals.get("productId")
          }
        }),
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
      JSON.stringify({
        error: {
          message: "No product",
          code: "NOT_FOUND"
        }
      }),
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
