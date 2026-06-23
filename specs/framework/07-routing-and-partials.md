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

Routing primitives include:

- `defineRoute(partial, options?)` and `route(...)` compatibility alias.
- `createRouteRegistry(initialMap?)`.
- `createPartialRegistry(initialMap?)`.
- `createRouter({ mode, urlMode, root, boundary, routes, partials, loader })`.

Router modes:

- `csr`: initial route renders locally into an empty route boundary and later
  navigation stays local.
- `spa`: existing HTML may contain route content and later navigation stays
  local.
- `ssr`: the document is server-rendered and browser navigation stays native.
- `mpa`: any document source and browser navigation stays native.

Router URL modes:

- `path`: default. Route matching uses the browser path and query string.
- `hash`: route matching uses `#/path?query` while preserving ordinary section
  anchors such as `#quickstart` as native page jumps.

## Subsystem Boundaries

- Routes match URLs and point to partial IDs.
- Partials render fragment content and may call server functions.
- The loader owns boundary swaps and rescans.
- The signal registry owns `router.*` state.
- Server rendering may use the same route and partial registries to produce
  initial HTML.

## Protocol Contract

Routing protocol includes:

- Route patterns as stable strings.
- Partial IDs as registry references.
- Route boundary ID, usually `route`.
- Router URL mode, either `path` or `hash`.
- Router signals: `router.url`, `router.path`, `router.params`,
  `router.query`, `router.route`, `router.pending`, and `router.error`.
- Partial results that may include HTML and server-result-like side effects.

CSR and SPA modes consume local partial output. SSR and MPA modes preserve
native document navigation and must not perform hidden route-fragment fetches.

## Resume Contract

Routing resume behavior:

- SSR activation starts from existing HTML and snapshots.
- SSR mode does not intercept same-origin link clicks for local partial fetches.
- SPA mode may use existing route HTML as the initial state, then own later
  local navigation.
- Route boundary swaps must rescan inserted protocol attributes.
- Stale navigation results must not overwrite newer router state or DOM.

## Invariants

- Route matching ranks specific routes ahead of wildcard fallbacks.
- Hash URL mode matches `#/path?query` as `/path?query`.
- Malformed encoded params are handled without crashing the router.
- Prefetch does not mutate router state, history, or DOM.
- Navigation errors update route error state without corrupting the active
  boundary.
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
- SPA navigation swaps a route boundary and rescans inserted handlers.
- Wildcard fallback routes handle unmatched paths.
- SSR and MPA modes do not intercept link clicks.
- Prefetch returns rendered partial content or errors without DOM mutation.

## Open Or Deferred Decisions

- Data preloading and route resource protocols.
- Scroll/focus restoration ownership.
- Nested route boundary conventions.
- Public route transition hooks beyond current signals and errors.
