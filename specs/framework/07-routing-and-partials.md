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
- `server`: `true` marks a server route partial. Client navigation fetches the
  target URL with `Accept: application/x-async-partial` plus an
  `x-async-boundary` request header naming the boundary the transition plan
  wants filled, and applies the returned wire server envelope through the same
  navigation pipeline as local partial output. HTTP redirects followed by the
  fetch update router state, the route snapshot, and browser history to the
  final URL. The fetch comes from the document view or an explicit
  `createRouter({ fetch })` override, never ambient `globalThis.fetch`.
- `render`: `"auto"`, `"partial"`, `"signals"`, `"none"`, or `"document"`.
  `"document"` forces native document navigation for matched routes such as
  downloads or raw endpoints.
- `viewKey`: stable mounted view identity for same-view signal navigation. May
  be a string or a function of the route match; function results compare as
  strings.
- `subBoundary`: nested boundary for same-view master-detail navigation. When
  navigation stays on the same computed `viewKey`, a route with `subBoundary`
  renders or fetches into that nested boundary instead of going state-only;
  view identity comparisons stay on the route-level boundary.
- `boundary`: route-specific boundary override.
- `dataKey`: reserved route data identity.
- `meta`: user metadata that does not control router behavior.

Router fallback:

- `fallback: "error"` (default): unmatched navigation records `router.error`.
- `fallback: "document"`: unmatched navigation in client modes performs native
  document navigation, enabling incremental adoption over server-rendered
  apps. Assigning the current browser URL is refused to prevent reload loops.
  Server-partial responses that are not wire envelopes, or that fail, also
  fall back to document navigation in this mode.

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

- Route patterns as stable strings. Dynamic `:param` segments match one path
  segment; a terminal `*name` splat segment captures the remaining segments as
  one param, decoded per segment. Splat routes rank above `*` wildcard routes
  and below single-segment params.
- Partial IDs as registry references.
- Route boundary ID, usually `route`, with optional route-level override and
  an optional nested `subBoundary` for same-view master-detail swaps.
- Router URL mode, either `path` or `hash`.
- Router signals: `router.url`, `router.path`, `router.params`,
  `router.query`, `router.route`, `router.pending`, and `router.error`.
- Partial results that may include HTML and server-result-like side effects.
  A string `title` in a partial result updates `document.title`.
- Server route partial requests negotiated with
  `Accept: application/x-async-partial` and the `x-async-boundary` request
  header; responses are wire server envelopes. Server runtimes build the
  envelope `html` with `render(url, { document: false })`, which skips the
  boundary section and snapshot script because the swap target is an
  already-activated document.
- Transition plans that classify navigation as `noop`, `signals`, `partial`,
  or native document navigation.

CSR and SPA modes consume local partial output when the transition planner
chooses a partial render, or fetched server envelopes for `server: true`
routes. A same-view transition with a matching `viewKey` and boundary updates
router state and browser history without rendering a partial unless the route
declares a `subBoundary`, in which case the nested boundary re-renders.
Signals mode updates router state without rendering partials or swapping
boundaries. SSR and MPA modes preserve native document navigation and must not
perform hidden route-fragment fetches. Server route-fragment fetches happen
only for routes explicitly marked `server: true` in client navigation modes.
Client navigations that swapped content scroll to the top or to the URL hash
target unless the router is created with `scroll: false`.

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
- Server route partial navigation that followed an HTTP redirect must describe
  the final URL in router state, the route snapshot, and browser history.
- Unmatched navigation with `fallback: "document"` must not assign the current
  browser URL.
- Stale navigation results must not overwrite newer router state or DOM.

## Invariants

- Route matching ranks specific routes ahead of wildcard fallbacks.
- Hash URL mode matches `#/path?query` as `/path?query`.
- Hash URL mode preserves plain section anchors as native jumps without
  mutating router state.
- Malformed encoded params are handled without crashing the router.
- Prefetch does not mutate router state, history, or DOM. Server route
  prefetch results may be cached briefly and consumed, single use, by the
  next navigation with a matching URL and boundary; expired or mismatched
  entries fall back to a navigation fetch.
- Navigation failures with no caller to reject to (intercepted links, forms,
  history events) are reported to the console in addition to `router.error`
  and the `async:error` event; unmatched navigation without document fallback
  warns with guidance.
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
