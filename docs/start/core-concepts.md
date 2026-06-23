# Core Concepts

Async has a small set of runtime concepts that compose across no-build pages, server rendering, route partials, and build-required authoring.

## Layers

| Shorthand | Role | Requirement |
| --- | --- | --- |
| L1 | Browser runtime core | No build step |
| L1.5 | App, server, router, cache, and streaming bridge | Light server integration |
| L2 | JSX and optimizer profile | Build step required |

L1 and L1.5 are useful without L2. L2 is an authoring layer that lowers onto the same runtime contracts.

## Registries

Registries hold named behavior and data:

- `signal` for synchronous state.
- `asyncSignal` for cancellable async state.
- `handler` for delegated commands.
- `component` for scoped fragments.
- `partial` for route and server fragments.
- `route` for URL patterns.
- `cache.browser` and `cache.server` for split cache declarations.

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
