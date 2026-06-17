# Changelog

## Unreleased

- Added `createBoundaryReceiver(...)` for optional out-of-order boundary patch
  delivery with per-boundary sequence checks, signal/cache effect ordering,
  scheduler flushing, redirects, and destroyed parent-scope filtering.

## 0.8.0 - 2026-06-17

- Split browser and server entrypoints with `@async/framework/browser`,
  `@async/framework/server`, browser-only CDN bundles, and server-only local
  function registry exports.
- Added `createRequestContextStore(...)` for Node request-scoped server
  function context using `AsyncLocalStorage`.
- Added the Layer 1.5 scheduler for deterministic signal binding, lifecycle,
  effect, async, and post-flush phases.
- Added browser microtask scheduling by default and manual scheduler flushing for
  server render paths.
- Threaded `this.scheduler` through loader, handler, component, async signal,
  server, router, and partial contexts.

## 0.7.0 - 2026-06-17

- Added router navigation abort/version guards so stale route partials cannot
  clobber newer navigations, and route partial contexts receive `this.abort`.
- Added ranked route matching so static and dynamic routes win over wildcard
  fallbacks regardless of registration order.
- Added `readSnapshot(...)` and automatic browser activation from SSR snapshot
  scripts.
- Fixed repeated server result application when proxy/server envelopes pass
  through namespace or handler callers.
- Added in-flight `cache.getOrSet(...)` deduplication and clear proxy errors for
  `File`, `Blob`, and `FormData` values that the JSON transport cannot send.
- Changed `framework.ts` from a source facade to a bundled TypeScript source
  entrypoint.

## 0.6.0 - 2026-06-17

- Added `Loader` as the canonical public loader factory, including
  `Async.Loader(...)` for UMD script-tag usage, while keeping `AsyncLoader` as
  a compatibility alias.
- Added generated root CDN artifacts: `framework.min.js`, `framework.umd.js`,
  `framework.umd.min.js`, `framework.ts`, and `framework.d.ts`.
- Added package exports and docs for ESM, compact ESM, UMD, compact UMD, and
  TypeScript source/types entrypoints.
- Added exported helpers to the UMD-only `globalThis.Async` object for
  script-tag CDN usage while keeping ESM `Async` as the app hub export.
- Added UMD namespace conflict checks so generated helpers cannot silently
  overwrite app-hub fields such as `use`, `start`, or `registry`.
- Added `registry:lint`, a cached package linter that emits a local registry
  manifest and detects conflicting signal, handler, server, partial, route, or
  component declarations while skipping generated root bundles.

## 0.5.0 - 2026-06-17

- Added `this.suspense(signalRef, views)` for component-owned async boundary
  templates without adding a wrapper, rerender loop, hydration, or promise
  throwing.
- Added `signal:prop:*` property bindings and tests for inline signal refs in
  `signal:text`, `signal:attr:*`, and `signal:prop:*`.
- Added explicit `unregister(id)` APIs to runtime registries and component
  cleanup for scoped signals, async signals, computed signals, and handlers.
- Added boundary swap cleanup for mounted component fragments and old DOM
  bindings.
- Added server-call normalization for async signals, including returned signal
  effects, proxy abort propagation, and stable server error messages.
- Added `prevent` as a command-event alias for `preventDefault`.

## 0.4.0 - 2026-06-17

- Added a generated root `framework.js` ESM bundle for UNPKG browser imports.
- Expanded the README with Async layer definitions and an htmx comparison.
- Added `on:attach` as the canonical component attach lifecycle pseudo-event
  with `on:mount` kept as a compatibility alias.
- Added top-level `class:*` bindings, including aggregate `class:`
  string/object/array class sets.
- Added inline `html` template bindings for signal refs, class arrays/objects,
  `value="${signalRef}"`, and generated component handlers via
  `this.handler(fn)`.
- Added generated component-local signals via `this.signal(initial)`.

## 0.3.0 - 2026-06-17

- Added a shared registry store behind `Async`, app runtimes, and concrete
  registries so apps can inspect signals, handlers, server ids, routes,
  partials, components, and split cache state from one place.
- Added configurable HTML attribute prefixes, with `async:*`, `signal:*`, and
  `on:*` as the defaults plus explicit support for `data-async-*`,
  `data-signal-*`, and `data-on-*`.
- Declared the UNPKG package entry explicitly so the package root can be used as
  a no-build browser ESM CDN import.
- Documented the UNPKG import-map setup for importing `@async/framework` by
  package name in no-build browser apps.

## 0.2.2 - 2026-06-17

- Fixed release doctor validation to accept the pipeline-generated GitHub
  Release description wrapper around changelog entries.

## 0.2.1 - 2026-06-17

- Fixed the generated release pipeline for the no-build package by verifying
  npm and GitHub Release parity without requiring a GitHub Packages mirror.

## 0.2.0 - 2026-06-17

- Added `csr` router mode for client-side first route rendering plus local SPA
  navigation through route partial boundary swaps.

## 0.1.0 - 2026-06-17

- Reset `@async/framework` to Layer 1 AsyncLoader.
- Added signals, async signals, delegated handlers, component fragment helpers,
  and out-of-order boundary swaps.
- Added Layer 2 command events, server calls, route partials, and client router
  primitives.
- Added `Async.use(...)`, app runtimes, `createSignal`, `defineRoute`,
  `defineComponent`, split browser/server cache registries, and SSR render
  activation helpers.
- Added no-build static examples and Node test coverage.
- Added generated `@async/pipeline` verification, GitHub Pages, and release
  workflow support.
