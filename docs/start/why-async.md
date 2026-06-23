# Why Async

Async is for apps that want direct HTML, explicit state, and server-friendly fragments without adopting a render loop.

## What it keeps

- Native HTML remains the document contract.
- ESM modules register behavior explicitly.
- Signals are the state boundary.
- Server calls and route partials return simple response envelopes.
- Boundary swaps rescan the inserted HTML for `on:`, `signal:`, `class:`, `intersect:`, and component protocol.

## What it avoids

- No virtual DOM.
- No hidden hydration pass.
- No implicit startup fetch.
- No component rerender loop.
- No server-only cache contents in browser snapshots.

## Who it fits

Async fits pages that need progressive reactive islands, server-backed actions, route fragments, streamed HTML, or a small runtime surface that can be understood from the markup.

It is also a foundation for higher authoring layers. Build-required JSX and compiler tooling should lower to the same HTML protocol, registries, route partials, and boundary patches.

## Useful tradeoff

Async asks authors to name runtime behavior directly. That makes the markup more explicit, but it also keeps the browser path small and makes server output easy to inspect.
