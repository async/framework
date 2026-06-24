# @async/framework

Async is a layered framework plan that starts as a no-build browser bootloader:
signals, async signals, delegated command events, scoped fragment components,
server calls, route partials, and out-of-order boundary swaps without a virtual
DOM.

```bash
pnpm add @async/framework
```

```html
<main async:container>
  <button type="button" on:click="decrement">-</button>
  <strong signal:text="count"></strong>
  <button type="button" on:click="increment">+</button>
</main>
<script type="module" src="./main.js"></script>
```

```js
import {
  Async,
  createSignal
} from "@async/framework";

Async.use({
  signal: {
    count: createSignal(0)
  },
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    },
    decrement() {
      this.signals.update("count", (count) => count - 1);
    }
  }
});

Async.start({ root: document });
```

## What It Is

`@async/framework` is the L1 runtime plus the first L1.5 app/server and
streaming primitives. It keeps the runtime small and explicit:

- No build step for L1 consumers.
- No virtual DOM, diff path, hydration runtime, or component rerender loop.
- Signals are the state boundary.
- `Async.use(...)` registers app declarations before or after startup.
- Handlers live in a registry and run through delegated DOM events.
- Async signals use native `AbortSignal` cancellation and suppress stale async
  completions.
- A small scheduler batches signal-driven DOM bindings, lifecycle callbacks,
  effects, and async refreshes without adding a render loop.
- Browser and server cache declarations are structurally split.
- Boundaries can be swapped out of order and rescanned, which keeps server
  streaming and partial HTML replacement simple.

Higher layers can add JSX lowering, TypeScript, chunk manifests, compiler-owned
server/client splits, and intent-first authoring later. They should compile down
to the same runtime registries and HTML protocol.

## Layers

Async is designed as layers, so each level can stay useful without forcing the
next level on every app.

| Shorthand | Name | Requirement | Purpose |
| --- | --- | --- | --- |
| L1 | Runtime bootloader | No build. CDN or direct ESM import. | Signals, async signals, scheduler, handlers, command events, lifecycle pseudo-events, scoped fragments, and boundary swaps. |
| L1.5 | App/server and streaming bridge | Light server integration. No app compiler required. | `Async.use(...)`, router modes, server function proxy, partial registry, SSR output, browser activation, split browser/server cache, and streamed boundary patches. |
| L2 | Build-required authoring and compiler profile | Build step required. | JSX, ESM, and TypeScript authoring, optimizer reports, generated plans, generated registries, chunks, manifests, and future resumability records that lower onto L1 and L1.5 protocols. |

The package in this repository intentionally focuses on L1 and L1.5. L2 is a
higher authoring surface, not an extra runtime requirement for plain HTML apps.

## Install

```bash
pnpm add @async/framework
```

The package is ESM-only and supports Node.js 24 and newer for tests, examples,
and package lifecycle tooling. Browser consumers import ESM directly.

## Vite And Hono

The Vite entry can run a Hono app as the local development server while keeping
the browser runtime at L1. Install the optional Hono dev packages in apps that
use this profile:

```bash
pnpm add hono
pnpm add -D vite @hono/vite-dev-server
```

```js
// vite.config.js
import { defineConfig } from "vite";
import { asyncFramework } from "@async/framework/vite";

export default defineConfig({
  plugins: [
    asyncFramework({
      layer: 1,
      server: {
        entry: "src/server.js"
      },
      client: {
        entry: "src/client.js",
        outDir: "public/static"
      }
    })
  ]
});
```

During local development, run Vite:

```json
{
  "scripts": {
    "dev": "vite"
  }
}
```

`asyncFramework({ server })` composes `@hono/vite-dev-server`, serves the
default-exported Hono app, and leaves Hono's client reload injection enabled.
The Hono entry owns the HTML shell:

```js
// src/server.js
import { Hono } from "hono";

const app = new Hono();

app.get("/", (context) => {
  const clientScript = import.meta.env?.DEV ? "/src/client.js" : "/static/client.js";

  return context.html(`<!doctype html>
    <html>
      <body async:app>
        <button type="button" on:click="increment">
          Count: <span signal:text="count"></span>
        </button>
        <script type="module" src="${clientScript}"></script>
      </body>
    </html>`);
});

export default app;
```

The client entry stays ordinary L1 framework code:

```js
// src/client.js
import {
  Async,
  createSignal
} from "@async/framework/browser";

Async.use({
  signal: {
    count: createSignal(0)
  },
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  }
});

Async.start({ root: document });
```

For production assets, build only the client bundle:

```json
{
  "scripts": {
    "build": "vite build --mode client"
  }
}
```

The client build emits into `public/static` by default. Vercel serves
`public/**` as static assets and runs the Hono app through its native Hono
support when the app is default-exported from an entry such as `src/server.js`.
There is no `target` option in this profile yet; production platform behavior
belongs to the host until Async adds an explicit build target contract.

See [`examples/vite-hono`](./examples/vite-hono) for a local Hono app and
client build setup. See [`examples/vite-jsx-streaming`](./examples/vite-jsx-streaming)
for the Vite JSX optimizer lane that hides bootstrap setup and selects the
stream runtime slice from Suspense and Reveal intent.

## CDN

The package ships browser CDN artifacts for UNPKG and can be loaded without a
build step. Use `@latest` for quick prototypes, and pin an exact version in
production:

| File | Format | Use |
| --- | --- | --- |
| `browser.js` | ESM | Readable browser module bundle |
| `browser.min.js` | ESM | Compact browser module bundle |
| `browser.umd.js` | UMD | Readable script-tag/CommonJS-style bundle |
| `browser.umd.min.js` | UMD | Compact script-tag/CommonJS-style bundle and default CDN file |
| `browser.ts` | Bundled browser TypeScript source | TS-aware runtimes and higher-layer tooling |
| `browser.d.ts` | Type declarations | TypeScript declarations for the browser API |
| `server.js` | ESM | Server-capable Node.js bundle |
| `framework.ts` | Bundled server-capable TypeScript source | TS-aware runtimes and higher-layer tooling |
| `framework.d.ts` | Type declarations | TypeScript declarations for the server-capable API |

```html
<main async:container>
  <button type="button" on:click="increment">+</button>
  <strong signal:text="count"></strong>
</main>

<script type="module">
  import {
    Async,
    createSignal
  } from "https://unpkg.com/@async/framework@latest/browser.js";

  Async.use({
    signal: {
      count: createSignal(0)
    },
    handler: {
      increment() {
        this.signals.update("count", (count) => count + 1);
      }
    }
  });

  Async.start({ root: document });
</script>
```

For a plain script tag, use the UMD bundle. In this UMD-only global form,
`globalThis.Async` is the app hub plus the exported helper functions, with
`globalThis.AsyncFramework` kept as an alias. Lower-level bootloader code can
call `Async.Loader(...)` directly.

```html
<script src="https://unpkg.com/@async/framework@latest/browser.umd.min.js"></script>
<script>
  Async.use({
    signal: {
      count: Async.createSignal(0)
    },
    handler: {
      increment() {
        this.signals.update("count", (count) => count + 1);
      }
    }
  });

  Async.start({ root: document });
</script>
```

You can also use an import map so app code imports `@async/framework` by name:

```html
<script type="importmap">
{
  "imports": {
    "@async/framework": "https://unpkg.com/@async/framework@latest/browser.js"
  }
}
</script>

<script type="module">
  import {
    Async,
    createSignal
  } from "@async/framework";

  Async.use({
    signal: {
      count: createSignal(0)
    },
    handler: {
      increment() {
        this.signals.update("count", (count) => count + 1);
      }
    }
  });

  Async.start({ root: document });
</script>
```

## Advanced Build-Step Runtime

Layer 1 still works with no build step. A build step can optimize the same
runtime by emitting SSR HTML plus compact registry descriptors. The browser can
start in the document head, apply snapshots, and wait for a root to appear:

```html
<script type="importmap">
{
  "imports": {
    "@async/framework": "https://unpkg.com/@async/framework@latest/browser.js"
  }
}
</script>

<script type="application/json" async:snapshot>
{
  "signal": {
    "productId": "sku-1"
  },
  "handler": {
    "cart.add": { "url": "cart.add.js" }
  },
  "component": {
    "ProductCard": { "url": "ProductCard.js" }
  },
  "asyncSignal": {
    "product.load": { "url": "product.load.js" }
  }
}
</script>

<script type="module">
  import {
    Async,
    defineAsyncContainerElement,
    defineAsyncSuspenseElement,
    readSnapshot
  } from "@async/framework";

  Async.start({
    snapshot: readSnapshot(document),
    registryAssets: { baseUrl: "_async" }
  });

  defineAsyncContainerElement();
  defineAsyncSuspenseElement();
</script>
```

`Async.start()` defaults to rootless browser startup. It creates registries,
applies snapshots, and prepares the scheduler/server proxy context without
scanning DOM. Attach a root later with `Async.attachRoot(root)` or by using
`<async-container>`:

```html
<async-container>
  <button type="button" on:click="cart.add">Add</button>
</async-container>
```

Descriptor URLs are relative to a type folder under `registryAssets.baseUrl`.
The default is:

```js
{
  baseUrl: "_async",
  paths: {
    component: "component",
    handler: "handler",
    asyncSignal: "asyncSignal",
    partial: "partial",
    route: "route"
  }
}
```

So this descriptor:

```json
{ "url": "ProductCard.js#ProductCard" }
```

resolves as:

```txt
/_async/component/ProductCard.js#ProductCard
```

If `#export` is omitted, Async tries the registry id leaf, then the file
basename, then `default`.

For declarative async boundaries, use `<async-suspense>` or keep using
`this.suspense(...)` inside components:

```html
<async-suspense for="product.load">
  <template loading>Loading...</template>
  <template ready>
    <h1 signal:text="product.load.title"></h1>
  </template>
  <template error>
    <p signal:text="product.load.$error.message"></p>
  </template>
</async-suspense>
```

The build layer can hide `createBoundaryReceiver(...)` setup, but streaming is
still explicit boundary patches: boundary id, sequence number, HTML, signal
patches, and browser-cache patches. Async does not ship a component resume graph.

## Core API

For npm consumers, `@async/framework` uses conditional exports: browser-aware
tooling receives the browser entry, while Node receives the server-capable
entry. Use explicit subpaths when the target matters.
The root export also uses condition-specific declarations, so browser-conditioned
root imports expose the same API as `@async/framework/browser`; server-only APIs
remain declared on the Node/server entrypoints.

```js
import {
  Async,
  Loader,
  attributeName,
  asyncSignal,
  createApp,
  createCacheRegistry,
  createComponentRegistry,
  createLazyRegistry,
  component,
  computed,
  component,
  createSignal,
  createHandlerRegistry,
  createPartialRegistry,
  createRegistryStore,
  createRouteRegistry,
  createRouter,
  createScheduler,
  createServerProxy,
  createSignalRegistry,
  defineAsyncContainerElement,
  defineAsyncSuspenseElement,
  defineAttributeConfig,
  defineApp,
  defineCache,
  defineRegistrySnapshot,
  defineRoute,
  delay,
  effect,
  html,
  readSnapshot,
  route,
  signal
} from "@async/framework/browser";
```

Server-only APIs live behind the server entry:

```js
import {
  createRequestContextStore,
  createServerRegistry
} from "@async/framework/server";
```

`Loader` is the canonical loader factory. `AsyncLoader` remains as a
compatibility alias for older code.

### App Hub

`Async` is an exported app hub singleton. It is not installed on `globalThis`
unless you assign it there yourself.

```js
import {
  Async,
  createSignal,
  defineCache,
  defineRoute
} from "@async/framework";

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

### Registry Inspection

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

### Signals

```js
const signals = createSignalRegistry();

signals.register("count", createSignal(0));
signals.register("products", createSignal([]));

signals.get("count");
signals.set("count", 1);
signals.update("count", (count) => count + 1);
signals.subscribe("count", (count) => console.log(count));
signals.ref("count").value;
signals.unregister("count");
```

Initializer maps are supported:

```js
const signals = createSignalRegistry({
  count: createSignal(0),
  products: createSignal([])
});
```

Nested paths read through the first registered signal id:

```js
signals.register("product", createSignal({ title: "Keyboard" }));
signals.get("product.title");
signals.set("product.title", "Headphones");
```

`signal(...)` remains a compatibility alias for `createSignal(...)`.

### Scheduler

The scheduler is the Layer 1.5 ordering engine. Signal writes are still
synchronous:

```js
signals.set("count", 3);
signals.get("count");
// 3
```

DOM bindings, component lifecycle callbacks, component effects, and async signal
refreshes are scheduled through deterministic phases:

```txt
binding -> lifecycle -> effect -> async -> post
```

Browser runtimes use a microtask scheduler by default. Server runtimes use a
manual scheduler and drain it during `runtime.render(...)`.

```js
import {
  createScheduler
} from "@async/framework";

const scheduler = createScheduler({
  strategy: "manual"
});

const runtime = Async.start({
  root: document,
  scheduler
});

signals.set("count", 1);
await scheduler.flush();
```

Most apps do not need to call the scheduler directly. It is exposed for tests,
custom runtimes, streaming receivers, and higher layers that need explicit flush
boundaries.

### Async Signals

Async signals add loading state, error state, versions, refresh, and cancel to a
normal signal value.

```js
const signals = createSignalRegistry({
  productId: createSignal("sku-1")
});

const product = signals.asyncSignal("product", async function () {
  const id = this.signals.get("productId");
  const response = await fetch(`/api/products/${id}`, {
    signal: this.abort
  });

  return response.json();
});
```

The async function context includes:

| Field | Purpose |
| --- | --- |
| `this.signals` | The signal registry |
| `this.id` | Current async signal id |
| `this.version` | Run version |
| `this.abort` | Native `AbortSignal` with non-enumerable `cancel(reason?)` |
| `this.scheduler` | Current runtime scheduler |
| `this.refresh()` | Start a new run |

`this.abort` can be passed directly to `fetch` or to `delay`:

```js
await delay(250, this.abort);
```

If a dependency read through `this.signals.get(...)` changes, the async signal
reruns and the previous run is aborted.

Dependency reads are captured while the async signal function starts running.
Read signal dependencies before the first `await`; reads that happen later are
ordinary reads and do not create refresh subscriptions.

## HTML Protocol

Loader scans regular HTML attributes:

| Attribute | Behavior |
| --- | --- |
| `async:container` | Marks a scannable app root |
| `on:click="selectProduct"` | Delegated command event |
| `on:submit="preventDefault; save"` | Sequential command chain |
| `on:click="server.cart.add(productId)"` | Server command with signal args |
| `on:attach="setup"` | Component root attach lifecycle pseudo-event |
| `on:visible="trackView"` | Component root visible lifecycle pseudo-event |
| `on:intersect="trackSection"` | Continuous intersection lifecycle pseudo-event |
| `intersect:threshold="0,0.5,1"` | Intersection threshold option for `on:intersect` |
| `intersect:root-margin="-20% 0px -55% 0px"` | Intersection root margin option for `on:intersect` |
| `intersect:once="true"` | Disconnect `on:intersect` after the first intersecting entry |
| `signal:text="product.title"` | Text binding |
| `signal:value="productId"` | Form value binding with writeback |
| `signal:attr:disabled="product.$loading"` | Attribute binding |
| `signal:prop:checked="selected"` | DOM property binding |
| `class:selected="selected"` | Class toggle from a signal path |
| `signal:class="buttonClasses"` | Class set from a signal value: string, object, or array |
| `async:boundary="product"` | Async or streamed replacement boundary |
| `async:loading="product"` | Boundary loading template |
| `async:ready="product"` | Boundary ready template |
| `async:error="product"` | Boundary error template |

```html
<section async:boundary="product">
  <template async:loading="product">
    <p>Loading...</p>
  </template>
  <template async:ready="product">
    <h1 signal:text="product.title"></h1>
  </template>
  <template async:error="product">
    <p signal:text="product.$error.message"></p>
  </template>
</section>
```

The default prefixes are `async:`, `signal:`, and `on:`. You can switch to
data attributes when a host needs that shape:

```js
Async.start({
  root: document,
  attributes: {
    async: "data-async-",
    class: "data-class-",
    intersect: "data-intersect-",
    signal: "data-signal-",
    on: "data-on-"
  }
});
```

That maps to `data-async-container`, `data-on-click="save"`,
`data-signal-text="product.title"`, `data-class-selected="selected"`, and
`data-intersect-threshold="0.5"`.

Inside `html` templates, signal refs can be passed directly to binding
attributes:

```js
const title = this.signal("Keyboard");
const disabled = this.signal(false);
const checked = this.signal(true);

return html`
  <h1 signal:text="${title}"></h1>
  <button signal:attr:disabled="${disabled}">Save</button>
  <input type="checkbox" signal:prop:checked="${checked}">
`;
```

Use `signal:value` for form value binding with writeback. Use `signal:prop:*`
when you only need one-way DOM property updates.

Named class toggles use their own top-level namespace:

```html
<button
  class="button"
  class:selected="selected"
>
  Add
</button>
```

Aggregate class binding uses `signal:class`. It reads the current signal value
and accepts strings, objects, and arrays:

```js
Async.use({
  signal: {
    buttonClasses: createSignal([
      "button-primary",
      { selected: true, disabled: false },
      ["compact"]
    ])
  }
});
```

```html
<button signal:class="buttonClasses">Add</button>
```

Inside `html` templates, `signal:class` can also receive objects or arrays
directly. Signal refs inside the object or array are tracked:

```js
const selected = this.signal("selected", false);
const tone = this.signal("tone", "primary");

return html`
  <article signal:class="${["card", tone, { selected }]}"}>
    ...
  </article>
`;
```

For component-local state that does not need a stable public id, omit the name.
The signal is still registered under the component scope:

```js
const selected = this.signal(false);
const tone = this.signal("primary");

return html`
  <article signal:class="${["card", selected, tone]}">
    ...
  </article>
`;
```

`value="${signalRef}"` in an `html` template is equivalent to adding
`signal:value` for that signal. It writes back on input/change:

```js
const productId = this.signal("productId", "sku-1");

return html`<input value="${productId}">`;
```

`signal:class:selected="selected"` remains supported as a compatibility alias,
but new examples should use `class:selected`. The parser-safe top-level
aggregate form `class:="buttonClasses"` also remains supported.

### Command Events

`on:*` works with any native DOM event name. `on:attach` and `on:visible` are
reserved component lifecycle pseudo-events with cleanup support. `on:mount`
remains as a compatibility alias for `on:attach` and warns when used.
When an `on:attach` handler installs listeners, observers, timers, or DOM
helpers, return a cleanup function. Boundary swaps destroy the old subtree and
run returned cleanup functions before inserting the next fragment.

Command chains use semicolons and are awaited sequentially:

```html
<form on:submit="preventDefault; server.products.save(productId, $form)">
  <input name="title">
  <button>Save</button>
</form>
```

Plain commands resolve through the handler registry. Built-ins are registered by
default:

```txt
prevent
preventDefault
stopPropagation
stopImmediatePropagation
```

`server.<id>(...)` resolves through the server registry or client proxy. Bare
arguments read signals. `$*` arguments read event locals:

| Argument | Value |
| --- | --- |
| `productId` | `signals.get("productId")` |
| `cart.quantity` | `signals.get("cart.quantity")` |
| `$value` | Current element value |
| `$checked` | Current element checked state |
| `$form` | Current form as a plain object |
| `$dataset` | Current element dataset as a plain object |
| `$event` | Raw DOM event, client-only |
| `$el` | Current element, client-only |

`$event` and `$el` are intentionally not serializable and cannot be passed to
`server.*(...)` commands.

Inline commands are not JavaScript. There is no `eval`, assignment, branching,
arithmetic, or inline `await`. Complex logic belongs in a registered handler:

```js
handlers.register("addToCart", async function () {
  const productId = this.signals.get("productId");
  const result = await this.server.cart.add(productId);
  this.signals.set("cart", result.cart);
});
```

### Server Calls

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

### Router And Partials

Async includes a built-in router. Use it for URL matching, route params,
hash-based static-host routes, same-origin link and GET form interception,
route partial swaps, and route-only `router.*` state.

The router can be started in two ways:

- `Async.use({ route, partial })` plus `Async.start({ mode, boundary })` for app
  hub setup.
- `createRouter({ routes, partials, mode, boundary })` for direct runtime setup.

Router pieces:

| Piece | Purpose |
| --- | --- |
| `createRouteRegistry(...)` | Holds URL patterns such as `/products/:id` |
| `defineRoute(...)` | Creates route records that point to partials or metadata |
| `createPartialRegistry(...)` | Holds route fragments that can return HTML or envelopes |
| `createRouter(...)` | Starts navigation, history handling, matching, and route state |
| `async:boundary="route"` | Receives rendered route partial HTML in `csr` and `spa` modes |
| `router.*` signals | Publish path, params, query, matched route, pending state, and errors |

Partials are server-rendered fragment functions. They return HTML, `html`
templates, DOM fragments, or a response envelope.

```js
const partials = createPartialRegistry({
  "product.page": async function ({ id }) {
    const product = await this.server.products.get(id);
    return html`<h1>${product.title}</h1>`;
  }
});
```

The router swaps route partials into a boundary. `csr` starts from an empty
route boundary, renders the current route partial locally, then keeps future
navigation local too:

```js
Async.use({
  partial: {
    home() {
      return html`<h1>Home</h1>`;
    },
    "product.page"({ id }) {
      return html`<h1>Product ${id}</h1>`;
    }
  },
  route: {
    "/": defineRoute("home"),
    "/products/:id": defineRoute("product.page")
  }
});

Async.start({
  mode: "csr",
  boundary: "route",
  root: document
});
```

`route(...)` remains a compatibility alias for `defineRoute(...)`.

Route patterns support static paths, params, and wildcard fallback:

```js
Async.use({
  route: {
    "/": defineRoute("home.page"),
    "/products/:id": defineRoute("product.page"),
    "/docs/:section/:page": defineRoute("docs.page"),
    "*": defineRoute("notFound.page")
  }
});
```

The router publishes params and query strings through signals:

```txt
/products/sku-1?tab=reviews
router.path   -> "/products/sku-1"
router.params -> { id: "sku-1" }
router.query  -> { tab: "reviews" }
```

Routes that only drive URL-backed state can use route metadata without a
partial. Use `mode: "signals"` for dashboards or app shells that already render
from state:

```js
const routes = createRouteRegistry({
  "/pbi": defineRoute({ render: "none", meta: { page: "pbi" } }),
  "/fy26": defineRoute({ render: "none", meta: { page: "fy26" } })
});

const router = createRouter({
  mode: "signals",
  urlMode: "hash",
  routes
});
```

Router modes:

| Mode | Initial route | Later navigation | Use when |
| --- | --- | --- | --- |
| `csr` | Client renders local partial into boundary | Client renders local partial and swaps | A no-build page owns route content on the client |
| `spa` | Existing HTML may already contain route | Client renders local partial and swaps | SSR or static HTML should stay visible until navigation |
| `signals` | Existing HTML stays mounted | Updates `router.*` signals and history only | A shell renderer reacts to URL state itself |
| `ssr` | Server-rendered document plus snapshot activation | Browser navigates normally | Navigation belongs to the server |
| `mpa` | Any document source | Browser navigates normally | Traditional multi-page navigation |

In `signals` mode, route changes update `router.url`, `router.path`,
`router.params`, `router.query`, `router.route`, `router.pending`, and
`router.error` without rendering partials or swapping boundaries.

Client navigation modes intercept same-origin links, GET forms, browser
back/forward, and route hashes such as `#/products/sku-1`. They do not intercept
external links, downloads, modified clicks, non-GET forms, or plain section
anchors such as `#quickstart`.

CSR startup can use an empty route boundary:

```html
<main async:container>
  <nav>
    <a href="/">Home</a>
    <a href="/products/sku-1">Product</a>
  </nav>

  <section async:boundary="route"></section>
</main>
```

Router state lives under `router.*` signals:

```txt
router.url
router.path
router.params
router.query
router.route
router.pending
router.error
```

Programmatic navigation uses the same matcher and history handling:

```js
await router.navigate("/products/sku-1");
await router.navigate("/products/sku-2", { replace: true });
await router.prefetch("/products/sku-3");
```

When a partial envelope owns an `html` key with `undefined`, the router treats
it as no route HTML replacement and leaves the active boundary intact. Use
`html: ""` to intentionally clear the route boundary.

The full router guide lives in `docs/runtime/router-partials.md` and the
runnable example is `examples/router`.

### Cache

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

### SSR Flow

SSR uses related app definitions: a server runtime with server functions,
server cache, partials, and route rendering; and a browser runtime with DOM
handlers, browser cache, signals, and usually a server proxy.

```js
const serverRuntime = createApp(serverApp, {
  target: "server",
  request
});

const response = await serverRuntime.render("/products/123");
```

`runtime.render(url)` returns:

```js
{
  html,
  status,
  signals,
  cache: {
    browser: {}
  }
}
```

The returned HTML includes a route boundary plus a JSON snapshot:

```html
<section async:boundary="route">
  <!-- server-rendered route partial -->
</section>
<script type="application/json" async:snapshot>{}</script>
```

Browser activation scans the existing HTML and attaches events. It does not
hydrate, diff, patch, rerender, or fetch route fragments:

```js
createApp(browserApp, {
  root: document
}).start();
```

If browser handlers or async signals need server commands, pass a server proxy
with an explicit transport:

```js
createApp(browserApp, {
  root: document,
  server: createServerProxy({
    endpoint: "/__async/server",
    transport: httpTransport
  })
}).start();
```

If an `async:snapshot` script is present under the root or document,
`createApp(...)` reads it automatically. You can also inspect it directly:

```js
const snapshot = readSnapshot(document);
```

## Loader Bootstrap Queue

`Async.loader` is a promise-returning facade for script-friendly loader work
that may run before the app has attached a root. Calls to `scan`, `swap`, and
`mount` queue until `Async.start({ root })` or `Async.attachRoot(root)` creates
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

## Components

Components are scoped fragment functions. They return strings or `html`
templates; Loader inserts and scans the result. There is no virtual node
type and no rerender loop.

```js
const Toggle = component(function Toggle() {
  const selected = this.signal(false);
  const attach = this.handler("attach", function ({ element }) {
    element.dataset.attached = "true";
  });
  const visible = this.handler("visible", function ({ element }) {
    element.dataset.visible = "true";
  });

  return html`
    <button
      type="button"
      on:attach="${attach}"
      on:visible="${visible}"
      on:click="${this.handler(function () {
        selected.update((value) => !value);
      })}"
      class:selected="${selected}"
      signal:class="${["toggle", { active: selected }]}"
      signal:attr:aria-pressed="${selected}"
    >
      Toggle
    </button>
  `;
});

const loader = Loader({ root: document });
loader.mount(document.querySelector("#app"), Toggle);
```

Component helpers:

| Helper | Behavior |
| --- | --- |
| `this.signal(name, initial)` | Scoped named get-or-create signal |
| `this.signal(initial)` | Generated scoped local signal |
| `this.computed(name, fn)` | Scoped computed signal |
| `this.asyncSignal(name, fn)` | Scoped async signal |
| `this.effect(fn)` | Scoped effect with cleanup |
| `this.handler(name, fn)` | Scoped named handler registry entry |
| `this.handler(fn)` | Generated scoped handler registry entry |
| `this.render(Component, props, children?)` | Child fragment rendering with optional default children |
| `this.slot(Component, propsOrFn)` | Child component outlet using an `on:attach` target |
| `this.suspense(signalRef, views)` | Async boundary template helper |
| `this.on(event, fn)` | Fragment lifecycle fallback for `attach`, `visible`, and `destroy` |
| `this.onAttach(fn)` | Fragment attach lifecycle fallback |
| `this.onMount(fn)` | Compatibility alias for `this.onAttach(fn)` that warns when used |
| `this.onVisible(fn)` | Compatibility alias for `this.on("visible", fn)` |
| `this.on("intersect", options?, fn)` | Continuous intersection lifecycle for the mounted component scope |
| `this.intersect(element, options?, fn)` | Component-owned continuous intersection observer for a direct element |

`this.suspense(...)` is sugar for Loader boundaries:
`asyncSignal + async:boundary + async:* templates`. It emits only templates. The
caller owns the boundary element, and the loader chooses the loading, ready, or
error template from the async signal status.

```js
const Product = component(function Product() {
  const product = this.asyncSignal("product", async function () {
    return this.server.products.get("sku-1");
  });

  return html`
    <article async:boundary="${product.id}">
      ${this.suspense(product, {
        loading() {
          return html`<p>Loading...</p>`;
        },
        ready(product) {
          return html`<h1 signal:text="${product.id}.title"></h1>`;
        },
        error(product) {
          return html`<p signal:text="${product.id}.$error.message"></p>`;
        }
      })}
    </article>
  `;
});
```

The shorthand form treats the callback as the ready template:

```js
this.suspense(product, (product) => html`
  <h1 signal:text="${product.id}.title"></h1>
`);
```

`this.suspense(...)` is not React Suspense. It does not throw promises,
hydrate, diff, rerender a component tree, or emit a wrapper element.

Default children are a scoped fragment owned by the framework. Pass them as the
third `this.render(...)` argument, then interpolate `children` in the child
component:

```js
const Card = component(function Card({ title, children }) {
  return html`
    <article>
      <h2>${title}</h2>
      ${children}
    </article>
  `;
});

const Page = component(function Page() {
  return html`
    ${this.render(Card, { title: "Status" }, html`
      <p>Ready</p>
    `)}
  `;
});
```

Children can also be lazy when the caller supplies a factory. The factory runs
only if the child component interpolates `children`, and any nested components
or handlers created while rendering the fragment are cleaned up with the
consuming component fragment:

```js
this.render(Card, { title: "Status" }, function children() {
  return html`<p>${this.render(Badge, { label: "Live" })}</p>`;
});
```

No-build HTML component hosts use an explicit inert template for default
children:

```html
<section async:component="Card">
  <template async:children>
    <p>Ready</p>
  </template>
</section>
```

The loader captures only a direct child `<template async:children>` before
mounting the registered component. Ordinary host content is not implicitly
captured, and the template content is inserted and scanned only if the
component interpolates `children`.

Do not pass `children` in the props object when also using the third argument.
Default children are consumed once by interpolation; use `this.slot(...)` for
post-mount replacement and use ordinary props when the child needs data from the
caller.

Component-scoped signals and handlers are unregistered when the mounted
fragment is destroyed. `loader.swap(...)` cleans up old DOM bindings and mounted
component fragments under the swapped boundary before inserting the new HTML.

Lifecycle fallbacks are scoped to the component fragment that registered them.
A component mounted directly with `loader.mount(target, Component)` receives the
mount target. A child rendered through `this.render(Child)` receives its own
single element root when one exists. If the child returns text or multiple root
nodes, the fallback target is the nearest containing element. `this.onVisible`
and `this.on("intersect", ...)` observe the same scoped target.

Put component lifecycle on the component root element when there is one:

```js
const attach = this.handler("attach", function ({ element }) {
  element.dataset.attached = "true";
});
const visible = this.handler("visible", function ({ element }) {
  element.dataset.visible = "true";
});

return html`<article on:attach="${attach}" on:visible="${visible}">...</article>`;
```

If a component returns text or multiple root nodes, use the scoped fallback:

```js
this.on("attach", (target) => {
  target.dataset.attached = "true";
});

this.on("destroy", () => {
  // Clean up fragment-scoped resources.
});
```

`on:visible` is defined as a component lifecycle pseudo-event. It runs once when
the component root first becomes visible. Lifecycle events do not drive
component rerenders.

Use `on:intersect` when markup should receive continuous intersection updates
through a registered handler:

```html
<section
  on:intersect="trackSection"
  intersect:threshold="0,0.25,0.5,0.75,1"
  intersect:root-margin="-20% 0px -55% 0px"
>
  ...
</section>
```

The handler receives `element`, `entry`, `entries`, `observer`,
`isIntersecting`, `intersectionRatio`, and `unsupported`. Custom roots are not
selector-based; use `this.intersect(...)` with a direct root element when a
custom observer root is needed.

Use `this.on("intersect", ...)` when a component needs continuous visibility
state:

```js
const Card = component(function Card() {
  const visible = this.signal(false);

  this.on("intersect", { threshold: 0.5 }, ({ isIntersecting }) => {
    visible.set(isIntersecting);
  });

  return html`<article class:visible="${visible}">...</article>`;
});
```

Use `this.intersect(...)` with a direct element when a parent owns scroll-spy or
active-section state:

```js
const Section = component(function Section({ id, observeSection }) {
  const attach = this.handler("attach", function ({ element }) {
    return observeSection(id, element);
  });

  return html`<section on:attach="${attach}"><h2>${id}</h2></section>`;
});

const Page = component(function Page() {
  const active = this.signal("intro");
  const ratios = new Map();
  const options = {
    rootMargin: "-20% 0px -55% 0px",
    threshold: [0, 0.25, 0.5, 0.75, 1]
  };

  const observeSection = (id, element) => this.intersect(element, options, ({ entry }) => {
    ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
    const best = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
    active.set(best?.[0] ?? id);
  });

  return html`
    <nav signal:text="${active}"></nav>
    ${this.render(Section, { id: "intro", observeSection })}
    ${this.render(Section, { id: "runtime", observeSection })}
  `;
});
```

## Streaming

Out-of-order HTML can target a boundary and keep delegated handlers working:

```js
loader.swap(
  "product",
  `
    <article>
      <h1 signal:text="product.title"></h1>
      <button type="button" on:click="selectProduct">Select</button>
    </article>
  `
);
```

`swap(boundaryId, fragmentOrTemplate, options?)` replaces the boundary contents
and rescans inserted content by default. For large stable shells that refresh
from local state, pass `strategy: "morph"` to preserve matching DOM nodes while
updating changed text, attributes, and children.

Use config-first `swap(...)` for the advanced variants:

```js
loader.swap({ boundary: "view", html });
loader.swap({ type: "ifChanged", boundary: "view", html: renderView });
loader.swap({ type: "many", updates: { filters, timeline }, scan: "once" });
loader.swap({ type: "many", ifChanged: true, updates, scan: "once" });
```

`type: "ifChanged"` skips cleanup, DOM replacement, and rescanning when the
next rendered HTML matches the previous swap for that boundary. The render
function form receives `{ boundary, boundaryId, loader, signals, handlers,
server, router, cache, scheduler }`.

`type: "many"` applies several boundary replacements before activation.
`updates` can be an object, `Map`, or iterable of `[boundaryId, html]` entries.
Each entry may also be `{ html, strategy, attach }` for per-boundary morph or
attach behavior. Pass `ifChanged: true` to skip unchanged entries inside the
batch. `scan: "once"` defers scanning until every update has been inserted, which
avoids interleaving cleanup/scan work across multiple same-tick refreshes.

Use `loader.defineRefreshPlan(...)` and `loader.refresh(scope)` for declarative
scope-to-boundary orchestration in signal-router dashboards:

```js
loader.defineRefreshPlan({
  timeline: {
    boundaries: ["view-timeline"],
    render({ signals }) {
      return {
        "view-timeline": { html: buildTimeline(signals), strategy: "morph" }
      };
    }
  },
  chrome: ["app-chrome", "view-filters"]
});

loader.refresh("timeline");
loader.refresh("chrome", { "app-chrome": chromeHtml, "view-filters": filtersHtml });
```

Use `type: "bind"` when local signal state owns a large region. The render
function runs once, tracks signal reads made while rendering, and schedules one
unchanged-aware refresh for same-tick signal changes. Pass `deps: [...]` to
subscribe only to explicit signal paths instead of every read inside `render`.
It returns a cleanup function.

```js
const stopTimeline = loader.swap({
  type: "bind",
  boundary: "view-timeline",
  deps: ["demoState.settings.rangeMode"],
  render({ signals }) {
    const view = buildTimelineView(signals.get("timeline.filters"));
    return html`<section>${view.items.map(renderTimelineItem)}</section>`;
  },
  strategy: "morph"
});
```

The `strategy` option controls how the boundary changes:

| Option | Behavior |
| --- | --- |
| `replace` | Default. Clean up all existing children, replace them, and activate the inserted subtree. |
| `morph` | Reconcile matching children by tag and stable identity, preserving unchanged nodes and cleaning up removed or replaced nodes. |

The `attach` option applies to morph swaps:

| Option | Behavior |
| --- | --- |
| `preserve` | Default. Preserved `on:attach` nodes keep their attach handlers across morph. |
| `rebind` | Preserved `on:attach` nodes rerun attach handlers after morph. |

Morph matching uses `async:key`, `data-key`, or `id` when present. Without a
stable identity it falls back to sibling order and tag name.

The `scan` option controls activation:

| Option | Behavior |
| --- | --- |
| `auto` | Default. For replacement, scan inserted roots. For morphing, scan changed or inserted roots. |
| `full` | Scan the boundary element and its subtree. |
| `none` | Do not scan inserted content; call `loader.scan(...)` later if needed. |

`type: "many"` also accepts `scan: "once"` as a batched `auto` scan after all
updates are applied.

When boundary patches can arrive independently, use `createBoundaryReceiver`.
It keeps per-boundary sequence state, applies signal/cache effects before the
HTML swap, flushes scheduled bindings, and ignores stale child patches after a
parent scope is destroyed.

```js
import { createBoundaryReceiver } from "@async/framework/browser";

const receiver = createBoundaryReceiver({
  loader: runtime.loader,
  signals: runtime.signals,
  cache: runtime.browser.cache,
  scheduler: runtime.scheduler,
  router: runtime.router
});

await receiver.apply({
  boundary: "product",
  seq: 1,
  signals: {
    product: { title: "Keyboard" }
  },
  cache: {
    browser: {
      "product:sku-1": { title: "Keyboard" }
    }
  },
  html: `
    <article>
      <h1 signal:text="product.title"></h1>
      <button type="button" on:click="server.cart.add(productId)">Add</button>
    </article>
  `
});
```

Sequence numbers are tracked per boundary: `hero` patch `10` can apply before
`reviews` patch `2`, while a later `hero` patch `9` is ignored. The receiver
does not add transport management, a transaction log, hydration, or component
rerendering.

## Examples

See [`examples/README.md`](./examples/README.md) for start commands and a short
description of every example.

| Example | Shows |
| --- | --- |
| [`examples/counter`](./examples/counter) | Signal text binding and delegated handlers |
| [`examples/product`](./examples/product) | Async signal loading, ready, and error boundaries |
| [`examples/components`](./examples/components) | Scoped fragment components and lifecycle hooks |
| [`examples/streaming`](./examples/streaming) | Boundary swaps with rescanned handlers |
| [`examples/server-call`](./examples/server-call) | Command events calling server functions |
| [`examples/router`](./examples/router) | CSR first render and local route boundary swaps |
| [`examples/partials`](./examples/partials) | Server-rendered partial fragments |
| [`examples/cache`](./examples/cache) | Browser/server cache declarations |
| [`examples/ssr`](./examples/ssr) | Server render output and browser activation snapshot |
| [`examples/vite-hono`](./examples/vite-hono) | Hono-backed Vite dev server plus client asset build |
| [`examples/vite-jsx-streaming`](./examples/vite-jsx-streaming) | JSX optimizer bootstrap with stream runtime slice selection |
| [`examples/size`](./examples/size) | Scenario-size fixtures for bundle and runtime slices |

## Pipeline

`@async/pipeline` owns GitHub Actions, Pages, and release lifecycle automation.
Edit [`pipeline.ts`](./pipeline.ts), then regenerate:

```bash
pnpm run pipeline:sync:generate
pnpm run pipeline:sync:check
pnpm run pipeline:github:check
```

Useful commands:

```bash
pnpm run bundle
pnpm run bundle:clean
pnpm run pipeline:verify
pnpm run pipeline:pages
pnpm run registry:lint
pnpm run pipeline:release:doctor
pnpm run release:check
```

Release artifacts such as `browser.js`, `browser.min.js`,
`browser.umd.min.js`, `browser.ts`, `browser.d.ts`, `framework.ts`,
`framework.d.ts`, and `server.js` are generated into `dist/`. The generated
`dist/` directory is the package root for `npm pack` and release publishing, so
the published package and CDN surface still expose those files at package root
rather than under `dist/`. The source `package.json` stays private and owns the
minimal public export spec, while omitting legacy `main`/`module`/`browser`
entry fields and generated package file lists. `scripts/build-framework-bundle.js`
derives the generated `dist/package.json` and staged artifact names from that
spec. Feature branches should edit source files and let `pnpm run bundle`,
`pnpm test`, `pnpm run pack:check`, or the generated release workflow
materialize the publish tree. Use `pnpm run bundle:clean` to remove local
generated artifacts after inspection.

`registry:lint` scans package source and examples for declared registry ids
such as signals, handlers, server functions, partials, routes, and components.
It writes `.async/registry-manifest.json` plus a per-file cache at
`.async/registry-lint-cache.json`, skips generated root bundles such as
`browser.umd.min.js`, and fails only when the same registry type and id are
declared with different normalized content. Duplicate declarations with the
same content are reported as dedupe candidates, not errors.

GitHub Pages builds through the generated `pages` job. This private repository
needs GitHub Pages support enabled before the generated job can deploy.

Stable releases use the generated `publish` job: it verifies the package,
creates or verifies the tag and GitHub Release, publishes npm with provenance,
then runs release doctor.

## Status

The core runtime is intentionally small. Build-required JSX has optimizer
artifacts for event, signal, stream, and children-fragment lowering, while full
compiler emission, lazy chunk manifests, TSRX lowering, server resource
compilation, and higher-level resumability metadata remain later layers. See
`specs/framework/12-composition-patterns.md` for composition pattern guidance
and planned source forms.

## Async And htmx

Async and htmx are both HTML-first and avoid a virtual DOM, but they optimize
for different boundaries.

| Area | htmx | Async |
| --- | --- | --- |
| Primary model | HTML attributes issue HTTP requests and swap server responses. | HTML attributes bind signals, command events, server calls, and route boundaries. |
| State | Server-owned hypermedia state; browser state is intentionally minimal. | Browser signal registry plus server signal patches and cache snapshots. |
| Server interaction | DOM attributes describe HTTP verbs, targets, and swaps. | `server.*(...)` commands call registered server functions and apply returned effects. |
| Routing | Usually server navigation or htmx-boosted navigation. | CSR, SPA, SSR, SSR-SPA, and MPA router modes built around partial boundaries. |
| Components | Server-rendered HTML fragments. | Scoped fragment functions today; higher layers can compile JSX/TSRX later. |
| Build story | No build by default. | Layer 1 is no-build/CDN; higher layers can add build or compiler steps. |

Use htmx when the server should own most interaction through hypermedia and
HTTP swaps. Use Async when you want an HTML-first runtime that also has local
signals, async resources, registered browser/server handlers, route partials,
and a path to higher compiler layers without changing the Layer 1 protocol.
