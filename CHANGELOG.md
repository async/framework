# Changelog

## Unreleased

- Added scheduler commit-phase ordering for app-level loader swaps and streamed
  boundary patches, including frame-backed commits and deterministic
  non-browser fallbacks.
- Added declaration conventions for `Async.use(...)` so registered kinds can
  materialize on register, start, or demand under configurable duplicate
  policies.
- Bundle size from bundled TypeScript source: `browser.ts` raw 256,039 B (256.0 KB / 0.256 MB), gzip 47,748 B (47.7 KB / 0.048 MB), br 39,376 B (39.4 KB / 0.039 MB) -> `browser.min.js` raw 107,985 B (108.0 KB / 0.108 MB), gzip 31,556 B (31.6 KB / 0.032 MB), br 27,711 B (27.7 KB / 0.028 MB); delta raw -148,054 B (-148.1 KB / -0.148 MB), gzip -16,192 B (-16.2 KB / -0.016 MB), br -11,665 B (-11.7 KB / -0.012 MB).

## 0.14.0 - 2026-06-26

- Updated the Flow bridge to consume `@async/flow` 0.10.0 through the
  scheduler-free integration subpaths and shared protocol brands.
- Bundle size from bundled TypeScript source: `browser.ts` raw 236,170 B (236.2 KB / 0.236 MB), gzip 44,028 B (44.0 KB / 0.044 MB), br 36,421 B (36.4 KB / 0.036 MB) -> `browser.min.js` raw 99,320 B (99.3 KB / 0.099 MB), gzip 29,136 B (29.1 KB / 0.029 MB), br 25,662 B (25.7 KB / 0.026 MB); delta raw -136,850 B (-136.9 KB / -0.137 MB), gzip -14,892 B (-14.9 KB / -0.015 MB), br -10,759 B (-10.8 KB / -0.011 MB).

## 0.13.0 - 2026-06-26

- Moved streaming, Flow, and router browser code behind explicit
  `@async/framework/stream`, `@async/framework/flow`, and
  `@async/framework/router` subpaths so the default browser asset stays focused
  on the core runtime.
- Added guarded Flow and router startup errors when default-browser apps use
  those declarations without importing their opt-in subpath.
- Added a bundle optimizer pipeline for Brotli-oriented candidate measurement
  and diagnostics.
- Bundle size from bundled TypeScript source: `browser.ts` raw 227,580 B (227.6 KB / 0.228 MB), gzip 42,303 B (42.3 KB / 0.042 MB), br 35,028 B (35.0 KB / 0.035 MB) -> `browser.min.js` raw 95,660 B (95.7 KB / 0.096 MB), gzip 27,847 B (27.8 KB / 0.028 MB), br 24,709 B (24.7 KB / 0.025 MB); delta raw -131,920 B (-131.9 KB / -0.132 MB), gzip -14,456 B (-14.5 KB / -0.014 MB), br -10,319 B (-10.3 KB / -0.010 MB).

## 0.12.6 - 2026-06-24

- Added the app-level `Async.router` facade with queued `navigate`, `prefetch`,
  `ready`, `match`, and nested `loader` access before runtime startup.
- Added router transition planning that skips duplicate active-route work and
  uses signal-only updates for same-view navigation unless `force: true` is
  requested.
- Made `createRouter(...)` start immediately, rejected separate signal registry
  injection, and kept route and partial registration on the app registry path.
- Documented routing layers from simple `Async.use({ route, partial })` setup
  through signal-router dashboards, refresh scopes, and custom runtime wiring.
- Bundle size from bundled TypeScript source: `browser.ts` raw 366,552 B (366.6 KB / 0.367 MB), gzip 67,930 B (67.9 KB / 0.068 MB), br 55,263 B (55.3 KB / 0.055 MB) -> `browser.min.js` raw 153,961 B (154.0 KB / 0.154 MB), gzip 44,479 B (44.5 KB / 0.044 MB), br 38,561 B (38.6 KB / 0.039 MB); delta raw -212,591 B (-212.6 KB / -0.213 MB), gzip -23,451 B (-23.5 KB / -0.023 MB), br -16,702 B (-16.7 KB / -0.017 MB).

## 0.12.5 - 2026-06-24

- Added `asyncFramework({ layer, server, client })` for Hono-backed Vite
  development and client-only production asset builds without a platform target.
- Added Vite Hono and Vite JSX streaming examples, including optimizer report
  visibility for the selected `signals`, `events`, `async-signals`, and
  `stream` runtime slices.
- Re-exported the optimizer `report` from Vite-generated JSX bootstrap modules
  and marked runtime handler imports for Vite analysis so example dev servers
  stay warning-free.
- Bundle size from bundled TypeScript source: `browser.ts` raw 356,171 B (356.2 KB / 0.356 MB), gzip 66,646 B (66.6 KB / 0.067 MB), br 54,356 B (54.4 KB / 0.054 MB) -> `browser.min.js` raw 149,871 B (149.9 KB / 0.150 MB), gzip 43,590 B (43.6 KB / 0.044 MB), br 37,839 B (37.8 KB / 0.038 MB); delta raw -206,300 B (-206.3 KB / -0.206 MB), gzip -23,056 B (-23.1 KB / -0.023 MB), br -16,517 B (-16.5 KB / -0.017 MB).

## 0.12.4 - 2026-06-24

- Added `loader.swap({ type: "many", ifChanged: true })` to skip unchanged
  per-boundary replacement inside batched swaps.
- Added `loader.defineRefreshPlan(...)` and `loader.refresh(scope)` for
  declarative scope-to-boundary refresh orchestration in signal-router SPAs.
- Added `loader.swap({ type: "bind", deps: [...] })` for explicit signal-path
  refresh dependencies instead of implicit render-time collection.
- Added per-entry `{ html, strategy, attach }` objects in `type: "many"`
  updates for mixed morph/replace batches.
- Added morph `attach: "preserve"` (default) and `attach: "rebind"` options,
  plus a development warning when morph preserves an `on:attach` node but removes
  listener-bearing descendants.
- Bundle size from bundled TypeScript source: `browser.ts` raw 356,171 B (356.2 KB / 0.356 MB), gzip 66,646 B (66.6 KB / 0.067 MB), br 54,356 B (54.4 KB / 0.054 MB) -> `browser.min.js` raw 149,871 B (149.9 KB / 0.150 MB), gzip 43,590 B (43.6 KB / 0.044 MB), br 37,839 B (37.8 KB / 0.038 MB); delta raw -206,300 B (-206.3 KB / -0.206 MB), gzip -23,056 B (-23.1 KB / -0.023 MB), br -16,517 B (-16.5 KB / -0.017 MB).

## 0.12.3 - 2026-06-24

- Treat route partials that return `status: 204`, no `html` key, bare `null`,
  or bare `undefined` as no-op route HTML updates instead of clearing or
  stringifying the active boundary.
- Added config-first `loader.swap({ type })` variants for unchanged-aware,
  batched, and signal-bound boundary refreshes without expanding the loader
  method surface.
- Bundle size from bundled TypeScript source: `browser.ts` raw 348,555 B (348.6 KB / 0.349 MB), gzip 65,264 B (65.3 KB / 0.065 MB), br 53,133 B (53.1 KB / 0.053 MB) -> `browser.min.js` raw 146,383 B (146.4 KB / 0.146 MB), gzip 42,600 B (42.6 KB / 0.043 MB), br 37,056 B (37.1 KB / 0.037 MB); delta raw -202,172 B (-202.2 KB / -0.202 MB), gzip -22,664 B (-22.7 KB / -0.023 MB), br -16,077 B (-16.1 KB / -0.016 MB).

## 0.12.2 - 2026-06-24

- Added `createRouter({ mode: "signals" })` for route-only shells that update
  `router.*` state and history without rendering partials or swapping
  boundaries.
- Added `loader.swap(boundary, html, { scan })` with `auto`, `full`, and `none`
  scan modes for cheaper boundary replacement when inserted content is inert or
  manually scanned later.
- Added `loader.swap(boundary, html, { strategy: "morph" })` as an opt-in
  stable-shell update path that preserves matching nodes, avoids full subtree
  replacement, and still cleans removed or replaced scoped resources.
- Treat partial envelopes with `html: undefined` as no route replacement and
  warn instead of clearing the active route boundary; `html: ""` remains an
  explicit clear.
- Scoped lifecycle fallback hooks for components rendered through
  `this.render(...)` so `this.onMount(...)`, `this.onVisible(...)`, and
  `this.on("intersect", ...)` target the child component's rendered root
  instead of the ancestor mount root.
- Preserved direct `loader.mount(target, Component)` fallback behavior, where
  rootless and multi-root top-level components still receive the mount target.
- Updated the bundled Flow bridge to `@async/flow@0.5.0`, using async signal
  detection while preserving existing async signal metadata and refresh paths.
- Migration note: code that intentionally used nested fallback hooks to mutate
  the ancestor mount root should move that behavior to the ancestor component or
  bind a specific element with `on:attach`.
- Added `this.onAttach(fn)` as the canonical component attach lifecycle helper,
  with `this.onMount(fn)`, `this.on("mount", ...)`, and `on:mount` retained as
  compatibility aliases that warn about the rename.
- Bundle size from bundled TypeScript source: `browser.ts` raw 338,346 B (338.3 KB / 0.338 MB), gzip 63,620 B (63.6 KB / 0.064 MB), br 51,844 B (51.8 KB / 0.052 MB) -> `browser.min.js` raw 142,172 B (142.2 KB / 0.142 MB), gzip 41,549 B (41.5 KB / 0.042 MB), br 36,106 B (36.1 KB / 0.036 MB); delta raw -196,174 B (-196.2 KB / -0.196 MB), gzip -22,071 B (-22.1 KB / -0.022 MB), br -15,738 B (-15.7 KB / -0.016 MB).

## 0.12.0 - 2026-06-23

- Scoped lifecycle fallback hooks for components rendered through
  `this.render(...)` so `this.onMount(...)`, `this.onVisible(...)`, and
  `this.on("intersect", ...)` target the child component's rendered root
  instead of the ancestor mount root.
- Preserved direct `loader.mount(target, Component)` fallback behavior, where
  rootless and multi-root top-level components still receive the mount target.
- Updated the bundled Flow bridge to `@async/flow@0.5.0`, using async signal
  detection while preserving existing async signal metadata and refresh paths.
- Migration note: code that intentionally used nested fallback hooks to mutate
  the ancestor mount root should move that behavior to the ancestor component or
  bind a specific element with `on:attach`.
- Bundle size from bundled TypeScript source: `browser.ts` raw 327,212 B (327.2 KB / 0.327 MB), gzip 61,393 B (61.4 KB / 0.061 MB), br 50,139 B (50.1 KB / 0.050 MB) -> `browser.min.js` raw 138,257 B (138.3 KB / 0.138 MB), gzip 40,337 B (40.3 KB / 0.040 MB), br 35,071 B (35.1 KB / 0.035 MB); delta raw -188,955 B (-189.0 KB / -0.189 MB), gzip -21,056 B (-21.1 KB / -0.021 MB), br -15,068 B (-15.1 KB / -0.015 MB).

## 0.11.29 - 2026-06-21

- Added the Markdown-backed GitHub Pages docs app with hash routes, command
  search, grouped navigation, article content, and an on-page heading rail.
- Added `createRouter({ urlMode: "hash" })` for static-host routes such as
  `#/docs/getting-started` while preserving ordinary section anchors.
- Added publish-package `types` and `source` metadata for API indexers while
  preserving the existing export-map declarations.
- Renamed build optimizer signal source output from `derived` and `async` to
  the public-facing `computed` and `asyncSignal` intent names.
- Kept event normalization ahead of signal classification and runtime-slice
  selection in the optimizer artifact order.
- Updated optimizer artifact, runtime selection, build profile, and signal
  classification tests to prove computed and async signal reporting, ownership
  diagnostics, maybe-promise rejection, runtime slice selection, and bootstrap
  report parity.
- Bundle size from bundled TypeScript source: `browser.ts` raw 274,307 B (274.3 KB / 0.274 MB), gzip 52,238 B (52.2 KB / 0.052 MB), br 42,841 B (42.8 KB / 0.043 MB) -> `browser.min.js` raw 116,507 B (116.5 KB / 0.117 MB), gzip 34,553 B (34.6 KB / 0.035 MB), br 30,179 B (30.2 KB / 0.030 MB); delta raw -157,800 B (-157.8 KB / -0.158 MB), gzip -17,685 B (-17.7 KB / -0.018 MB), br -12,662 B (-12.7 KB / -0.013 MB).

## 0.11.28 - 2026-06-21

- Added a profile-aware event normalization artifact before signal
  classification so JSX-native event props and protocol event props lower to
  canonical `on:` event records.
- Preserved source event prop spelling in optimizer diagnostics while accepting
  protocol event props only for runtime or compatibility profiles.
- Added duplicate canonical event diagnostics so mixed `onClick` and `on:click`
  declarations cannot silently overwrite each other.
- Kept handler emission independent from source prop spelling by feeding
  canonical protocol records into the handler planning pass.
- Bundle size from bundled TypeScript source: `browser.ts` raw 231,217 B (231.2 KB / 0.231 MB), gzip 44,078 B (44.1 KB / 0.044 MB), br 36,392 B (36.4 KB / 0.036 MB) -> `browser.min.js` raw 98,972 B (99.0 KB / 0.099 MB), gzip 29,418 B (29.4 KB / 0.029 MB), br 25,930 B (25.9 KB / 0.026 MB); delta raw -132,245 B (-132.2 KB / -0.132 MB), gzip -14,660 B (-14.7 KB / -0.015 MB), br -10,462 B (-10.5 KB / -0.010 MB).

## 0.11.27 - 2026-06-21

- Added the composition pattern catalog covering default children, named
  regions, scoped content templates, presenter component props, dynamic outlets,
  boundaries, and anti-patterns.
- Separated L1 and L2 examples for each composition pattern and marked planned
  source forms so released behavior is distinct from future build-required
  syntax.
- Added out-of-order streaming guidance for every composition pattern,
  including boundary placement, independent commits, same-boundary sequencing,
  and rescanning inserted streamed HTML.
- Bundle size from bundled TypeScript source: `browser.ts` raw 231,217 B (231.2 KB / 0.231 MB), gzip 44,078 B (44.1 KB / 0.044 MB), br 36,392 B (36.4 KB / 0.036 MB) -> `browser.min.js` raw 98,972 B (99.0 KB / 0.099 MB), gzip 29,418 B (29.4 KB / 0.029 MB), br 25,930 B (25.9 KB / 0.026 MB); delta raw -132,245 B (-132.2 KB / -0.132 MB), gzip -14,660 B (-14.7 KB / -0.015 MB), br -10,462 B (-10.5 KB / -0.010 MB).

## 0.11.26 - 2026-06-21

- Added a build-optimizer children-fragment lowering artifact for JSX nested
  children, recording empty, static, and lazy fragment output without retaining
  production JSX node arrays.
- Added diagnostics for authored `children` props, mixed explicit and nested
  children sources, runtime JSX children arrays, and unknown child-fragment
  resourcefulness before optimizer output is trusted.
- Added optimizer fixtures and report counts covering static children,
  component/signal/event-bearing lazy children, and invalid children sources.
- Bundle size from bundled TypeScript source: `browser.ts` raw 231,217 B (231.2 KB / 0.231 MB), gzip 44,078 B (44.1 KB / 0.044 MB), br 36,392 B (36.4 KB / 0.036 MB) -> `browser.min.js` raw 98,972 B (99.0 KB / 0.099 MB), gzip 29,418 B (29.4 KB / 0.029 MB), br 25,930 B (25.9 KB / 0.026 MB); delta raw -132,245 B (-132.2 KB / -0.132 MB), gzip -14,660 B (-14.7 KB / -0.015 MB), br -10,462 B (-10.5 KB / -0.010 MB).

## 0.11.25 - 2026-06-21

- Added explicit `<template async:children>` capture for registered
  `async:component` hosts, passing captured content through the same scoped
  default-children fragment contract as `this.render(...)`.
- Added loader coverage proving explicit template children render only when
  consumed, ordinary host content is not implicitly captured, inserted protocol
  attributes are rescanned, and invalid or duplicate children templates fail.
- Documented the no-build template children contract in the README, DOM
  protocol spec, and component-system spec.
- Bundle size from bundled TypeScript source: `browser.ts` raw 231,217 B (231.2 KB / 0.231 MB), gzip 44,078 B (44.1 KB / 0.044 MB), br 36,392 B (36.4 KB / 0.036 MB) -> `browser.min.js` raw 98,972 B (99.0 KB / 0.099 MB), gzip 29,418 B (29.4 KB / 0.029 MB), br 25,930 B (25.9 KB / 0.026 MB); delta raw -132,245 B (-132.2 KB / -0.132 MB), gzip -14,660 B (-14.7 KB / -0.015 MB), br -10,462 B (-10.5 KB / -0.010 MB).

## 0.11.24 - 2026-06-21

- Added scoped default children fragments for `this.render(Component, props,
  children)`, including lazy children factories, single-consumption checks, and
  duplicate source validation.
- Added component tests proving static children, lazy nested component children,
  escaped string children, duplicate children errors, and cleanup for handlers
  and signals created while rendering children.
- Updated framework declarations and type fixtures so components can type
  optional `Children` props while callers use the third render argument instead
  of authoring `props.children`.
- Documented the released default-children contract in the component README and
  component-system spec while keeping slots as the post-mount replacement
  primitive.
- Bundle size from bundled TypeScript source: `browser.ts` raw 230,250 B (230.3 KB / 0.230 MB), gzip 43,813 B (43.8 KB / 0.044 MB), br 36,215 B (36.2 KB / 0.036 MB) -> `browser.min.js` raw 98,493 B (98.5 KB / 0.098 MB), gzip 29,286 B (29.3 KB / 0.029 MB), br 25,793 B (25.8 KB / 0.026 MB); delta raw -131,757 B (-131.8 KB / -0.132 MB), gzip -14,527 B (-14.5 KB / -0.015 MB), br -10,422 B (-10.4 KB / -0.010 MB).

## 0.11.23 - 2026-06-21

- Added first-class JSX type profiles for runtime/no-build and
  buildtime/build-required authoring, including profile-local automatic
  `jsx-runtime` and `jsx-dev-runtime` package subpaths.
- Added TypeScript fixtures proving runtime JSX accepts protocol attributes,
  strict buildtime JSX rejects protocol props, and both profiles avoid global
  ambient JSX pollution.
- Added component registry mounting through `async:component` plus
  `this.slot(...)` outlets for child component replacement from signal-derived
  props.
- Added example README coverage and clarified benchmark smoke checks without
  publishing an incomplete Vite optimizer setup as a public example.
- Bundle size from bundled TypeScript source: `browser.ts` raw 228,180 B (228.2 KB / 0.228 MB), gzip 43,390 B (43.4 KB / 0.043 MB), br 35,878 B (35.9 KB / 0.036 MB) -> `browser.min.js` raw 97,570 B (97.6 KB / 0.098 MB), gzip 29,015 B (29.0 KB / 0.029 MB), br 25,549 B (25.5 KB / 0.026 MB); delta raw -130,610 B (-130.6 KB / -0.131 MB), gzip -14,375 B (-14.4 KB / -0.014 MB), br -10,329 B (-10.3 KB / -0.010 MB).

## 0.11.22 - 2026-06-19

- Updated framework release automation to consume `@async/pipeline@0.9.25`,
  whose generated release workflow runs package-owned release evidence before
  release plan/inspect/changelog/notes steps so `dist/` exists before package
  inspection.
- Kept release-description sync checks on the released pipeline path after the
  existing `v0.11.20` and `v0.11.21` GitHub Release description repairs.
- Bundle size from bundled TypeScript source: `browser.ts` raw 221,403 B (221.4 KB / 0.221 MB), gzip 42,093 B (42.1 KB / 0.042 MB), br 34,797 B (34.8 KB / 0.035 MB) -> `browser.min.js` raw 95,027 B (95.0 KB / 0.095 MB), gzip 28,145 B (28.1 KB / 0.028 MB), br 24,793 B (24.8 KB / 0.025 MB); delta raw -126,376 B (-126.4 KB / -0.126 MB), gzip -13,948 B (-13.9 KB / -0.014 MB), br -10,004 B (-10.0 KB / -0.010 MB).

## 0.11.21 - 2026-06-19

- Updated framework release automation to consume `@async/pipeline@0.9.24`,
  whose generated release helper steps use `pnpm dlx` for the pinned
  `@async/release` package on Node 24/npm 11 runners.
- Kept release-description sync scripts and generated workflow entries on the
  released pipeline path.
- Bundle size from bundled TypeScript source: `browser.ts` raw 221,403 B (221.4 KB / 0.221 MB), gzip 42,093 B (42.1 KB / 0.042 MB), br 34,797 B (34.8 KB / 0.035 MB) -> `browser.min.js` raw 95,027 B (95.0 KB / 0.095 MB), gzip 28,145 B (28.1 KB / 0.028 MB), br 24,793 B (24.8 KB / 0.025 MB); delta raw -126,376 B (-126.4 KB / -0.126 MB), gzip -13,948 B (-13.9 KB / -0.014 MB), br -10,004 B (-10.0 KB / -0.010 MB).

## 0.11.20 - 2026-06-19

- Updated framework release automation to consume `@async/pipeline@0.9.22`
  with the released `release sync-descriptions` command.
- Added framework package scripts for release-description sync checks and
  generated matching `pipeline:release:sync-descriptions` entries.
- Synced existing semver GitHub Release descriptions from `CHANGELOG.md` so the
  changelog remains the source of truth.
- Bundle size from bundled TypeScript source: `browser.ts` raw 221,403 B (221.4 KB / 0.221 MB), gzip 42,093 B (42.1 KB / 0.042 MB), br 34,797 B (34.8 KB / 0.035 MB) -> `browser.min.js` raw 95,027 B (95.0 KB / 0.095 MB), gzip 28,145 B (28.1 KB / 0.028 MB), br 24,793 B (24.8 KB / 0.025 MB); delta raw -126,376 B (-126.4 KB / -0.126 MB), gzip -13,948 B (-13.9 KB / -0.014 MB), br -10,004 B (-10.0 KB / -0.010 MB).

## 0.11.19 - 2026-06-19

- Added the first build-required profile subpaths,
  `@async/framework/jsx` and `@async/framework/vite`, with package export,
  declaration, pack, and installed-package coverage.
- Added JSX authoring markers for `signal`, `component`, `Suspense`, and
  `Reveal` that stay inert for compiler analysis instead of executing app code.
- Added a Vite 8+ Rolldown plugin spike that emits a deterministic virtual
  runtime plan/report from fixture metadata and rejects unsupported hosts before
  transform output is trusted.
- Added the build-profile report fixture proving selected runtime slices,
  omitted no-build systems, visible fallbacks, signal/event/stream counts, and
  generated locator counts without importing the root `Async` app hub.
- Bundle size from bundled TypeScript source: `browser.ts` raw 221,403 B (221.4 KB / 0.221 MB), gzip 42,093 B (42.1 KB / 0.042 MB), br 34,797 B (34.8 KB / 0.035 MB) -> `browser.min.js` raw 95,027 B (95.0 KB / 0.095 MB), gzip 28,145 B (28.1 KB / 0.028 MB), br 24,793 B (24.8 KB / 0.025 MB); delta raw -126,376 B (-126.4 KB / -0.126 MB), gzip -13,948 B (-13.9 KB / -0.014 MB), br -10,004 B (-10.0 KB / -0.010 MB).

## 0.11.18 - 2026-06-19

- Added inert build optimizer artifact helpers for ADR 26 pass records,
  diagnostics, runtime slice selection, handler emission, and development
  report generation.
- Added optimizer fixtures for signal source classification, signal ownership,
  JSX event symbol extraction, Suspense/Reveal lowering, runtime selection, and
  server-only browser import diagnostics.
- Added build optimizer tests proving maybe-promise signals fail explicitly,
  event handlers are not forced through dynamic imports, Reveal ordering is
  deterministic, omitted runtime systems are visible, and helpers do not execute
  app modules or import no-build runtime systems.
- Bundle size from bundled TypeScript source: `browser.ts` raw 221,403 B (221.4 KB / 0.221 MB), gzip 42,093 B (42.1 KB / 0.042 MB), br 34,797 B (34.8 KB / 0.035 MB) -> `browser.min.js` raw 95,027 B (95.0 KB / 0.095 MB), gzip 28,145 B (28.1 KB / 0.028 MB), br 24,793 B (24.8 KB / 0.025 MB); delta raw -126,376 B (-126.4 KB / -0.126 MB), gzip -13,948 B (-13.9 KB / -0.014 MB), br -10,004 B (-10.0 KB / -0.010 MB).

## 0.11.17 - 2026-06-19

- Added the stream backpatch protocol to `createBoundaryReceiver(...)` with
  strict `attrs` validation for built numeric triples and no-build named
  tuples.
- Added pending-slot replacement and reveal coordination for `as-ready`,
  `forwards`, `backwards`, and `together` stream groups, including collapsed
  and hidden tail visibility handling.
- Added the `AsyncStream` browser helper for no-build JSON stream patches,
  template replacement, configured `data-async-*` attributes, and direct-child
  reveal metadata synthesis.
- Added stream backpatch scenario-size coverage and updated browser scenario
  budgets for the expanded public stream surface.
- Bundle size from bundled TypeScript source: `browser.ts` raw 221,403 B (221.4 KB / 0.221 MB), gzip 42,093 B (42.1 KB / 0.042 MB), br 34,797 B (34.8 KB / 0.035 MB) -> `browser.min.js` raw 95,027 B (95.0 KB / 0.095 MB), gzip 28,145 B (28.1 KB / 0.028 MB), br 24,793 B (24.8 KB / 0.025 MB); delta raw -126,376 B (-126.4 KB / -0.126 MB), gzip -13,948 B (-13.9 KB / -0.014 MB), br -10,004 B (-10.0 KB / -0.010 MB).

## 0.11.16 - 2026-06-19

- Added runtime slice entrypoints for `@async/framework/runtime`,
  `@async/framework/runtime/signals`, and `@async/framework/runtime/events`.
- Added generated package artifacts and installed-package coverage for runtime
  slice subpaths.
- Added deterministic scenario-size fixtures and checks for runtime, router,
  server-call, and boundary receiver examples.
- Added package-owned release evidence checks before release ensure so generated
  release workflows verify bundle and scenario evidence before publishing.
- Bundle size from bundled TypeScript source: `browser.ts` raw 197,173 B (197.2 KB / 0.197 MB), gzip 37,198 B (37.2 KB / 0.037 MB), br 30,914 B (30.9 KB / 0.031 MB) -> `browser.min.js` raw 84,013 B (84.0 KB / 0.084 MB), gzip 24,894 B (24.9 KB / 0.025 MB), br 22,079 B (22.1 KB / 0.022 MB); delta raw -113,160 B (-113.2 KB / -0.113 MB), gzip -12,304 B (-12.3 KB / -0.012 MB), br -8,835 B (-8.8 KB / -0.009 MB).

## 0.11.15 - 2026-06-19

- Made the source package private and kept its public surface to the minimal
  export spec for root, `/browser`, `/server`, and `/package.json` only.
- Moved publish staging to generated `dist/package.json` so npm and release
  automation publish from `dist/` while package consumers still receive
  root-level artifacts without `dist/` paths.
- Removed legacy direct artifact subpath exports plus top-level
  `main`/`module`/`browser`/`types` and generated file lists from the source
  manifest.
- Updated pack, size, pipeline, and installed-package coverage to verify the
  browser and server entrypoints remain split after packing.
- Bundle size from bundled TypeScript source: `browser.ts` 197,173 B raw /
  37,198 B gzip -> `browser.min.js` 84,013 B raw / 24,894 B gzip
  (-113,160 B raw, -12,304 B gzip).

## 0.11.14 - 2026-06-18

- Added condition-specific root declaration targets so browser-conditioned root
  imports resolve to browser declarations while Node/default root imports keep
  server-capable declarations.
- Preserved the root browser runtime condition and documented that server-only
  APIs remain on the Node/server entrypoints.
- Added packed-artifact export-map, declaration/runtime parity, and static
  import checks for root browser, root Node, explicit `/browser`, and explicit
  `/server` entrypoints.
- Added component-scoped continuous intersection helpers with
  `this.intersect(...)` and `this.on("intersect", options?, fn)`, preserving
  `on:visible` as a one-shot visibility lifecycle hook.
- Added declarative `on:intersect` with `intersect:threshold`,
  `intersect:root-margin`, and `intersect:once` pseudo-event options, including
  custom `intersect` attribute prefix support.
- Added observer cleanup coverage for component teardown, boundary swaps,
  fallback scheduling, repeated entries, and existing visible compatibility.
- Moved root release artifacts to an ignored generated-output workflow:
  tests, bundle checks, pack checks, and generated CI tasks materialize the
  current package surface before verification or publish.
- Bundle size from bundled TypeScript source: `browser.ts` 197,173 B raw /
  37,198 B gzip -> `browser.min.js` 84,013 B raw / 24,894 B gzip
  (-113,160 B raw, -12,304 B gzip).

## 0.11.13 - 2026-06-18

- Validated server proxy arguments, default input payloads, and selected signal
  values against an explicit JSON transport model before requests leave the
  caller.
- Rejected values that `JSON.stringify` would silently corrupt, including
  `undefined`, non-finite numbers, functions, symbols, sparse arrays, circular
  structures, class instances, dates, maps, sets, buffers, streams, and web
  platform request/body objects.
- Added path-aware regression coverage for invalid transport values and
  documented the supported server-call JSON model.
- Bundle size from bundled TypeScript source: `browser.ts` 187,564 B raw /
  35,332 B gzip -> `browser.min.js` 80,009 B raw / 23,677 B gzip
  (-107,555 B raw, -11,655 B gzip).

## 0.11.12 - 2026-06-18

- Deferred boundary receiver sequence commits until patch effects complete so
  failed DOM swaps, scheduler flushes, redirects, or missing capabilities no
  longer make the same streamed sequence stale.
- Serialized same-boundary patch application to keep concurrent patches from
  committing out of order while preserving stale rejection after successful
  commits.
- Added regression coverage for retryable DOM, scheduler, redirect, and
  capability failures plus idempotent partial-effect replay.
- Bundle size from bundled TypeScript source: `browser.ts` 186,064 B raw /
  35,039 B gzip -> `browser.min.js` 79,042 B raw / 23,445 B gzip
  (-107,022 B raw, -11,594 B gzip).

## 0.11.11 - 2026-06-18

- Serialized rejected async-signal snapshot errors to stable `name`, `message`,
  and `code` records so JSON SSR snapshots preserve documented
  `$error.message` bindings during browser activation.
- Normalized non-Error rejections into readable error records while omitting
  arbitrary error object properties from snapshots by default.
- Added regression coverage for JSON snapshot round-trips, error code
  preservation, non-Error rejection normalization, and SSR activation bindings.
- Bundle size from bundled TypeScript source: `browser.ts` 185,440 B raw /
  34,884 B gzip -> `browser.min.js` 78,754 B raw / 23,362 B gzip
  (-106,686 B raw, -11,522 B gzip).

## 0.11.10 - 2026-06-18

- Routed automatic microtask scheduler flush failures through an explicit error
  channel so failed jobs no longer surface as unhandled promise rejections.
- Reported automatic flush failures to configured `onError` handlers or
  `globalThis.reportError`, with scheduler metadata for phase, scope, and key,
  while preserving manual `scheduler.flush()` rejection behavior.
- Added regression coverage for automatic `onError` reporting, `reportError`
  delivery without unhandled rejections, and manual flush rejection metadata.
- Bundle size from bundled TypeScript source: `browser.ts` 184,238 B raw /
  34,642 B gzip -> `browser.min.js` 78,267 B raw / 23,232 B gzip
  (-105,971 B raw, -11,410 B gzip).

## 0.11.9 - 2026-06-18

- Normalized scheduler batch thenables with `Promise.resolve(value)` before
  attaching cleanup, so PromiseLike values that implement `.then()` without
  `.finally()` are accepted.
- Preserved batch-depth restoration, post-batch flushing, and manual rejection
  propagation for fulfilled, rejected, and native Promise batch work.
- Added scheduler regression coverage for thenables without `.finally()`,
  rejected thenable batches, and Promise rejection propagation.
- Bundle size from bundled TypeScript source: `browser.ts` 183,444 B raw /
  34,419 B gzip -> `browser.min.js` 77,949 B raw / 23,138 B gzip
  (-105,495 B raw, -11,281 B gzip).

## 0.11.8 - 2026-06-18

- Scoped server-result application tracking to each framework invocation so the
  same envelope object can apply effects again for separate calls without
  double-applying inside one nested server call chain.
- Stopped mutating caller-owned server-result objects to record application
  state, including extensible, sealed, frozen, redirect, and error envelopes.
- Added regression coverage for repeated shared-envelope invocations,
  frozen/sealed envelopes, original server errors, repeatable redirects, and
  unchanged result-object own keys.
- Bundle size from bundled TypeScript source: `browser.ts` 183,427 B raw /
  34,417 B gzip -> `browser.min.js` 77,932 B raw / 23,134 B gzip
  (-105,495 B raw, -11,283 B gzip).

## 0.11.7 - 2026-06-18

- Introduced an explicit `__async_server_result__: 1` marker for framework
  server-result envelopes so ordinary domain objects with fields such as
  `value`, `signals`, `cache`, `html`, `boundary`, `redirect`, or `error`
  remain application values.
- Centralized server-result effect application and unwrapping across local
  registry, remote proxy, and handler command paths so `.run(...)` and
  namespaced calls return equivalent values without double-applying effects.
- Kept cache-only and other effect-only server envelopes representable through
  the explicit marker and updated server-call, router, partial, and SSR
  examples to use the protocol.
- Bundle size from bundled TypeScript source: `browser.ts` 183,176 B raw /
  34,360 B gzip -> `browser.min.js` 77,854 B raw / 23,100 B gzip
  (-105,322 B raw, -11,260 B gzip).

## 0.11.6 - 2026-06-18

- Owned async-signal runs with private execution tokens so canceled, restored,
  disposed, unregistered, or superseded work cannot commit late values, errors,
  or subscriber notifications.
- Captured per-run `this.abort` and `this.server` context so older async work
  cannot observe or cancel a newer run's abort signal after an `await`.
- Settled cancellation state immediately for non-cooperative loaders and
  canceled queued initial async scheduler work during disposal.
- Bundle size from bundled TypeScript source: `browser.ts` 183,459 B raw /
  34,391 B gzip -> `browser.min.js` 77,987 B raw / 23,148 B gzip
  (-105,472 B raw, -11,243 B gzip).

## 0.11.5 - 2026-06-18

- Treated materialized signals and lazy async-signal descriptors as one
  logical namespace so duplicate IDs are rejected consistently.
- Fixed lazy async-signal `unregister(...)` before and after materialization so
  removed descriptors cannot rematerialize.
- Preserved reusable app async-signal declarations when materialized runtime
  async state is destroyed.
- Bundle size from bundled TypeScript source: `browser.ts` 181,266 B raw /
  33,853 B gzip -> `browser.min.js` 77,285 B raw / 22,868 B gzip
  (-103,981 B raw, -10,985 B gzip).

## 0.11.4 - 2026-06-18

- Restored snapshot signal keys as exact IDs so dotted plain, async, and
  component-scoped signal IDs such as `product.load` survive SSR activation
  without becoming nested properties under their first segment.
- Adopted async-signal descriptors before restoring matching snapshot state so
  dotted async signals preserve `$value`, `$status`, and `$version` without an
  immediate client refresh.
- Kept server-result signal patches on nested first-segment path semantics for
  updates such as `product.title`.
- Bundle size from bundled TypeScript source: `browser.ts` 180,585 B raw /
  33,742 B gzip -> `browser.min.js` 76,946 B raw / 22,793 B gzip
  (-103,639 B raw, -10,949 B gzip).

## 0.11.3 - 2026-06-18

- Isolated runtime-owned signal, async-signal, scheduler, request, and cache
  state so each `createApp(...)` call materializes fresh mutable state from
  reusable app declarations.
- Preserved reusable app declarations across runtime destroy/recreate cycles,
  late `app.use(...)` adoption, server render repetition, and peer async-signal
  subscribers.
- Added direct runtime-isolation regression coverage and regenerated the
  published browser/server artifacts.
- Bundle size from bundled TypeScript source: `browser.ts` 179,469 B raw /
  33,612 B gzip -> `browser.min.js` 76,458 B raw / 22,690 B gzip
  (-103,011 B raw, -10,922 B gzip).

## 0.11.2 - 2026-06-18

- Published the post-`0.11.1` feedback-regression hardening now on `main`,
  including scheduler scope revival, server error envelopes, async-signal SSR
  snapshot restore, lazy component error handling, router prefetch context,
  server proxy transport validation, and package export smoke coverage.
- Refreshed the generated Async Pipeline workflow and lock metadata to
  `@async/pipeline` `0.9.1`.
- Ignored local `docs/goals/` GoalBuddy planning bundles.

## 0.11.1 - 2026-06-17

- Removed the literal old global fetch identifier from published release notes
  so package-wide text scans stay focused on runtime artifacts.
- Hardened scheduler scope revival, server error envelopes, async-signal SSR
  snapshot restore, lazy component sync-rendering errors, router prefetch
  context, server proxy transport validation, and package export smoke tests.
- Bundle size from bundled TypeScript source: `browser.ts` 177,243 B raw /
  33,354 B gzip -> `browser.min.js` 75,517 B raw / 22,516 B gzip
  (-101,726 B raw, -10,838 B gzip).

## 0.11.0 - 2026-06-17

- Removed the networked `ssr-spa` router mode and route-fragment fetching so
  `ssr` activates server-rendered HTML and snapshots without client route
  fetches.
- Changed browser navigation to render registered SPA partials locally in
  `spa` and `csr` modes while leaving same-origin document navigation alone in
  `ssr` and `mpa` modes.
- Replaced the server proxy's implicit global fetch default with an
  explicit `transport` callback supplied by application code.
- Published only generated runtime artifacts and declarations:
  `browser.*`, `server.js`, `framework.ts`, and `framework.d.ts`; source,
  tests, and examples are no longer included in the package tarball.
- Added regression coverage for SSR snapshot activation without fetch, SPA
  stale/error navigation behavior, explicit server proxy transports, and static
  generated-bundle scans for implicit global fetch access.
- Bundle size from bundled TypeScript source: `browser.ts` 171,908 B raw /
  32,421 B gzip -> `browser.min.js` 72,827 B raw / 21,845 B gzip
  (-99,081 B raw, -10,576 B gzip).

## 0.10.2 - 2026-06-17

- Fixed intercepted router link, form, and popstate navigation failures so they
  update router error state and do not create unhandled promise rejections.
- Preserved native same-document hash link behavior and made malformed encoded
  dynamic route params fall back to the raw segment instead of throwing.
- Hardened rootless detach cleanup, lazy descriptor import retry, server JSON
  transport validation, and `cache.getOrSet(...)` handling for cached
  `undefined` values.
- Expanded regression coverage for scheduler reentrancy, boundary receiver
  patch shapes, root lifecycle, lazy descriptors, server transport edge cases,
  component lifecycle ordering, and installed package export-map shape.
- Bundle size from bundled TypeScript source: `browser.ts` 173,774 B raw /
  32,727 B gzip -> `browser.min.js` 73,680 B raw / 22,047 B gzip
  (-100,094 B raw, -10,680 B gzip).

## 0.10.1 - 2026-06-17

- Added Terser-powered browser bundle minification and pointed legacy
  `module`/`browser` analyzer fields plus the root `exports.browser` condition
  at `browser.min.js`.
- Bundle size from bundled TypeScript source: `browser.ts` 171,471 B raw /
  32,301 B gzip -> `browser.min.js` 72,753 B raw / 21,763 B gzip
  (-98,718 B raw, -10,538 B gzip).

## 0.10.0 - 2026-06-17

- Added rootless browser startup plus `attachRoot`, `detachRoot`,
  `inspectRoots`, and streamed `applySnapshot(...)` support for advanced
  build-step bootstrapping.
- Added compact lazy registry descriptors with `_async` asset resolution,
  inferred exports, and lazy handler, partial, component, and async-signal
  materialization.
- Added optional `async-container` and `async-suspense` custom elements while
  preserving the existing `async:container`, `async:boundary`, and
  `this.suspense(...)` Layer 1 APIs.

## 0.9.0 - 2026-06-17

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
