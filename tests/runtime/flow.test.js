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
  flowSignal,
  signal
} from "../../src/index.js";

test("app.use(\"flow\", entries) attaches Flow signals and handlers into normal registries", async () => {
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

test("attached Flow signals use the framework scheduler for DOM binding work", async () => {
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

test("Flow asyncSignal helper paths attach as value loading error and ready signals", async () => {
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

test("failed Flow attaches roll back concrete signal and handler bridge entries", () => {
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

test("@async/framework/flow re-exports the full @async/flow helper surface", async () => {
  const [flowEntry, coreHelpers, composeHelpers] = await Promise.all([
    import("../../src/flow-entry.js"),
    import("@async/flow/helpers/core"),
    import("@async/flow/compose")
  ]);

  const stepHelperNames = [
    "set",
    "dispatch",
    "after",
    "update",
    "bool",
    "every",
    "some",
    "not",
    "when",
    "branch",
    "onError",
    "guard",
    "transition",
    "can",
    "matches",
    "inspect"
  ];

  for (const name of stepHelperNames) {
    assert.equal(
      flowEntry[name],
      coreHelpers[name],
      `expected the flow entry to re-export the @async/flow "${name}" helper`
    );
  }

  assert.equal(flowEntry.compose, composeHelpers.compose);
  assert.equal(flowEntry.parallel, composeHelpers.parallel);
  assert.equal(flowEntry.remember, composeHelpers.remember);
  assert.equal(typeof flowEntry.flowStatus, "function");

  const stepDeclaration = flowEntry.flowStatus("draft", ["draft", "submitted"]);
  assert.equal(stepDeclaration.type, "async.flow.status");
  assert.deepEqual(stepDeclaration.allowed, ["draft", "submitted"]);
});

test("flow helpers imported from the framework author a full flow without installing @async/flow", async () => {
  const {
    can: entryCan,
    compose: entryCompose,
    flow: entryFlow,
    flowStatus,
    guard: entryGuard,
    matches: entryMatches,
    transition: entryTransition,
    update: entryUpdate,
    when: entryWhen
  } = await import("../../src/flow-entry.js");

  const app = defineApp({
    flow: {
      order: entryFlow({
        store: {
          step: flowStatus("draft", ["draft", "submitted", "confirmed"]),
          attempts: signal(0),
          isDraft: entryMatches("step", "draft"),
          canSubmit: entryCan("submit")
        },
        on: {
          submit: entryCompose([
            entryWhen(entryMatches("step", "draft")),
            entryUpdate("attempts", (count) => count + 1),
            entryTransition("step", { draft: "submitted" })
          ]),
          confirm: entryGuard(
            entryMatches("step", "submitted"),
            entryTransition("step", { submitted: "confirmed" })
          )
        }
      })
    }
  });
  const runtime = createApp(app).start();

  assert.equal(runtime.registry.has("signal", "order.step"), true);
  assert.equal(runtime.registry.has("signal", "order.isDraft"), true);
  assert.equal(runtime.registry.has("signal", "order.canSubmit"), true);
  assert.equal(runtime.registry.has("handler", "order.submit"), true);
  assert.equal(runtime.registry.has("handler", "order.confirm"), true);
  assert.equal(runtime.signals.get("order.step"), "draft");
  assert.equal(runtime.signals.get("order.isDraft"), true);
  assert.equal(runtime.signals.get("order.canSubmit"), true);

  await runtime.handlers.run("order.submit", {});
  await runtime.scheduler.flush();

  assert.equal(runtime.signals.get("order.step"), "submitted");
  assert.equal(runtime.signals.get("order.attempts"), 1);
  assert.equal(runtime.signals.get("order.isDraft"), false);
  assert.equal(runtime.signals.get("order.canSubmit"), false);

  await runtime.handlers.run("order.submit", {});
  await runtime.scheduler.flush();

  assert.equal(runtime.signals.get("order.step"), "submitted");
  assert.equal(runtime.signals.get("order.attempts"), 1);

  await runtime.handlers.run("order.confirm", {});
  await runtime.scheduler.flush();

  assert.equal(runtime.signals.get("order.step"), "confirmed");
  runtime.destroy();
});

test("installFlow adds the flow feature to a base app hub", async () => {
  const [baseApp, flowEntry] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/flow-entry.js")
  ]);

  const bare = baseApp.defineApp();
  bare.use("flow", { cart: flow({ store: { count: 0 } }) });
  assert.throws(
    () => baseApp.createApp(bare).start(),
    /Flow usage requires the @async\/framework\/flow entrypoint\./
  );

  const hub = baseApp.defineApp();
  assert.equal(flowEntry.installFlow(hub), hub);
  hub.use("flow", { cart: flow({ store: { count: 3 } }) });
  const runtime = baseApp.createApp(hub).start();

  assert.equal(runtime.signals.get("cart.count"), 3);
  runtime.destroy();

  assert.throws(
    () => flowEntry.installFlow({}),
    /installFlow\(app\) requires an Async app created by @async\/framework\./
  );
});

test("flow-entry createApp and defineApp install the flow feature and merge extra features", async () => {
  const [baseApp, flowEntry] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/flow-entry.js")
  ]);

  const bare = baseApp.defineApp();
  bare.use("flow", { counter: flow({ store: { count: 1 } }) });
  const bareRuntime = flowEntry.createApp(bare).start();

  assert.equal(bareRuntime.signals.get("counter.count"), 1);
  bareRuntime.destroy();

  const hub = flowEntry.defineApp(undefined, {
    features: {
      flow: {},
      router: {}
    }
  });
  hub.use("flow", { counter: flow({ store: { count: 2 } }) });
  const runtime = flowEntry.createApp(hub, { features: { router: {} } }).start();

  assert.equal(runtime.signals.get("counter.count"), 2);
  runtime.destroy();
});

test("the Flow scheduler bridge enqueues keyless binding jobs and no notification is dropped", async () => {
  const scheduler = createScheduler({ strategy: "manual" });
  const enqueueCalls = [];
  const baseEnqueue = scheduler.enqueue.bind(scheduler);
  scheduler.enqueue = (phase, fn, options = {}) => {
    enqueueCalls.push({ phase, key: options.key });
    return baseEnqueue(phase, fn, options);
  };

  const app = defineApp({
    flow: {
      cart: flow({
        store: {
          count: 0
        },
        on: {
          inc(store) {
            return { count: store.count + 1 };
          }
        }
      })
    }
  });
  const runtime = createApp(app, { scheduler }).start();

  for (let round = 1; round <= 3; round += 1) {
    await runtime.handlers.run("cart.inc", {});
    await scheduler.flush();
    assert.equal(runtime.signals.get("cart.count"), round, `dispatch ${round} must not be dropped`);
  }

  const bindingEnqueues = enqueueCalls.filter((call) => call.phase === "binding");
  assert.ok(bindingEnqueues.length >= 3, "each flushed dispatch enqueues its own notification");
  assert.ok(
    bindingEnqueues.every((call) => call.key === undefined),
    "Flow bridge notifications must not carry dedupe keys"
  );
  runtime.destroy();
});

test("async signal metadata bridge paths are read-only and flowSignal declarations attach writable", async () => {
  const app = defineApp({
    flow: {
      product: flow({
        store: {
          name: flowSignal("flow"),
          details: flowAsyncSignal(async () => ({ id: "sku_123" }))
        }
      })
    }
  });
  const runtime = createApp(app).start();

  assert.throws(
    () => runtime.signals.set("product.details.loading", true),
    /Flow signal "product\.details\.loading" is read-only\./
  );
  assert.throws(
    () => runtime.signals.set("product.details.status", "ready"),
    /read-only/
  );

  runtime.signals.set("product.name", "framework");
  assert.equal(runtime.signals.get("product.name"), "framework");
  runtime.destroy();
});
