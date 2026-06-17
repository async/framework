import assert from "node:assert/strict";
import { test } from "node:test";
import { computed, createSignalRegistry, signal } from "../src/index.js";

test("signal registry supports initializer maps, get, set, update, refs, and nested paths", () => {
  const signals = createSignalRegistry({
    count: signal(0),
    product: signal({
      title: "Keyboard",
      inventory: { count: 3 }
    })
  });

  assert.equal(signals.get("count"), 0);
  assert.equal(signals.get("product.title"), "Keyboard");
  assert.equal(signals.get("product.inventory.count"), 3);

  signals.set("count", 1);
  signals.update("product.inventory.count", (count) => count + 4);

  const count = signals.ref("count");
  count.update((value) => value + 1);

  assert.equal(count.value, 2);
  assert.equal(signals.get("product.inventory.count"), 7);
  assert.deepEqual(signals.snapshot().product, {
    title: "Keyboard",
    inventory: { count: 7 }
  });
});

test("ensure creates a signal once and subscribe observes nested changes", () => {
  const signals = createSignalRegistry();
  const settings = signals.ensure("settings", { enabled: false });
  const seen = [];

  const unsubscribe = signals.subscribe("settings.enabled", (value) => {
    seen.push(value);
  });

  settings.set({ enabled: true });
  signals.set("settings.enabled", false);
  unsubscribe();
  signals.set("settings.enabled", true);

  assert.deepEqual(seen, [true, false]);
  assert.equal(signals.ensure("settings", { enabled: "ignored" }).value.enabled, true);
});

test("computed signals update from tracked registry reads", () => {
  const signals = createSignalRegistry({
    count: signal(2),
    doubled: computed(function () {
      return this.signals.get("count") * 2;
    })
  });

  assert.equal(signals.get("doubled"), 4);
  signals.set("count", 4);
  assert.equal(signals.get("doubled"), 8);
});
