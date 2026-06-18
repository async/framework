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
      return serverEnvelope({ value: 1 });
    },
    async "math.two"() {
      return serverEnvelope({
        value: (await this.server.math.one()) + 1
      });
    }
  });

  assert.equal(await server.run("math.two"), 2);
  assert.equal(await server.math.two(), 2);
});

test("server registry preserves unmarked domain objects with reserved fields", async () => {
  const domain = {
    value: 5,
    unit: "kg",
    signals: "domain",
    cache: "domain",
    error: "domain",
    html: "<strong>domain</strong>",
    boundary: "domain",
    redirect: "/domain"
  };
  const server = createServerRegistry({
    "products.weight"() {
      return domain;
    }
  });

  assert.deepEqual(await server.run("products.weight"), domain);
  assert.deepEqual(await server.products.weight(), domain);
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

test("server registry applies shared envelopes once inside one invocation chain", async () => {
  let writes = 0;
  const signals = {
    get() {
      return undefined;
    },
    set(path, value) {
      writes += 1;
      assert.equal(path, "cartCount");
      assert.equal(value, 1);
    }
  };
  const result = serverEnvelope({
    signals: {
      cartCount: 1
    }
  });
  const server = createServerRegistry({
    "cart.inner"() {
      return result;
    },
    async "cart.outer"() {
      await this.server.cart.inner();
      return result;
    }
  });
  server._setContext({ signals });

  assert.equal(await server.cart.outer(), undefined);
  assert.equal(writes, 1);
  assert.deepEqual(Object.getOwnPropertySymbols(result), []);
});

test("server registry reapplies shared envelopes for independent invocations", async () => {
  let writes = 0;
  const signals = {
    get() {
      return undefined;
    },
    set(path, value) {
      writes += 1;
      assert.equal(path, "cartCount");
      assert.equal(value, 1);
    }
  };
  const result = serverEnvelope({
    signals: {
      cartCount: 1
    }
  });
  const server = createServerRegistry({
    "cart.prime"() {
      return result;
    }
  });
  server._setContext({ signals });

  assert.equal(await server.cart.prime(), undefined);
  assert.equal(await server.cart.prime(), undefined);
  assert.equal(writes, 2);
  assert.deepEqual(Object.getOwnPropertySymbols(result), []);
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
        JSON.stringify(serverEnvelope({
          value: { ok: true },
          signals: {
            cartCount: 4
          }
        })),
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
      JSON.stringify(serverEnvelope({
        boundary: "cart",
        html: "<aside>Cart</aside>"
      })),
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
      JSON.stringify(serverEnvelope({
        value: {
          ok: true,
          signals: {
            status: "wrong"
          }
        },
        signals: {
          status: "right"
        }
      })),
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

test("server proxy preserves unmarked domain objects with reserved fields", async () => {
  const domain = {
    value: 5,
    unit: "kg",
    signals: "domain",
    cache: "domain",
    error: "domain",
    html: "<strong>domain</strong>",
    boundary: "domain",
    redirect: "/domain"
  };
  const server = createServerProxy({
    transport: async () => new Response(JSON.stringify(domain), {
      headers: {
        "content-type": "application/json"
      }
    })
  });

  assert.deepEqual(await server.run("products.weight"), domain);
  assert.deepEqual(await server.products.weight(), domain);
});

test("applyServerResult applies cache-only explicit envelopes", async () => {
  const cache = createCacheRegistry();

  assert.equal(await applyServerResult(serverEnvelope({
    cache: {
      browser: {
        "product:sku-1": { title: "Keyboard" }
      }
    }
  }), { cache }).then(unwrapEnvelope), undefined);

  assert.deepEqual(cache.get("product:sku-1"), { title: "Keyboard" });
});

test("applyServerResult does not mutate extensible explicit envelopes", async () => {
  const signals = createSignalRegistry({
    status: signal("idle")
  });
  const result = serverEnvelope({
    signals: {
      status: "ready"
    }
  });
  const keys = Reflect.ownKeys(result);

  await applyServerResult(result, { signals });

  assert.equal(signals.get("status"), "ready");
  assert.deepEqual(Reflect.ownKeys(result), keys);
});

test("applyServerResult accepts frozen and sealed explicit envelopes", async () => {
  const signals = createSignalRegistry({
    status: signal("idle")
  });
  const frozen = Object.freeze(serverEnvelope({
    signals: {
      status: "ready"
    }
  }));

  await applyServerResult(frozen, { signals });

  assert.equal(signals.get("status"), "ready");
  assert.deepEqual(Object.getOwnPropertySymbols(frozen), []);

  const cache = createCacheRegistry();
  const sealed = Object.seal(serverEnvelope({
    cache: {
      browser: {
        "product:sku-1": { title: "Keyboard" }
      }
    }
  }));

  await applyServerResult(sealed, { cache });

  assert.deepEqual(cache.get("product:sku-1"), { title: "Keyboard" });
  assert.deepEqual(Object.getOwnPropertySymbols(sealed), []);
});

test("server proxy applies cache-only explicit envelopes", async () => {
  const cache = createCacheRegistry();
  const server = createServerProxy({
    cache,
    transport: async () => new Response(
      JSON.stringify(serverEnvelope({
        cache: {
          browser: {
            "product:sku-1": { title: "Keyboard" }
          }
        }
      })),
      {
        headers: {
          "content-type": "application/json"
        }
      }
    )
  });

  assert.equal(await server.products.prime(), undefined);
  assert.deepEqual(cache.get("product:sku-1"), { title: "Keyboard" });
});

test("server error envelopes do not apply signal patches", async () => {
  const signals = createSignalRegistry({
    status: signal("idle")
  });

  await assert.rejects(
    applyServerResult(serverEnvelope({
      error: { message: "server failed" },
      signals: {
        status: "mutated"
      }
    }), { signals }),
    /server failed/
  );

  assert.equal(signals.get("status"), "idle");
});

test("server error envelopes do not restore browser cache", async () => {
  const cache = createCacheRegistry();

  await assert.rejects(
    applyServerResult(serverEnvelope({
      error: { message: "cache failed" },
      cache: {
        browser: {
          "product:sku-1": { title: "Keyboard" }
        }
      }
    }), { cache }),
    /cache failed/
  );

  assert.equal(cache.get("product:sku-1"), undefined);
});

test("server error envelopes do not swap boundary HTML", async () => {
  let swaps = 0;

  await assert.rejects(
    applyServerResult(serverEnvelope({
      error: { message: "boundary failed" },
      boundary: "product",
      html: "<h1>Mutated</h1>"
    }), {
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
    applyServerResult(serverEnvelope({
      error: { message: "redirect failed" },
      redirect: "/login"
    }), {
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

test("server error envelopes throw for each independent invocation without mutation", async () => {
  const signals = createSignalRegistry({
    status: signal("idle")
  });
  const result = Object.freeze(serverEnvelope({
    error: { message: "repeatable" },
    signals: {
      status: "mutated"
    }
  }));

  await assert.rejects(
    applyServerResult(result, { signals }),
    /repeatable/
  );

  await assert.rejects(
    applyServerResult(result, { signals }),
    /repeatable/
  );

  assert.equal(signals.get("status"), "idle");
  assert.deepEqual(Object.getOwnPropertySymbols(result), []);
});

test("server redirect envelopes apply for each independent invocation", async () => {
  const result = Object.freeze(serverEnvelope({
    redirect: "/login"
  }));
  const navigations = [];
  const router = {
    navigate(path) {
      navigations.push(path);
    }
  };

  await applyServerResult(result, { router });
  await applyServerResult(result, { router });

  assert.deepEqual(navigations, ["/login", "/login"]);
  assert.deepEqual(Object.getOwnPropertySymbols(result), []);
});

test("server proxy forwards abort signals to transport", async () => {
  const controller = new AbortController();
  let transportSignal;
  const server = createServerProxy({
    transport: async (_url, init) => {
      transportSignal = init.signal;
      return new Response(JSON.stringify("ok"), {
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
      return new Response(JSON.stringify("ok"), {
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

test("server proxy rejects Map and Set values before transport runs", async () => {
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for non-plain JSON values.");
    }
  });

  await assert.rejects(
    server.run("products.search", [{ filters: new Map([["q", "keyboard"]]) }]),
    /only supports plain objects at \$\.args\[0\]\.filters/
  );
  await assert.rejects(
    server.run("products.search", [{ tags: new Set(["sale"]) }]),
    /only supports plain objects at \$\.args\[0\]\.tags/
  );
});

test("server proxy rejects non-finite numbers before transport runs", async () => {
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for non-finite JSON values.");
    }
  });

  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    await assert.rejects(
      server.run("products.save", [{ price: value }]),
      /does not support non-finite numbers at \$\.args\[0\]\.price/
    );
  }
});

test("server proxy rejects functions and symbols before transport runs", async () => {
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for function or symbol JSON values.");
    }
  });

  await assert.rejects(
    server.run("products.save", [[() => "sku-1"]]),
    /does not support function values at \$\.args\[0\]\[0\]/
  );
  await assert.rejects(
    server.run("products.save", [{ token: Symbol("sku-1") }]),
    /does not support symbol values at \$\.args\[0\]\.token/
  );
});

test("server proxy rejects class instances and Dates before transport runs", async () => {
  class Product {
    constructor(id) {
      this.id = id;
    }
  }
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for class or Date JSON values.");
    }
  });

  await assert.rejects(
    server.run("products.save", [new Product("sku-1")]),
    /only supports plain objects at \$\.args\[0\]/
  );
  await assert.rejects(
    server.run("products.save", [{ createdAt: new Date("2026-06-18T00:00:00Z") }]),
    /only supports plain objects at \$\.args\[0\]\.createdAt/
  );
});

test("server proxy rejects sparse arrays before transport runs", async () => {
  const sparse = [];
  sparse[1] = "sku-1";
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for sparse arrays.");
    }
  });

  await assert.rejects(
    server.run("products.save", [sparse]),
    /does not support sparse arrays at \$\.args\[0\]\[0\]/
  );
});

test("server proxy rejects undefined values before transport runs", async () => {
  const server = createServerProxy({
    transport() {
      throw new Error("transport should not run for undefined JSON values.");
    }
  });

  await assert.rejects(
    server.run("products.save", [undefined]),
    /does not support undefined values at \$\.args\[0\]/
  );
  await assert.rejects(
    server.run("products.save", [], {
      input: {
        omitted: undefined,
        kept: true
      }
    }),
    /does not support undefined values at \$\.input\.omitted/
  );
});

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}

function unwrapEnvelope(result) {
  return Object.hasOwn(result, "value") ? result.value : undefined;
}
