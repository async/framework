import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createServerProxy,
  createServerRegistry,
  createSignalRegistry,
  signal
} from "../src/index.js";

test("server registry runs functions with this.server for local fan-out", async () => {
  const server = createServerRegistry({
    "math.one"() {
      return { value: 1 };
    },
    async "math.two"() {
      return {
        value: (await this.server.math.one()) + 1
      };
    }
  });

  assert.deepEqual(await server.run("math.two"), { value: 2 });
  assert.equal(await server.math.two(), 2);
});

test("server proxy posts args, input, signals, and applies returned signal patches", async () => {
  const signals = createSignalRegistry({
    productId: signal("sku-1"),
    cartCount: signal(0)
  });
  let requestUrl;
  let requestBody;

  const server = createServerProxy({
    endpoint: "/__async/server",
    signals,
    fetch: async (url, init) => {
      requestUrl = url;
      requestBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          value: { ok: true },
          signals: {
            cartCount: 4
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }
  });

  const value = await server.run("cart.add", ["sku-1"], {
    input: { quantity: 2 },
    signalPaths: ["productId"]
  });

  assert.equal(requestUrl, "/__async/server/cart.add");
  assert.deepEqual(requestBody, {
    args: ["sku-1"],
    input: { quantity: 2 },
    signals: {
      productId: "sku-1"
    }
  });
  assert.deepEqual(value, { ok: true });
  assert.equal(signals.get("cartCount"), 4);
});
