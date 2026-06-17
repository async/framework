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

test("cache getOrSet dedupes concurrent fills", async () => {
  const cache = createCacheRegistry();
  let calls = 0;
  let resolveFill;
  const fill = new Promise((resolve) => {
    resolveFill = resolve;
  });

  const first = cache.getOrSet("product:3", async () => {
    calls += 1;
    return fill;
  });
  const second = cache.getOrSet("product:3", async () => {
    calls += 1;
    return { id: 3, duplicate: true };
  });

  resolveFill({ id: 3 });

  assert.deepEqual(await first, { id: 3 });
  assert.deepEqual(await second, { id: 3 });
  assert.equal(calls, 1);
  assert.deepEqual(cache.get("product:3"), { id: 3 });
});

test("cache delete prevents pending fills from repopulating entries", async () => {
  const cache = createCacheRegistry();
  let resolveFill;
  const first = cache.getOrSet("product:4", () => new Promise((resolve) => {
    resolveFill = resolve;
  }));

  await Promise.resolve();
  cache.delete("product:4");
  resolveFill({ id: 4 });

  assert.deepEqual(await first, { id: 4 });
  assert.equal(cache.get("product:4"), undefined);
});

test("cache clear prefix prevents matching pending fills from repopulating entries", async () => {
  const cache = createCacheRegistry();
  let resolveProduct;
  let resolveCart;
  const product = cache.getOrSet("product:5", () => new Promise((resolve) => {
    resolveProduct = resolve;
  }));
  const cart = cache.getOrSet("cart:5", () => new Promise((resolve) => {
    resolveCart = resolve;
  }));

  await Promise.resolve();
  cache.clear("product:");
  resolveProduct({ id: 5 });
  resolveCart({ id: 5, kind: "cart" });

  assert.deepEqual(await product, { id: 5 });
  assert.deepEqual(await cart, { id: 5, kind: "cart" });
  assert.equal(cache.get("product:5"), undefined);
  assert.deepEqual(cache.get("cart:5"), { id: 5, kind: "cart" });
});

test("cache registry snapshots and restores browser-safe entries", () => {
  const cache = createCacheRegistry();
  cache.set("product:1", { title: "Keyboard" });

  const restored = createCacheRegistry();
  restored.restore(cache.snapshot());

  assert.deepEqual(restored.get("product:1"), { title: "Keyboard" });
});
