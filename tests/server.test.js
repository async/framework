import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRequestContextStore,
  createHandlerRegistry,
  createServerProxy,
  createServerRegistry,
  createSignalRegistry,
  delay,
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

test("server request context store isolates overlapping async calls", async () => {
  const requestContext = createRequestContextStore();
  const server = createServerRegistry({
    async "request.id"() {
      await delay(1);
      return this.locals.id;
    }
  });
  server._setContext({ requestContext });

  const [left, right] = await Promise.all([
    requestContext.run({ locals: { id: "left" } }, () => server.request.id()),
    requestContext.run({ locals: { id: "right" } }, () => server.request.id())
  ]);

  assert.equal(left, "left");
  assert.equal(right, "right");
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
    transport: async (url, init) => {
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
    transport: async () => new Response(
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
    transport: async () => new Response(
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

test("server proxy forwards abort signals to transport", async () => {
  const controller = new AbortController();
  let transportSignal;
  const server = createServerProxy({
    transport: async (_url, init) => {
      transportSignal = init.signal;
      return new Response(JSON.stringify({ value: "ok" }), {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  assert.equal(await server.run("products.get", [], { abort: controller.signal }), "ok");
  assert.equal(transportSignal, controller.signal);
});

test("server proxy rejects file-like values instead of silently JSON stringifying them", async () => {
  const fileLike = {
    [Symbol.toStringTag]: "File",
    name: "avatar.png"
  };
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for unsupported JSON values.");
    }
  });

  await assert.rejects(
    server.run("profile.upload", [fileLike]),
    /does not support File, Blob, or FormData/
  );
});

test("server proxy rejects circular args before transport runs", async () => {
  const circular = {};
  circular.self = circular;
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for circular JSON values.");
    }
  });

  await assert.rejects(
    server.run("products.save", [circular]),
    /does not support circular values/
  );
});

test("server proxy rejects circular input before transport runs", async () => {
  const input = {};
  input.self = input;
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for circular JSON input.");
    }
  });

  await assert.rejects(
    server.run("products.save", [], { input }),
    /does not support circular values/
  );
});

test("server proxy allows repeated non-circular references", async () => {
  const shared = { id: "sku-1" };
  let requestBody;
  const server = createServerProxy({
    transport: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ value: "ok" }), {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  assert.equal(await server.run("products.save", [shared, shared]), "ok");
  assert.deepEqual(requestBody.args, [{ id: "sku-1" }, { id: "sku-1" }]);
});

test("server proxy rejects nested file-like values before transport runs", async () => {
  const blobLike = {
    [Symbol.toStringTag]: "Blob"
  };
  const formDataLike = {
    [Symbol.toStringTag]: "FormData"
  };
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for nested unsupported JSON values.");
    }
  });

  await assert.rejects(
    server.run("profile.upload", [{ files: [blobLike], form: formDataLike }]),
    /does not support File, Blob, or FormData/
  );
});

test("server proxy rejects BigInt values with an Async-specific error", async () => {
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for BigInt JSON values.");
    }
  });

  await assert.rejects(
    server.run("products.save", [{ id: 1n }]),
    /does not support BigInt values/
  );
});

test("server proxy preserves current JSON undefined handling", async () => {
  let requestBody;
  const server = createServerProxy({
    transport: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ value: "ok" }), {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  assert.equal(await server.run("products.save", [undefined], {
    input: {
      omitted: undefined,
      kept: true
    }
  }), "ok");
  assert.deepEqual(requestBody.args, [null]);
  assert.deepEqual(requestBody.input, { kept: true });
});
