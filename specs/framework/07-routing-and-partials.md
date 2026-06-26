# Routing And Partials

Reference file for [Async Framework](../framework.md). This file owns route
matching, partial rendering, navigation modes, router state, prefetch, and
boundary ownership.

## Purpose

Async routing should be protocol-aligned rather than transport-first. Routes map
URLs to partial IDs. Partials render fragments that can be swapped into
boundaries locally or served by the server, depending on the selected mode.

## Responsibilities

- Register route patterns and partial definitions.
- Match static, dynamic, and wildcard routes deterministically.
- Render partials with route params and runtime context.
- Maintain router state signals.
- Intercept or preserve navigation based on mode.
- Swap route boundaries in CSR and SPA modes.
- Leave SSR and MPA navigation to native document behavior.

## Public Contract

Routing primitives are layered from app authoring down to custom runtime
integration:

- Browser routing apps import from `@async/framework/router`; the default
  browser entrypoint records route declarations but does not carry router
  startup code.
- App registration layer: `Async.use({ route, partial })` with
  `defineRoute(partial, options?)`, `defineRoute({ render: "none", meta })`,
  and `route(...)` compatibility alias.
- App start layer: `Async.start({ mode, urlMode, root, boundary })` to materialize runtime
  route and partial registries from app declarations and start the router.
- App router facade layer: `Async.router.navigate(...)`,
  `Async.router.prefetch(...)`, and
  `Async.router.ready()` for app-level router access that queues until the
  runtime router exists.
- `Async.router.loader.*` for queued access to the active router loader's swap,
  refresh, scan, and mount APIs.
- Runtime integration layer: `createRouter({ mode, urlMode, root, boundary,
  loader })` for custom runtime wiring that already owns materialized runtime
  registries.

`createRouter(...)` does not accept a separate `signals` option. App-managed
routers publish `router.*` state through the runtime loader's signal registry;
standalone routers create one internal signal registry for their owned loader.
As a `create*` API, `createRouter(...)` creates and starts the router
immediately. `start()` is idempotent compatibility, not the documented app
authoring path. App code should register route and partial declarations through
`Async.use(...)`; direct route and partial registry construction is internal
runtime wiring, not a public app registration model.

Route records may include:

- `partial`: partial ID for route boundary rendering.
- `render`: `"auto"`, `"partial"`, `"signals"`, or `"none"`.
- `viewKey`: stable mounted view identity for same-view signal navigation.
- `boundary`: route-specific boundary override.
- `dataKey`: reserved route data identity.
- `meta`: user metadata that does not control router behavior.

Router modes:

- `csr`: initial route renders locally into an empty route boundary and later
  navigation uses the transition planner.
- `spa`: existing HTML may contain route content and later navigation uses the
  transition planner.
- `signals`: existing HTML stays mounted while navigation updates router
  signals and browser history only.
- `ssr`: the document is server-rendered and browser navigation stays native.
- `mpa`: any document source and browser navigation stays native.

Router URL modes:

- `path`: default. Route matching uses the browser path and query string.
- `hash`: route matching uses `#/path?query` while preserving ordinary section
  anchors such as `#quickstart` as native page jumps.

## Subsystem Boundaries

- Routes match URLs and point to partial IDs or metadata-only route records.
- Partials render fragment content and may call server functions.
- The loader owns boundary swaps and rescans.
- The runtime or loader signal registry owns `router.*` state.
- Server rendering may use the same route and partial registries to produce
  initial HTML.

## Protocol Contract

Routing protocol includes:

- Route patterns as stable strings.
- Partial IDs as registry references.
- Route boundary ID, usually `route`, with optional route-level override.
- Router URL mode, either `path` or `hash`.
- Router signals: `router.url`, `router.path`, `router.params`,
  `router.query`, `router.route`, `router.pending`, and `router.error`.
- Partial results that may include HTML and server-result-like side effects.
- Transition plans that classify navigation as `noop`, `signals`, `partial`,
  or native document navigation.

CSR and SPA modes consume local partial output when the transition planner
chooses a partial render. A same-view transition with a matching `viewKey` and
boundary updates router state and browser history without rendering a partial.
Signals mode updates router state without rendering partials or swapping
boundaries. SSR and MPA modes preserve native document navigation and must not
perform hidden route-fragment fetches.

## Resume Contract

Routing resume behavior:

- SSR activation starts from existing HTML and snapshots.
- SSR mode does not intercept same-origin link clicks for local partial fetches.
- SPA mode may use existing route HTML as the initial state, then own later
  local navigation.
- Route boundary swaps must rescan inserted protocol attributes.
- Route-only navigation must preserve mounted DOM and update router state
  without requiring noop partials.
- Route-only shells may bind view boundaries to `router.*` signal reads so
  same-tick route state changes coalesce into one unchanged-aware refresh.
- Same-view navigation must require explicit signal-safe metadata, such as a
  matching `viewKey`, `render: "signals"`, or `render: "none"`.
- Stale navigation results must not overwrite newer router state or DOM.

## Invariants

- Route matching ranks specific routes ahead of wildcard fallbacks.
- Hash URL mode matches `#/path?query` as `/path?query`.
- Hash URL mode preserves plain section anchors as native jumps without
  mutating router state.
- Malformed encoded params are handled without crashing the router.
- Prefetch does not mutate router state, history, or DOM.
- Same-URL navigation skips route state writes, partial rendering, boundary
  swaps, and duplicate history writes.
- `force: true` refreshes a stable view through the partial path in CSR and SPA
  modes.
- Navigation errors update route error state without corrupting the active
  boundary.
- Route partial envelopes with `status: 204`, no `html` key, `html: undefined`,
  or bare `null`/`undefined` results must not replace route HTML.
- Removed or unsupported modes are rejected explicitly.

## Failure Modes

- Duplicate route patterns fail during registration.
- Missing partials fail during render with useful errors.
- Navigation failures are caught and routed to `router.error`.
- Stale partial fulfillment or rejection is ignored after newer navigation.
- Destroyed routers abort active navigation.

## Acceptance Criteria

- CSR startup renders the current route partial into an empty route boundary.
- Hash URL mode supports static-host URLs such as `#/docs/getting-started`.
- Signals mode updates router path, params, query, route, pending, and error
  state without invoking partial rendering.
- SPA navigation swaps a route boundary and rescans inserted handlers.
- Wildcard fallback routes handle unmatched paths.
- SSR and MPA modes do not intercept link clicks.
- Prefetch returns rendered partial content or errors without DOM mutation.

## Open Or Deferred Decisions

- Data preloading and route resource protocols.
- Scroll/focus restoration ownership.
- Nested route boundary conventions.
- Public route transition hooks beyond current signals and errors.
