# Changelog

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
