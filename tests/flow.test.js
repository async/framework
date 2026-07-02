import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  can,
  status,
  transition
} from "@async/flow";
import {
  asyncSignal,
  createApp,
  createScheduler,
  defineApp,
  delay,
  flow,
  flowAsyncSignal,
  flowComputed,
  signal
} from "../src/index.js";

test("app.use(\"flow\", entries) mounts Flow signals and handlers into normal registries", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <button id="add" data-id="sku_123" on:click="cart.add($dataset)">Add</button>
    <button id="remove" data-id="sku_123" on:click="cart.remove($dataset)">Remove</button>
    <output id="count" signal:text="cart.count"></output>
  `;
  const app = defineApp();
  const cart = flow({
    store: {
      items: signal([]),
      count: flowComputed(function countItems() {
        return this.items.length;
      })
    },
    on: {
      add(store, input) {
        return {
          items: [...store.items, { id: input.id }]
        };
      },
      remove(store, input) {
        return {
          items: store.items.filter((item) => item.id !== input.id)
        };
      }
    }
  });

  app.use("flow", { cart });
  const runtime = createApp(app, { root: document.body }).start();

  assert.equal(runtime.registry.has("signal", "cart.items"), true);
  assert.equal(runtime.registry.has("signal", "cart.count"), true);
  assert.equal(runtime.registry.has("handler", "cart.add"), true);
  assert.equal(runtime.registry.has("handler", "cart.remove"), true);

  document.querySelector("#add").click();
  await delay(0);

  assert.deepEqual(runtime.signals.get("cart.items"), [{ id: "sku_123" }]);
  assert.equal(document.querySelector("#count").textContent, "1");

  document.querySelector("#remove").click();
  await delay(0);

  assert.deepEqual(runtime.signals.get("cart.items"), []);
  assert.equal(runtime.signals.get("cart.count"), 0);
  runtime.destroy();
});

test("Async.use module shape and framework writes bridge to writable Flow refs", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<output id="count" signal:text="cart.count"></output>`;
  const app = defineApp({
    flow: {
      cart: flow({
        store: {
          items: [],
          count: flowComputed(function countItems() {
            return this.items.length;
          })
        }
      })
    }
  });
  const runtime = createApp(app, { root: document.body }).start();

  runtime.signals.set("cart.items", [{ id: "sku_1" }, { id: "sku_2" }]);
  await delay(0);

  assert.equal(runtime.signals.get("cart.count"), 2);
  assert.equal(document.querySelector("#count").textContent, "2");
  assert.throws(() => runtime.signals.set("cart.count", 99), /read-only/);
  runtime.destroy();
});

test("mounted Flow signals use the framework scheduler for DOM binding work", async () => {
  const window = new Window();
  const { document } = window;
  const scheduler = createScheduler({ strategy: "manual" });
  document.body.innerHTML = `
    <button id="add" on:click="cart.add">Add</button>
    <output id="count" signal:text="cart.count"></output>
  `;
  const app = defineApp({
    flow: {
      cart: flow({
        store: {
          count: 1
        },
        on: {
          add(store) {
            return { count: store.count + 1 };
          }
        }
      })
    }
  });
  const runtime = createApp(app, { root: document.body, scheduler }).start();

  await scheduler.flush();
  assert.equal(document.querySelector("#count").textContent, "1");

  document.querySelector("#add").click();
  assert.equal(runtime.signals.get("cart.count"), 2);
  assert.equal(document.querySelector("#count").textContent, "1");

  await scheduler.flush();
  assert.equal(document.querySelector("#count").textContent, "2");
  runtime.destroy();
});

test("snapshot restore writes Flow writable refs and recomputes computed refs", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<output id="count" signal:text="cart.count"></output>`;
  const app = defineApp({
    flow: {
      cart: flow({
        store: {
          items: [],
          count: flowComputed(function countItems() {
            return this.items.length;
          })
        }
      })
    }
  });
  const runtime = createApp(app, {
    root: document.body,
    snapshot: {
      signals: {
        "cart.items": [{ id: "sku_123" }],
        "cart.count": 99
      }
    }
  }).start();

  await delay(0);

  assert.equal(runtime.signals.get("cart.count"), 1);
  assert.equal(document.querySelector("#count").textContent, "1");
  assert.deepEqual(runtime.signals.snapshot(), {
    "cart.items": [{ id: "sku_123" }],
    "cart.count": 1
  });
  runtime.destroy();
});

test("Flow asyncSignal helper paths mount as value loading error and ready signals", async () => {
  const app = defineApp({
    flow: {
      product: flow({
        store: {
          details: asyncSignal(async () => ({ id: "sku_123" }))
        }
      })
    }
  });
  const runtime = createApp(app).start();

  assert.equal(runtime.signals.get("product.details"), undefined);
  assert.equal(runtime.signals.get("product.details.loading"), false);
  assert.equal(runtime.signals.get("product.details.error"), null);
  assert.equal(runtime.signals.get("product.details.ready"), false);

  await runtime.handlers.run("product.refreshDetails", {});
  await runtime.scheduler.flush();

  assert.deepEqual(runtime.signals.get("product.details"), { id: "sku_123" });
  assert.equal(runtime.signals.get("product.details.loading"), false);
  assert.equal(runtime.signals.get("product.details.error"), null);
  assert.equal(runtime.signals.get("product.details.ready"), true);
  runtime.destroy();
});

test("failed Flow mounts roll back concrete signal and handler bridge entries", () => {
  const app = defineApp({
    signal: {
      "cart.details.loading": signal(false)
    }
  });
  const runtime = createApp(app).start();
  const cart = flow({
    store: {
      details: flowAsyncSignal(async () => ({ id: "sku_123" }))
    },
    on: {
      select() {}
    }
  });

  assert.throws(
    () => app.use("flow", { cart }),
    /Signal "cart\.details\.loading" is already registered/
  );

  assert.equal(runtime.signals.has("cart.details"), false);
  assert.equal(runtime.signals.has("cart.details.loading"), true);
  assert.equal(runtime.handlers.resolve("cart.refreshDetails"), undefined);
  assert.equal(runtime.handlers.resolve("cart.select"), undefined);
  assert.equal(runtime.flows.has("cart"), false);

  const inventory = flow({
    store: {
      count: 0
    },
    on: {
      increment(store) {
        store.count += 1;
      }
    }
  });

  app.use("flow", { inventory });
  assert.equal(runtime.signals.has("inventory.count"), true);
  assert.equal(typeof runtime.handlers.resolve("inventory.increment"), "function");
  runtime.destroy();
});

test("Flow asyncSignal refresh without input uses configured arguments", async () => {
  const calls = [];
  const app = defineApp({
    flow: {
      product: flow({
        store: {
          details: flowAsyncSignal({ arguments: () => ["sku_123"] }, async (id) => {
            calls.push(id);
            return { id };
          })
        }
      })
    }
  });
  const runtime = createApp(app).start();

  await runtime.handlers.run("product.refreshDetails", {});
  await runtime.scheduler.flush();

  assert.deepEqual(calls, ["sku_123"]);
  assert.deepEqual(runtime.signals.get("product.details"), { id: "sku_123" });
  runtime.destroy();
});

test("strict Flow helpers still lower through normal signal and handler registries", async () => {
  const app = defineApp({
    flow: {
      checkout: flow({
        store: {
          step: status("shipping", ["shipping", "payment"]),
          canNext: can("next")
        },
        on: {
          next: transition("step", { shipping: "payment" })
        }
      })
    }
  });
  const runtime = createApp(app).start();

  assert.equal(runtime.registry.has("signal", "checkout.step"), true);
  assert.equal(runtime.registry.has("signal", "checkout.canNext"), true);
  assert.equal(runtime.registry.has("handler", "checkout.next"), true);
  assert.equal(runtime.signals.get("checkout.canNext"), true);

  await runtime.handlers.run("checkout.next", {});
  await runtime.scheduler.flush();

  assert.equal(runtime.signals.get("checkout.step"), "payment");
  assert.equal(runtime.signals.get("checkout.canNext"), false);
  runtime.destroy();
});
