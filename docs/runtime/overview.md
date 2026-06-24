# Runtime Overview

The runtime starts from a root, scans protocol attributes, registers bindings, and keeps DOM updates tied to explicit signals.

## Start sequence

1. Register declarations with `Async.use(...)`.
2. Start a root with `Async.start({ root: document })`.
3. Restore any `async:snapshot` data under the root.
4. Scan for containers, boundaries, handlers, signal bindings, components, and lifecycle hooks.
5. Start the router if route declarations are present.

The built-in router owns URL matching, link and GET form interception, hash
routes, route params, route partial swaps, and route-only `router.*` state. Use
`createRouter(...)` directly when a custom runtime needs router control without
going through `Async.start(...)`.

## Scheduler

The scheduler batches binding work by phase:

- binding updates for text, attributes, properties, classes, and values.
- lifecycle callbacks such as `on:attach`.
- effects and async signal refreshes.
- post-flush work after DOM changes settle.

## Runtime inspection

The public runtime object exposes the active loader, signal registry, handler registry, router, cache, scheduler, and registered app declarations.

```js
const runtime = Async.start({ root: document });

runtime.signals.get("count");
runtime.router?.navigate("/products/sku-1");
runtime.loader.swap("route", "<h1>Next route</h1>");
```

## Browser and server split

Browser code owns DOM scanning, signals, events, route swaps, and browser cache entries. Server code owns request context, server cache entries, server functions, render output, and streamed patches.
