import assert from "node:assert/strict";
import { test } from "node:test";
import { createHandlerRegistry, createSignalRegistry, signal } from "../src/index.js";

test("handler registry supports initializer maps, chains, tokens, and this binding", async () => {
  const signals = createSignalRegistry({ count: signal(0) });
  const order = [];
  const event = {
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    }
  };

  const handlers = createHandlerRegistry({
    first() {
      order.push(["first", this.signals.get("count")]);
      this.signals.set("count", 1);
    },
    second() {
      order.push(["second", this.signals.get("count")]);
      return "done";
    }
  });

  const results = await handlers.run("first preventDefault, second stopPropagation", {
    signals,
    event
  });

  assert.deepEqual(order, [
    ["first", 0],
    ["second", 1]
  ]);
  assert.deepEqual(results, [undefined, "done"]);
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.propagationStopped, true);
});

test("missing handlers fail with a useful error", async () => {
  const handlers = createHandlerRegistry();

  await assert.rejects(
    handlers.run("missing", {}),
    /Handler "missing" is not registered/
  );
});
