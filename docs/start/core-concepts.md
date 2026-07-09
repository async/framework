# Core Concepts

Async has a small set of runtime concepts that compose across no-build pages, server rendering, route partials, and build-required authoring.

## Layers

Async uses L0-L7 abstraction layers: layers describe the authoring surface, and capabilities are protocol properties available from the lowest layer the protocol allows.

| Layer | Name | Adds | Requires |
| --- | --- | --- | --- |
| L0 | Enhance | Server-led HTML, native forms/actions, and behavior references on server-owned views | Script tag |
| L1 | Interpret | Runtime app model: registries, components, lifecycle | No build |
| L2 | Bundle | Build as delivery, client routing, app server | Build optional |
| L3 | SSR | Server-rendered components with activation | Server |
| L4 | Transform | JSX/TSX lowering to protocol records | Build |
| L5 | Stream | Progressive documents, reveal ordering | Streaming server |
| L6 | Reorder | Co-located server-function extraction, plans, chunks, runtime slices | Optimizer |
| L7 | Optimize | Whole-program compiler | Spec only |

The no-compiler layers (L0-L3, L5) are useful without the compiler layers (L4, L6, L7); compiler output lowers onto the same runtime contracts. See the [Layers guide](#/docs/layers) for the full layer model.

## Registries

Registries hold named behavior and data:

- `signal` for synchronous state.
- `asyncSignal` for cancellable async state.
- `handler` for delegated commands.
- `component` for scoped fragments.
- `partial` for route and server fragments.
- `route` for URL patterns.
- `cache.browser` and `cache.server` for split cache declarations.

## Built-In Router

Async has a built-in router for URL-backed state and route partials. Register
patterns with `defineRoute(...)`, then start the router through `Async.start(...)`
and use `Async.router` for imperative navigation.

Use the router when an app needs:

- route params such as `/products/:id`;
- static-host hash routes such as `#/docs/getting-started`;
- same-origin link and GET form interception;
- route partials swapped into `async:boundary="route"`;
- route-only state through `mode: "signals"`.

The router publishes `router.*` signals, so DOM bindings and handlers can read
the current path, params, query, matched route, pending state, and errors.

## Protocol first

The DOM protocol is the durable surface. Markup says where behavior attaches:

```html
<button on:click="cart.add" signal:attr:disabled="cart.$loading">
  Add to cart
</button>
```

The runtime scans the root, resolves registry entries, and keeps bindings current through signals and scheduled effects.

## Boundary swaps

`async:boundary` marks a region that can receive HTML from a handler, server call, route partial, or stream patch.

```html
<section async:boundary="route"></section>
```

When new HTML enters a boundary, Async scans it again so inserted handlers, signals, components, and lifecycle hooks work immediately.
