# App Hub & Registries

## App Hub

`Async` is an exported app hub singleton. It is not installed on `globalThis`
unless you assign it there yourself.

```js
import {
  Async,
  createSignal,
  defineCache,
  defineRoute
} from "@async/framework/router";

Async.use({
  signal: {
    count: createSignal(0)
  },
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  },
  server: {
    async "products.get"(id) {
      return this.cache.getOrSet(`products:${id}`, () => db.products.get(id));
    }
  },
  route: {
    "/products/:id": defineRoute("product.page")
  },
  cache: {
    browser: {
      product: defineCache({ ttl: 60_000 })
    },
    server: {
      "products.get": defineCache({ ttl: 30_000 })
    }
  }
});

Async.start({ root: document });
```

You can also create isolated app hubs and runtimes:

```js
const app = defineApp();
app.use("signal", { count: createSignal(0) });
app.use("handler", {
  increment() {
    this.signals.update("count", (count) => count + 1);
  }
});

const runtime = createApp(app, { root: document }).start();
```

Naming rules:

| Shape | Meaning |
| --- | --- |
| `define*` | Declaration or app shape that can be registered before runtime |
| `create*` | Runtime instance or mutable runtime primitive |
| `Async.use(...)` | App-level declaration registration |
| `registry.register(...)` | Low-level registration on a concrete runtime registry |
| `registry.unregister(...)` | Low-level removal from a concrete runtime registry |

Singular registry keys are canonical: `signal`, `handler`, `server`,
`partial`, `route`, `component`, and nested `cache.browser` / `cache.server`.

## Registry Inspection

`Async.registry` is the global inspection surface for registered app pieces.
Every runtime owns fresh mutable signal and cache state materialized from the
app declaration store. Concrete registries inside one runtime share that
runtime's registry view:

```js
Async.registry.keys("signal");
Async.registry.entries("route");
Async.registry.snapshot();

const runtime = Async.start({ root: document });

runtime.registry.keys("handler");
runtime.signals.registry === runtime.registry;
runtime.browser.cache.registry === runtime.registry;
```

Supported inspection types:

```txt
signal
handler
server
partial
route
component
cache.browser
cache.server
cache.browser.entries
cache.server.entries
```

Browser runtime inspection exposes server ids as descriptors, not executable
server functions, and does not expose server cache contents:

```js
runtime.registry.keys("server");
runtime.registry.get("server", "products.get");
// { id: "products.get", kind: "server" }

runtime.registry.snapshot().entries.server;
// {}
```

The singleton runtime is intentionally internal. Use app-level methods for
global lifecycle work, and use `inspectRuntime()` for diagnostics:

```js
Async.attachRoot(document.body);
Async.applySnapshot(snapshot);

Async.inspectRuntime();
// {
//   active: true,
//   started: true,
//   destroyed: false,
//   target: "browser",
//   roots: { count: 1, roots: [...] },
//   loader: { ready: true, pending: 0, root: document.body },
//   router: false
// }
```

`Async.runtime` is not public API. If you need direct instance ownership, keep
the handle returned from `Async.start(...)` or `createApp(...).start()`.

## Loader Bootstrap Queue

`Async.loader` is a promise-returning facade for script-friendly loader work
that may run before the app has attached a root. Calls to `scan`, `swap`, and
`attach` queue until `Async.start({ root })` or `Async.attachRoot(root)` creates
the concrete runtime loader:

```js
Async.use("handler", {
  selectProduct() {
    this.signals.set("selected", true);
  }
});

const swapped = Async.loader.swap(
  "route",
  `<button type="button" on:click="selectProduct">Select</button>`
);

Async.start({ root: document, router: false });
await swapped;
```

`Async.loader.ready()` resolves with the concrete `runtime.loader`.
`Async.loader.inspect()` reports whether a loader is ready and how many loader
operations are still pending. The concrete `runtime.loader` remains
synchronous for routers, boundary receivers, and server-result application.

## Related
- Guide: [Runtime Overview](#/runtime/overview)
- Entrypoints: [Entrypoints](#/reference/entrypoints)
- Contract: [02-runtime-kernel.md](../../specs/framework/02-runtime-kernel.md)
