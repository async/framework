# @async/framework

Layer 1 AsyncLoader plus small Layer 2 app, routing, server, cache, and SSR
primitives for no-build web apps: signals, async signals, delegated command
events, scoped fragment components, server calls, route partials, and
out-of-order boundary swaps without a virtual DOM.

```bash
pnpm add @async/framework
```

```html
<main data-async-container>
  <button type="button" on:click="decrement">-</button>
  <strong data-async-text="count"></strong>
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

`@async/framework` is the browser bootloader layer for Async apps. It keeps the
runtime small and explicit:

- No build step for consumers.
- No virtual DOM, diff path, hydration runtime, or component rerender loop.
- Signals are the state boundary.
- `Async.use(...)` registers app declarations before or after startup.
- Handlers live in a registry and run through delegated DOM events.
- Async signals use native `AbortSignal` cancellation and suppress stale async
  completions.
- Browser and server cache declarations are structurally split.
- Boundaries can be swapped out of order and rescanned, which keeps server
  streaming and partial HTML replacement simple.

Higher layers can still add JSX lowering, chunk manifests, server compilation,
or resumability metadata later. Layer 1 stays plain HTML plus ESM.

## Install

```bash
pnpm add @async/framework
```

The package is ESM-only and supports Node.js 24 and newer for tests, examples,
and package lifecycle tooling. Browser consumers import ESM directly.

## Core API

```js
import {
  AsyncLoader,
  Async,
  asyncSignal,
  createApp,
  createCacheRegistry,
  createComponentRegistry,
  component,
  computed,
  createSignal,
  createHandlerRegistry,
  createPartialRegistry,
  createRouteRegistry,
  createRouter,
  createServerProxy,
  createServerRegistry,
  createSignalRegistry,
  defineApp,
  defineCache,
  defineComponent,
  defineRoute,
  delay,
  effect,
  html,
  route,
  signal
} from "@async/framework";
```

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

Singular registry keys are canonical: `signal`, `handler`, `server`,
`partial`, `route`, `component`, and nested `cache.browser` / `cache.server`.

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
| `this.refresh()` | Start a new run |

`this.abort` can be passed directly to `fetch` or to `delay`:

```js
await delay(250, this.abort);
```

If a dependency read through `this.signals.get(...)` changes, the async signal
reruns and the previous run is aborted.

## HTML Protocol

AsyncLoader scans regular HTML attributes:

| Attribute | Behavior |
| --- | --- |
| `data-async-container` | Marks a scannable app root |
| `on:click="selectProduct"` | Delegated command event |
| `on:submit="preventDefault; save"` | Sequential command chain |
| `on:click="server.cart.add(productId)"` | Server command with signal args |
| `data-async-text="product.title"` | Text binding |
| `data-async-value="productId"` | Form value binding with writeback |
| `data-async-attr:disabled="product.$loading"` | Attribute binding |
| `data-async-class:selected="selected"` | Class toggle |
| `data-async-boundary="product"` | Async or streamed replacement boundary |
| `data-async-loading="product"` | Boundary loading template |
| `data-async-ready="product"` | Boundary ready template |
| `data-async-error="product"` | Boundary error template |

```html
<section data-async-boundary="product">
  <template data-async-loading="product">
    <p>Loading...</p>
  </template>
  <template data-async-ready="product">
    <h1 data-async-text="product.title"></h1>
  </template>
  <template data-async-error="product">
    <p data-async-text="product.$error.message"></p>
  </template>
</section>
```

### Command Events

`on:*` works with any native DOM event name. `on:mount` and `on:visible` are
reserved pseudo-events with cleanup support.

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
<main data-async-container>
  <nav>
    <a href="/">Home</a>
    <a href="/products/sku-1">Product</a>
  </nav>

  <section data-async-boundary="route"></section>
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
<section data-async-boundary="route">
  <!-- server-rendered route partial -->
</section>
<script type="application/json" data-async-snapshot>{}</script>
```

Browser activation scans the existing HTML and attaches events. It does not
hydrate, diff, patch, or rerender:

```js
createApp(browserApp, {
  root: document,
  snapshot,
  server: createServerProxy({ endpoint: "/__async/server" })
}).start();
```

## Components

Components are scoped fragment functions. They return strings or `html`
templates; AsyncLoader inserts and scans the result. There is no virtual node
type and no rerender loop.

```js
const Toggle = defineComponent(function Toggle() {
  const selected = this.signal("selected", false);
  const toggle = this.handler("toggle", function () {
    selected.update((value) => !value);
  });

  this.onMount((target) => {
    target.dataset.mounted = "true";
  });

  return html`
    <button
      type="button"
      on:click="${toggle}"
      data-async-class:selected="${selected.id}"
      data-async-attr:aria-pressed="${selected.id}"
    >
      Toggle
    </button>
  `;
});

const loader = AsyncLoader({ root: document });
loader.mount(document.querySelector("#app"), Toggle);
```

`component(...)` remains a compatibility alias for `defineComponent(...)`.

Component helpers:

| Helper | Behavior |
| --- | --- |
| `this.signal(name, initial)` | Scoped get-or-create signal |
| `this.computed(name, fn)` | Scoped computed signal |
| `this.asyncSignal(name, fn)` | Scoped async signal |
| `this.effect(fn)` | Scoped effect with cleanup |
| `this.handler(name, fn)` | Scoped handler registry entry |
| `this.render(Component, props)` | Child fragment rendering |
| `this.onMount(fn)` | One-shot mount hook |
| `this.onVisible(fn)` | One-shot visibility hook |

`on:mount` and `on:visible` are loader pseudo-events with cleanup support. They
do not drive component rerenders.

## Streaming

Out-of-order HTML can target a boundary and keep delegated handlers working:

```js
loader.swap(
  "product",
  `
    <article>
      <h1 data-async-text="product.title"></h1>
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
pnpm run pipeline:release:doctor
pnpm run release:check
```

GitHub Pages builds through the generated `pages` job. This private repository
needs GitHub Pages support enabled before the generated job can deploy.

Stable releases use the generated `publish` job: it verifies the package,
creates or verifies the tag and GitHub Release, publishes npm with provenance,
then runs release doctor.

## Status

The core runtime is intentionally small. Bundling, lazy chunk manifests, JSX
lowering, TSRX lowering, server resource compilation, and higher-level
resumability metadata are deferred to later layers.
