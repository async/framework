import assert from "node:assert/strict";
import { test } from "node:test";
import { createCacheRegistry, defineCache } from "../src/index.js";

test("cache registry supports definitions, get, set, getOrSet, delete, and clear", async () => {
  let clock = 0;
  const cache = createCacheRegistry({
    product: defineCache({ ttl: 10 })
  }, {
    now: () => clock
  });
  let loads = 0;

  cache.set("product:1", { id: 1 });
  assert.deepEqual(cache.get("product:1"), { id: 1 });

  clock = 11;
  assert.equal(cache.get("product:1"), undefined);

  const first = await cache.getOrSet("product:2", async () => {
    loads += 1;
    return { id: 2 };
  });
  const second = await cache.getOrSet("product:2", async () => {
    loads += 1;
    return { id: 3 };
  });

  assert.deepEqual(first, { id: 2 });
  assert.deepEqual(second, { id: 2 });
  assert.equal(loads, 1);

  cache.delete("product:2");
  assert.equal(cache.get("product:2"), undefined);

  cache.set("cart:1", "a");
  cache.set("cart:2", "b");
  cache.clear("cart:");
  assert.equal(cache.get("cart:1"), undefined);
  assert.equal(cache.get("cart:2"), undefined);
});

test("cache registry snapshots and restores browser-safe entries", () => {
  const cache = createCacheRegistry();
  cache.set("product:1", { title: "Keyboard" });

  const restored = createCacheRegistry();
  restored.restore(cache.snapshot());

  assert.deepEqual(restored.get("product:1"), { title: "Keyboard" });
});
