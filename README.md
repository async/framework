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

## Why Async

Async keeps the browser path small and explicit:

- Native HTML remains the document contract.
- Signals are the state boundary.
- `Async.use(...)` registers app declarations before or after startup.
- Handlers run through delegated DOM events.
- Async signals use native `AbortSignal` cancellation.
- Browser and server cache declarations are structurally split.
- Boundaries can be swapped out of order and rescanned.

It avoids a virtual DOM, hidden hydration pass, implicit startup fetch,
component rerender loop, and browser snapshots that leak server-only cache
contents.

Guide: [docs/start/why-async.md](./docs/start/why-async.md) · Contract:
[specs/framework/00-system-overview.md](./specs/framework/00-system-overview.md)

## The Abstraction Layers

Async uses L0-L7 abstraction layers. Layers describe the authoring surface;
capabilities are protocol properties that land at the lowest layer the
protocol allows.

| Layer | Name | Era anchor | Adds | Requires |
| --- | --- | --- | --- | --- |
| L0 | Enhance | jQuery/Backbone; htmx | Server-led HTML, native forms/actions, and behavior references on server-owned views | Script tag |
| L1 | Interpret | angular.js: runtime, no build | Runtime-interpreted app model: registries, components, lifecycle | Script tag or ESM |
| L2 | Bundle | Built SPAs | Build as delivery, client routing, app server | Build optional |
| L3 | SSR | React-without-JSX + SSR server | Server-rendered components with activation, no hydration | Server; build optional |
| L4 | Transform | React+JSX | JSX/TSX transforms lowering to protocol records | Build |
| L5 | Stream | Streaming SSR; Suspense | Progressive documents, boundary reveal ordering | Streaming server |
| L6 | Reorder | RSC; islands; Qwik-style `server$` | Out-of-order settling, co-located server functions, chunks, and plans automated by the Optimizer | Optimizer |
| L7 | Optimize | React Compiler; TSRX | Whole-program compilation | Spec only today |

Layers compose within one document: an L2-bundled SPA can host an L0-enhanced
form next to an L5-streamed boundary. This package ships the no-compiler layers
(L0-L3, L5) plus the first compiler-layer surfaces (`./jsx`, `./vite`,
`./runtime/*`).

Guide: [docs/start/layers.md](./docs/start/layers.md) · Contract:
[specs/framework/15-abstraction-layers.md](./specs/framework/15-abstraction-layers.md)

## How It Works

The framework is a protocol stack: HTML attributes connect to registered state
and behavior, server work returns explicit envelopes, route partials and stream
patches replace named boundaries, and SSR activation resumes already-rendered
HTML without hydration.

### HTML Protocol

Loader scans regular HTML attributes. The shorthand prefixes are the
author-facing syntax: `async:`, `signal:`, `on:`, `class:`, and `intersect:`.

| Attribute | Behavior |
| --- | --- |
| `async:container` | Marks a scannable app root |
| `async:boundary="product"` | Marks a replaceable boundary |
| `async:snapshot` | Holds serialized startup state |
| `async:component="Card"` | Mounts a registered component |
| `on:click="selectProduct"` | Delegated command event |
| `on:submit="preventDefault; save"` | Sequential command chain |
| `on:click="server.cart.add(productId)"` | Server command with signal args |
| `on:intersect="trackSection"` | Continuous intersection lifecycle event |
| `signal:text="product.title"` | Text binding |
| `signal:value="productId"` | Form value binding with writeback |
| `signal:attr:disabled="product.$loading"` | Attribute binding |
| `class:selected="selected"` | Class toggle from a signal path |

Guide: [docs/runtime/html-protocol.md](./docs/runtime/html-protocol.md) ·
Contract: [specs/framework/04-dom-protocol.md](./specs/framework/04-dom-protocol.md)

### Signals & Async Signals

Signals are the state boundary for DOM bindings, handlers, server effects,
router state, and async resources. Signal writes are synchronous; bindings,
lifecycle callbacks, effects, and async refreshes are scheduled in deterministic
phases.

```js
const signals = createSignalRegistry({
  productId: createSignal("sku-1")
});

const product = signals.asyncSignal("product", async function () {
  return this.server.products.get(this.signals.get("productId"));
});
```

Guide: [docs/runtime/signals.md](./docs/runtime/signals.md) · Contract:
[specs/framework/03-reactivity-system.md](./specs/framework/03-reactivity-system.md)

### App Hub & Registries

`Async` is the app hub singleton. It stores declarations, materializes fresh
runtime registries on startup, exposes inspection APIs, and queues loader work
that runs before a root attaches.

```js
Async.use({
  signal: { count: createSignal(0) },
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  }
});

Async.start({ root: document });
```

Guide: [docs/runtime/app-hub.md](./docs/runtime/app-hub.md) · Contract:
[specs/framework/02-runtime-kernel.md](./specs/framework/02-runtime-kernel.md)

### Components

Components are scoped fragment functions. They return strings or `html`
templates; Loader inserts and scans the result, and scoped signals, handlers,
effects, and lifecycle cleanup follow the fragment.

```js
const Toggle = component(function Toggle() {
  const selected = this.signal(false);

  return html`
    <button on:click="${this.handler(() => selected.update((value) => !value))}"
      class:selected="${selected}">
      Toggle
    </button>
  `;
});
```

Guide: [docs/runtime/components.md](./docs/runtime/components.md) · Contract:
[specs/framework/05-component-system.md](./specs/framework/05-component-system.md)

### Server Calls & Cache

Server registries run locally on the server. Browser proxies use an explicit
transport supplied by the app; responses can return values, signal patches,
browser cache patches, boundary HTML, redirects, or errors.

```js
const server = createServerProxy({
  endpoint: "/__async/server",
  transport,
  signals,
  loader,
  router
});

await server.cart.add("sku-1", 2);
```

Guide: [docs/runtime/server-calls.md](./docs/runtime/server-calls.md) ·
Contract:
[specs/framework/06-server-and-data-system.md](./specs/framework/06-server-and-data-system.md)

### Router & Partials

The router lives behind `@async/framework/router`. It handles URL matching,
route params, hash-based static-host routes, same-origin link and GET form
interception, route partial swaps, and route-only `router.*` state.

```js
Async.use({
  route: {
    "/products/:id": defineRoute("product.page")
  },
  partial: {
    "product.page"({ id }) {
      return html`<h1>Product ${id}</h1>`;
    }
  }
});
```

Guide: [docs/runtime/router-partials.md](./docs/runtime/router-partials.md) ·
Contract:
[specs/framework/07-routing-and-partials.md](./specs/framework/07-routing-and-partials.md)

### SSR & Activation

SSR uses related app definitions: a server runtime renders HTML plus snapshots,
and the browser runtime activates the existing document. Activation scans and
attaches; it does not hydrate, diff, patch, rerender, or fetch route fragments.

```js
const response = await createApp(serverApp, {
  target: "server",
  request
}).render("/products/123");
```

Guide: [docs/runtime/ssr-activation.md](./docs/runtime/ssr-activation.md) ·
Contract:
[specs/framework/08-resume-and-streaming.md](./specs/framework/08-resume-and-streaming.md)

### Streaming & Boundaries

Boundary swaps replace named regions and rescan inserted content by default.
`createBoundaryReceiver(...)` adds per-boundary sequence tracking, signal/cache
effects, and stale patch suppression for independently arriving patches.

```js
await receiver.apply({
  boundary: "product",
  seq: 1,
  signals: { product: { title: "Keyboard" } },
  html: `<h1 signal:text="product.title"></h1>`
});
```

Guide: [docs/runtime/streaming.md](./docs/runtime/streaming.md) · Contract:
[specs/framework/08-resume-and-streaming.md](./specs/framework/08-resume-and-streaming.md)

## Install & Load

Install from npm:

```bash
pnpm add @async/framework
```

Load directly from a CDN for no-build prototypes:

```html
<script type="module">
  import { Async, createSignal } from "https://unpkg.com/@async/framework@latest/browser.js";
</script>
```

Use `@async/framework/vite` when a Vite app needs the Hono development server
lane, a browser client build lane, or JSX optimizer reports.

Guide: [docs/start/install.md](./docs/start/install.md) · Build guide:
[docs/build/vite-hono.md](./docs/build/vite-hono.md)

## Examples

See [examples/README.md](./examples/README.md) for start commands and a short
description of every example.

| Example | Shows |
| --- | --- |
| [examples/counter](./examples/counter) | Signal text binding and delegated handlers |
| [examples/product](./examples/product) | Async signal loading, ready, and error boundaries |
| [examples/components](./examples/components) | Scoped fragment components and lifecycle hooks |
| [examples/streaming](./examples/streaming) | Boundary swaps with rescanned handlers |
| [examples/server-call](./examples/server-call) | Command events calling server functions |
| [examples/hateoas-actions](./examples/hateoas-actions) | Hono-rendered HATEOAS links and forms enhanced into partial swaps |
| [examples/router](./examples/router) | CSR first render and local route boundary swaps |
| [examples/partials](./examples/partials) | Server-rendered partial fragments |
| [examples/cache](./examples/cache) | Browser/server cache declarations |
| [examples/ssr](./examples/ssr) | Server render output and browser activation snapshot |
| [examples/vite-hono](./examples/vite-hono) | Hono-backed Vite dev server plus client asset build |
| [examples/vite-jsx-streaming](./examples/vite-jsx-streaming) | JSX optimizer bootstrap with stream runtime slice selection |
| [examples/size](./examples/size) | Scenario-size fixtures for bundle and runtime slices |

## Async And htmx

Async and htmx are both HTML-first and avoid a virtual DOM, but they optimize
for different boundaries. In layer model terms, htmx-style hypermedia is the L0
Enhance layer, and in Async it stays available at every layer above.

| Area | htmx | Async |
| --- | --- | --- |
| Primary model | HTML attributes issue HTTP requests and swap server responses. | Server-generated HTML can stay primary; Async attributes add behavior, state, actions, and boundaries. |
| State | Server-owned hypermedia state; browser state is intentionally minimal. | Server-led HTML can stay server-owned; browser signals are available when a view needs local state. |
| Server interaction | DOM attributes describe HTTP verbs, targets, and swaps. | Native `method`/`action` flows can submit to any backend; partial responses can return HTML or envelopes for boundary swaps. |
| Routing | Usually server navigation or htmx-boosted navigation. | MPA and SSR keep navigation server-led; CSR, SPA, and signals modes opt into client-owned routing. |
| Components | Server-rendered HTML fragments. | Scoped fragment functions today; the compiler layers add JSX/TSRX authoring. |
| Build story | No build by default. | Layers L0-L3 and L5 are no-build/CDN; the compiler layers (L4, L6, L7) add build or compiler steps. |

Async supports server-led views: any backend can render HTML strings for full
documents or fragments, native forms can post through ordinary `method` and
`action` attributes, and browser navigation can stay native in MPA/SSR modes.
Add Async attributes only where a fragment needs local signals, command
handlers, server functions, boundary swaps, or streamed patches. Use htmx when
its HTTP-attribute model is the desired contract. Use Async when server-led HTML
should share a protocol with local signals, registered browser/server handlers,
route partials, streaming boundaries, and the compiler layers. See
[examples/hateoas-actions](./examples/hateoas-actions) for a Hono-rendered
HATEOAS flow using links, forms, verbs, and partial swaps.

Guide: [docs/start/why-async.md](./docs/start/why-async.md) · Contract:
[specs/framework/15-abstraction-layers.md](./specs/framework/15-abstraction-layers.md)

## Status

The core runtime is intentionally small. Build-required JSX (L4) has optimizer
artifacts for event, signal, stream, and children-fragment lowering, while full
compiler emission, lazy chunk manifests, TSRX lowering, server resource
compilation, and higher-level resumability metadata remain compiler-layer work
(L6 and L7).

Contracts: [specs/framework/12-composition-patterns.md](./specs/framework/12-composition-patterns.md) ·
[specs/framework/15-abstraction-layers.md](./specs/framework/15-abstraction-layers.md) ·
[specs/framework/16-whole-program-compiler.md](./specs/framework/16-whole-program-compiler.md)

## Documentation Map

| Page | Question it answers |
| --- | --- |
| [Getting Started](./docs/start/getting-started.md) | What is the smallest running app? |
| [Install & Load](./docs/start/install.md) | How do npm, CDN, UMD, and import-map loading work? |
| [Why Async](./docs/start/why-async.md) | What does Async keep and avoid? |
| [Core Concepts](./docs/start/core-concepts.md) | Which runtime pieces make up an app? |
| [Layers](./docs/start/layers.md) | How do L0-L7 fit together? |
| [Runtime Overview](./docs/runtime/overview.md) | What happens when a root starts? |
| [App Hub & Registries](./docs/runtime/app-hub.md) | How are declarations registered, inspected, and materialized? |
| [HTML Protocol](./docs/runtime/html-protocol.md) | Which attributes connect HTML to runtime behavior? |
| [Signals & Async Signals](./docs/runtime/signals.md) | How does state update and async work refresh? |
| [Components](./docs/runtime/components.md) | How do scoped fragments, children, lifecycle, and intersection work? |
| [Router & Partials](./docs/runtime/router-partials.md) | How do routes, partials, modes, and boundaries work? |
| [Server Calls & Cache](./docs/runtime/server-calls.md) | How do server functions, envelopes, and cache split work? |
| [SSR & Activation](./docs/runtime/ssr-activation.md) | How does server-rendered HTML start in the browser? |
| [Streaming & Boundaries](./docs/runtime/streaming.md) | How do swaps, refresh plans, morphing, and patch ordering work? |
| [Build Profile](./docs/build/profile.md) | What does the compiler-layer profile promise? |
| [Vite & Hono](./docs/build/vite-hono.md) | How does the Vite plugin wire a Hono dev server and client build? |
| [Entrypoints](./docs/reference/entrypoints.md) | Which package subpaths expose which surfaces? |
| [Examples](./docs/reference/examples.md) | Which runnable example demonstrates each surface? |

## Contributing & Release

Common checks:

```bash
pnpm run pipeline:pages
pnpm run registry:lint
git diff --check
```

Pipeline and release automation are generated from `pipeline.ts`; update that
source and run the sync checks before changing generated workflow output.

Guide: [CONTRIBUTING.md](./CONTRIBUTING.md)
