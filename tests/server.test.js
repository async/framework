import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyServerResult,
  createCacheRegistry,
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

test("nested server calls preserve request context", async () => {
  const requestContext = createRequestContextStore();
  const server = createServerRegistry({
    "request.inner"() {
      return {
        header: this.headers.trace,
        cookie: this.cookies.session,
        local: this.locals.id
      };
    },
    async "request.outer"() {
      return this.server.request.inner();
    }
  });
  server._setContext({ requestContext });

  const result = await requestContext.run({
    headers: { trace: "trace-1" },
    cookies: { session: "session-1" },
    locals: { id: "local-1" }
  }, () => server.request.outer());

  assert.deepEqual(result, {
    header: "trace-1",
    cookie: "session-1",
    local: "local-1"
  });
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

test("server error envelopes do not apply signal patches", async () => {
  const signals = createSignalRegistry({
    status: signal("idle")
  });

  await assert.rejects(
    applyServerResult({
      error: { message: "server failed" },
      signals: {
        status: "mutated"
      }
    }, { signals }),
    /server failed/
  );

  assert.equal(signals.get("status"), "idle");
});

test("server error envelopes do not restore browser cache", async () => {
  const cache = createCacheRegistry();

  await assert.rejects(
    applyServerResult({
      error: { message: "cache failed" },
      cache: {
        browser: {
          "product:sku-1": { title: "Keyboard" }
        }
      }
    }, { cache }),
    /cache failed/
  );

  assert.equal(cache.get("product:sku-1"), undefined);
});

test("server error envelopes do not swap boundary HTML", async () => {
  let swaps = 0;

  await assert.rejects(
    applyServerResult({
      error: { message: "boundary failed" },
      boundary: "product",
      html: "<h1>Mutated</h1>"
    }, {
      loader: {
        swap() {
          swaps += 1;
        }
      }
    }),
    /boundary failed/
  );

  assert.equal(swaps, 0);
});

test("server error envelopes do not redirect", async () => {
  let redirects = 0;

  await assert.rejects(
    applyServerResult({
      error: { message: "redirect failed" },
      redirect: "/login"
    }, {
      router: {
        navigate() {
          redirects += 1;
        }
      }
    }),
    /redirect failed/
  );

  assert.equal(redirects, 0);
});

test("server error envelopes are consumed before throwing", async () => {
  const signals = createSignalRegistry({
    status: signal("idle")
  });
  const result = {
    error: { message: "only once" },
    signals: {
      status: "mutated"
    }
  };

  await assert.rejects(
    applyServerResult(result, { signals }),
    /only once/
  );

  assert.equal(await applyServerResult(result, { signals }), result);
  assert.equal(signals.get("status"), "idle");
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

test("server proxy transport returning undefined throws an Async-specific error", async () => {
  const server = createServerProxy({
    transport: async () => undefined
  });

  await assert.rejects(
    server.run("products.get"),
    /transport returned an invalid response: expected a fetch Response-like object/
  );
});

test("server proxy transport returning object without ok throws an Async-specific error", async () => {
  const server = createServerProxy({
    transport: async () => ({
      headers: new Headers(),
      json: async () => ({ value: "ok" })
    })
  });

  await assert.rejects(
    server.run("products.get"),
    /transport returned an invalid response: missing boolean ok/
  );
});

test("server proxy transport returning JSON content-type but invalid JSON throws an Async-specific error", async () => {
  const server = createServerProxy({
    transport: async () => new Response("{nope", {
      headers: {
        "content-type": "application/json"
      }
    })
  });

  await assert.rejects(
    server.run("products.get"),
    /returned invalid JSON/
  );
});

test("server proxy handles 204 no-content responses as undefined values", async () => {
  const server = createServerProxy({
    transport: async () => new Response(null, {
      status: 204
    })
  });

  assert.equal(await server.run("products.delete"), undefined);
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

test("server proxy rejects unsupported Web platform values before transport runs", async () => {
  const unsupported = [
    new URLSearchParams("q=keyboard"),
    new Headers(),
    new Request("http://app.test/products"),
    new Response("ok"),
    new ReadableStream(),
    new ArrayBuffer(8),
    new Uint8Array([1, 2, 3])
  ];
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for unsupported JSON values.");
    }
  });

  for (const value of unsupported) {
    await assert.rejects(
      server.run("products.save", [value]),
      /does not support URLSearchParams, Headers, Request, Response, ReadableStream, ArrayBuffer, or typed array values/
    );
  }
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
