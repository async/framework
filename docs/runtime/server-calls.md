# Server Calls & Cache

Server functions and cache declarations share one explicit boundary: browser code calls named server functions only through a supplied transport, and server cache contents never serialize into browser snapshots.

## Server Calls

Server registries run locally on the server. Browser proxies use an explicit
transport supplied by the app, so network access is opt-in. Both expose the same
dotted call shape.

```js
import {
  createServerRegistry
} from "@async/framework/server";

const server = createServerRegistry({
  "cart.add"(productId, quantity) {
    return {
      __async_server_result__: 1,
      value: { ok: true },
      signals: {
        cartCount: 3
      }
    };
  }
});
```

Client proxy:

```js
import {
  createServerProxy
} from "@async/framework/browser";

const server = createServerProxy({
  endpoint: "/__async/server",
  transport: httpTransport,
  signals,
  loader,
  router
});

await server.cart.add("sku-1", 2);
```

Proxy requests validate their `args`, default `input`, and selected signal
values before transport runs. Supported values are `null`, booleans, strings,
finite numbers, dense arrays, and plain objects composed from those values.
Values that JSON would silently change or drop, such as `undefined`, functions,
symbols, `Map`, `Set`, `Date`, sparse arrays, class instances, non-finite
numbers, circular objects, file-like values, streams, buffers, and typed arrays
are rejected with a path to the invalid value.

Server responses can include `value`, `signals`, `boundary`, `html`, `redirect`,
or `error`. Signal patches are applied before boundary swaps and redirects.
Namespace calls such as `server.cart.add(...)` return the unwrapped `value`.

When an async signal calls a server namespace function, the framework passes the
active abort signal through proxy calls. Returned server effects such as
`signals`, `cache.browser`, `boundary/html`, and `redirect` are applied before
the async signal stores the unwrapped `value`.

## Cache

Cache declarations are split by runtime target:

```js
Async.use({
  cache: {
    browser: {
      product: defineCache({ ttl: 60_000 })
    },
    server: {
      "products.get": defineCache({ ttl: 30_000 })
    }
  },
  server: {
    async "products.get"(id) {
      return this.cache.getOrSet(`products:${id}`, () => db.products.get(id));
    }
  }
});
```

Browser handlers and browser async signals receive `runtime.browser.cache`.
Server functions and server partials receive `runtime.server.cache`. Server
cache config and contents are never serialized to the browser. Browser cache is
seeded only by explicit SSR response data.

Runtime cache registries support:

```js
cache.register("product", defineCache({ ttl: 60_000 }));
cache.get("product:sku-1");
cache.set("product:sku-1", product);
await cache.getOrSet("product:sku-1", () => loadProduct());
cache.delete("product:sku-1");
cache.clear("product:");
```

## Related
- Guide: [Streaming & Boundaries](#/runtime/streaming)
- SSR: [SSR & Activation](#/runtime/ssr-activation)
- Contract: [06-server-and-data-system.md](../../specs/framework/06-server-and-data-system.md)
