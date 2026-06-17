import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createHandlerRegistry,
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

test("server proxy envelopes are applied once through namespace and handler callers", async () => {
  let swaps = 0;
  const server = createServerProxy({
    fetch: async () => new Response(
      JSON.stringify({
        boundary: "cart",
        html: "<aside>Cart</aside>"
      }),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    ),
    loader: {
      swap(boundary, html) {
        swaps += 1;
        assert.equal(boundary, "cart");
        assert.equal(html, "<aside>Cart</aside>");
      }
    }
  });

  await server.cart.refresh();
  assert.equal(swaps, 1);

  const handlers = createHandlerRegistry();
  await handlers.run("server.cart.refresh()", {
    server
  });

  assert.equal(swaps, 2);
});

test("server proxy does not apply unwrapped envelope-shaped values as effects", async () => {
  const signals = createSignalRegistry({
    status: signal("idle")
  });
  const server = createServerProxy({
    signals,
    fetch: async () => new Response(
      JSON.stringify({
        value: {
          ok: true,
          signals: {
            status: "wrong"
          }
        },
        signals: {
          status: "right"
        }
      }),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    )
  });

  const handlers = createHandlerRegistry();
  const results = await handlers.run("server.product.load()", {
    server,
    signals
  });

  assert.deepEqual(results, [{
    ok: true,
    signals: {
      status: "wrong"
    }
  }]);
  assert.equal(signals.get("status"), "right");
});

test("server proxy forwards abort signals to fetch", async () => {
  const controller = new AbortController();
  let fetchSignal;
  const server = createServerProxy({
    fetch: async (_url, init) => {
      fetchSignal = init.signal;
      return new Response(JSON.stringify({ value: "ok" }), {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  assert.equal(await server.run("products.get", [], { abort: controller.signal }), "ok");
  assert.equal(fetchSignal, controller.signal);
});

test("server proxy rejects file-like values instead of silently JSON stringifying them", async () => {
  const fileLike = {
    [Symbol.toStringTag]: "File",
    name: "avatar.png"
  };
  const server = createServerProxy({
    fetch() {
      throw new Error("fetch should not run for unsupported JSON values.");
    }
  });

  await assert.rejects(
    server.run("profile.upload", [fileLike]),
    /does not support File, Blob, or FormData/
  );
});
