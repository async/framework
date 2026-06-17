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

`@async/framework` is the Layer 1 runtime plus the first Layer 2 app/server
primitives. It keeps the runtime small and explicit:

- No build step for Layer 1 consumers.
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

| Layer | Name | Requirement | Purpose |
| --- | --- | --- | --- |
| 1 | Runtime bootloader | No build. CDN or direct ESM import. | Signals, async signals, scheduler, handlers, command events, lifecycle pseudo-events, scoped fragments, and boundary swaps. |
| 2 | App/server layer | Light server integration. No app compiler required. | `Async.use(...)`, router modes, server function proxy, partial registry, SSR output, browser activation, and split browser/server cache. |
| 3 | Authoring build | Build step required. | JSX, ESM, and TypeScript authoring that lowers into Layer 1 HTML attributes and Layer 2 registries. |
| 4 | Chunk and resumability metadata | Build metadata required. | Lazy module manifests, visibility/prefetch hints, resource graphs, and resumability records that the bootloader can consume. |
| 5 | Framework compiler | Compiler required. | Server/client partitioning, code motion, optimized registry generation, serialized closures, and deeper resumability transforms. |
| 6 | TSRX and intent layer | Higher-level compiler required. | More declarative author intent, AI/compiler-friendly metadata, and source forms that generate lower-layer Async apps. |

The package in this repository intentionally focuses on Layers 1 and 2. Layers
3 through 6 are higher authoring surfaces, not extra runtime requirements for
plain HTML apps.

## Install

```bash
pnpm add @async/framework
```

The package is ESM-only and supports Node.js 24 and newer for tests, examples,
and package lifecycle tooling. Browser consumers import ESM directly.

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
| `browser.ts` | Bundled TypeScript source | TS-aware runtimes and higher-layer tooling |
| `browser.d.ts` | Type declarations | TypeScript declarations for the browser API |

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

## Core API

For npm consumers, `@async/framework` uses conditional exports: browser-aware
tooling receives the browser entry, while Node receives the server-capable
entry. Use explicit subpaths when the target matters.

```js
import {
  Async,
  Loader,
  attributeName,
  asyncSignal,
  createApp,
  createCacheRegistry,
  createComponentRegistry,
  component,
  computed,
  createSignal,
  createHandlerRegistry,
  createPartialRegistry,
  createRegistryStore,
  createRouteRegistry,
  createRouter,
  createScheduler,
  createServerProxy,
  createSignalRegistry,
  defineAttributeConfig,
  defineApp,
  defineCache,
  defineComponent,
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

const runtime = createApp(app, { root: document }).start();
runtime.use("handler", {
  increment() {
    this.signals.update("count", (count) => count + 1);
  }
});
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
Every runtime and concrete registry also points at the same backing store:

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
    signal: "data-signal-",
    on: "data-on-"
  }
});
```

That maps to `data-async-container`, `data-on-click="save"`,
`data-signal-text="product.title"`, and `data-class-selected="selected"`.

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
remains as a compatibility alias for `on:attach`.

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

Server registries run locally on the server and proxies call an HTTP endpoint
from the browser. Both expose the same dotted call shape.

```js
import {
  createServerRegistry
} from "@async/framework/server";

const server = createServerRegistry({
  "cart.add"(productId, quantity) {
    return {
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
  signals,
  loader,
  router
});

await server.cart.add("sku-1", 2);
```

Server responses can include `value`, `signals`, `boundary`, `html`, `redirect`,
or `error`. Signal patches are applied before boundary swaps and redirects.
Namespace calls such as `server.cart.add(...)` return the unwrapped `value`.

When an async signal calls a server namespace function, the framework passes the
active abort signal through proxy calls. Returned server effects such as
`signals`, `cache.browser`, `boundary/html`, and `redirect` are applied before
the async signal stores the unwrapped `value`.

### Router And Partials

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

Router modes:

| Mode | Initial route | Later navigation |
| --- | --- |
| `csr` | Client renders local partial into boundary | Client renders local partial and swaps |
| `spa` | Existing HTML may already contain route | Client renders local partial and swaps |
| `ssr` | Server rendered document | Browser navigates normally |
| `ssr-spa` | Server rendered document/route boundary | Fetch route partial, apply effects, swap |
| `mpa` | Any document source | Browser navigates normally |

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

Register a wildcard route for an explicit fallback page:

```js
Async.use({
  route: {
    "/": defineRoute("home.page"),
    "/products/:id": defineRoute("product.page"),
    "*": defineRoute("notFound.page")
  }
});
```

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
hydrate, diff, patch, or rerender:

```js
createApp(browserApp, {
  root: document,
  server: createServerProxy({ endpoint: "/__async/server" })
}).start();
```

If an `async:snapshot` script is present under the root or document,
`createApp(...)` reads it automatically. You can also inspect it directly:

```js
const snapshot = readSnapshot(document);
```

## Components

Components are scoped fragment functions. They return strings or `html`
templates; Loader inserts and scans the result. There is no virtual node
type and no rerender loop.

```js
const Toggle = defineComponent(function Toggle() {
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

`component(...)` remains a compatibility alias for `defineComponent(...)`.

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
| `this.render(Component, props)` | Child fragment rendering |
| `this.suspense(signalRef, views)` | Async boundary template helper |
| `this.on(event, fn)` | Fragment lifecycle fallback for `attach`, `visible`, and `destroy` |
| `this.onMount(fn)` | Compatibility alias for `this.on("attach", fn)` |
| `this.onVisible(fn)` | Compatibility alias for `this.on("visible", fn)` |

`this.suspense(...)` is sugar for Loader boundaries:
`asyncSignal + async:boundary + async:* templates`. It emits only templates. The
caller owns the boundary element, and the loader chooses the loading, ready, or
error template from the async signal status.

```js
const Product = defineComponent(function Product() {
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

Component-scoped signals and handlers are unregistered when the mounted
fragment is destroyed. `loader.swap(...)` cleans up old DOM bindings and mounted
component fragments under the swapped boundary before inserting the new HTML.

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

`swap(boundaryId, fragmentOrTemplate)` replaces the boundary contents and
rescans the inserted fragment.

## Examples

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
pnpm run pipeline:verify
pnpm run pipeline:pages
pnpm run registry:lint
pnpm run pipeline:release:doctor
pnpm run release:check
```

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

The core runtime is intentionally small. Bundling, lazy chunk manifests, JSX
lowering, TSRX lowering, server resource compilation, and higher-level
resumability metadata are deferred to later layers.

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
