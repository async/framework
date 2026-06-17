# @async/framework

Layer 1 AsyncLoader for no-build web apps: signals, async signals, delegated
handlers, scoped fragment components, and out-of-order boundary swaps without a
virtual DOM.

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
  AsyncLoader,
  createHandlerRegistry,
  createSignalRegistry,
  signal
} from "@async/framework";

const signals = createSignalRegistry({
  count: signal(0)
});

const handlers = createHandlerRegistry({
  increment() {
    this.signals.update("count", (count) => count + 1);
  },
  decrement() {
    this.signals.update("count", (count) => count - 1);
  }
});

AsyncLoader({ root: document, signals, handlers }).start();
```

## What It Is

`@async/framework` is the browser bootloader layer for Async apps. It keeps the
runtime small and explicit:

- No build step for consumers.
- No virtual DOM, diff path, hydration runtime, or component rerender loop.
- Signals are the state boundary.
- Handlers live in a registry and run through delegated DOM events.
- Async signals use native `AbortSignal` cancellation and suppress stale async
  completions.
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
  asyncSignal,
  component,
  computed,
  createHandlerRegistry,
  createSignalRegistry,
  delay,
  effect,
  html,
  signal
} from "@async/framework";
```

### Signals

```js
const signals = createSignalRegistry();

signals.register("count", signal(0));
signals.register("products", signal([]));

signals.get("count");
signals.set("count", 1);
signals.update("count", (count) => count + 1);
signals.subscribe("count", (count) => console.log(count));
signals.ref("count").value;
```

Initializer maps are supported:

```js
const signals = createSignalRegistry({
  count: signal(0),
  products: signal([])
});
```

Nested paths read through the first registered signal id:

```js
signals.register("product", signal({ title: "Keyboard" }));
signals.get("product.title");
signals.set("product.title", "Headphones");
```

### Async Signals

Async signals add loading state, error state, versions, refresh, and cancel to a
normal signal value.

```js
const signals = createSignalRegistry({
  productId: signal("sku-1")
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
| `on:click="selectProduct"` | Delegated handler call |
| `on:submit="save preventDefault"` | Handler plus built-in token |
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

## Components

Components are scoped fragment functions. They return strings or `html`
templates; AsyncLoader inserts and scans the result. There is no virtual node
type and no rerender loop.

```js
const Toggle = component(function Toggle() {
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

Layer 1 is intentionally small. Bundling, lazy chunk manifests, JSX lowering,
TSRX lowering, server resource compilation, and higher-level resumability
metadata are deferred to later layers.
