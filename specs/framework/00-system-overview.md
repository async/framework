# System Overview

Reference file for [Async Framework](../framework.md). This file owns the
high-level product contract for `@async/framework`; read it before loading a
narrower subsystem reference.

## Purpose

Async is an HTML/runtime protocol framework with resume-capable execution paths.
It should let authors start with plain HTML plus registered runtime behavior,
then grow into server rendering, streaming, and future compiler-generated
protocol artifacts without changing the lower contract.

Async's L0-L7 abstraction layers are owned by
[15-abstraction-layers.md](./15-abstraction-layers.md). Layers are authoring
abstractions; capabilities are protocol properties available from the lowest
layer the protocol allows. Async has two major app classes defined by layers.
System 1 apps use the no-compiler layers (L0-L3, L5): smaller, platform-close
applications that use browser primitives, HTML protocol, explicit registries,
and simple web-server integration. System 2 apps use the compiler layers (L4,
L6, L7): larger applications that use abstractions and compiler output to
improve DX and reduce the mental model required to understand which runtime
systems a change affects.

The core product is not a component hydration system. The core product is a
shared protocol for state, behavior, server effects, routing, partials, cache,
and boundaries that works across browser, server, and resumed documents.

## Responsibilities

- Define a durable HTML and runtime protocol for no-build apps.
- Keep the current product focus on the no-compiler layers (L0-L3, L5) instead
  of pulling build-required abstractions into the baseline runtime.
- Provide browser and server entrypoints that share registry semantics.
- Support local signals, async signals, command events, components, route
  partials, cache, SSR activation, and streamed boundary patches.
- Keep resume behavior based on protocol records and already-rendered DOM, not
  on rerunning component bodies or reconciling virtual nodes.
- Preserve a path for higher authoring systems to compile into the same
  protocol.
- Require no-build apps, simple server apps, streaming apps, and future
  compiler/build-required apps to speak the same protocol.

## Public Contract

The public framework contract is the L0-L7 abstraction layers from
[15-abstraction-layers.md](./15-abstraction-layers.md):

1. L0 Enhance: server-led HTML, native forms/actions, and behavior references
   on server-owned views through ordinary HTML plus `async:*`, `signal:*`,
   `on:*`, `class:*`, and `intersect:*` attributes.
2. L1 Interpret: the runtime app model. HTML attributes, `Async`, `Loader`,
   registries, signals, handlers, components, and boundary swaps with no
   build step.
3. L2 Bundle: build as delivery, router CSR/SPA modes, and app-server
   integration without semantic changes.
4. L3 SSR: server functions, route partials, SSR render output, browser
   snapshots, browser/server cache, and activation of already-rendered HTML.
5. L4 Transform: JSX/TSX authoring that lowers onto the same registries and
   attributes.
6. L5 Stream: streamed boundary patches, reveal ordering, and out-of-order
   settling without requiring an app compiler or bundler.
7. L6 Reorder: co-located server-function extraction, Optimizer-generated
   plans, chunks, and lazy descriptors consumed by runtime slice entrypoints.
8. L7 Optimize: the deferred whole-program compiler and its compact resume
   metadata (lazy module manifests, symbol tables, resource hints,
   resumability records).

The no-compiler layers (L0-L3, L5) must remain understandable without studying
the compiler layers. When a capability requires build-time abstraction to be
coherent, it belongs in the deferred compiler-layer specs until its lower
protocol contract is clear.

## Subsystem Boundaries

- The runtime kernel owns app lifecycle, roots, registries, and isolation.
- The reactivity system owns signal state, derivation, async runs, snapshots,
  and scheduling hooks.
- The DOM protocol owns attribute scanning, event delegation, bindings, and
  boundary targeting.
- The component system owns scoped fragment functions and cleanup.
- The server/data system owns explicit server transports, result envelopes,
  request context, and cache separation.
- The routing/partials system owns route matching, navigation modes, and
  fragment rendering.
- The resume/streaming system owns snapshot activation and boundary patch
  application.
- Packaging/delivery owns public entrypoints, generated artifacts, examples,
  and release checks.

## Protocol Contract

The protocol is the stable system surface. It must be expressible as HTML,
declarations, and serializable runtime records:

- `async:*` attributes mark containers, boundaries, snapshots, and boundary
  views.
- `signal:*` and `class:*` attributes bind state to DOM text, attributes,
  properties, values, and class lists.
- `on:*` attributes name registered commands, server commands, and lifecycle
  pseudo-events.
- Registry declarations describe executable behavior and lazy descriptors by
  stable IDs.
- Server-result envelopes describe effects explicitly, instead of inferring
  effects from ordinary domain objects.
- Boundary patches describe ordered UI, signal, cache, redirect, and error
  effects.

## Resume Contract

Resume is a first-class execution model built from the protocol:

- Existing DOM must be activated by scanning protocol attributes.
- State visible to the browser must be restored from snapshots or explicit
  patches.
- Resume must not require virtual DOM reconciliation.
- Resume must not require component rerendering to attach behavior to
  already-rendered HTML.
- Future compiler output may reduce payload size or defer modules, but it must
  still target protocol artifacts.

## Invariants

- No hidden hydration pass is required for the current runtime protocol.
- No VDOM or component rerender loop is required to update signal bindings.
- Browser network access is explicit; framework startup must not create implicit
  route or server fetches.
- Server-only state and cache contents are not serialized to the browser unless
  an explicit browser-safe protocol record carries them.
- Each runtime owns fresh mutable signal and cache state even when app
  declarations are reusable.

## Failure Modes

- Protocol records that cannot be scanned, restored, or applied must fail with
  a useful framework error.
- Unsupported transport values must be rejected before they are serialized.
- Missing registries, handlers, partials, routes, components, boundaries, or
  server functions must fail at the subsystem boundary that needs them.
- Failed stream patches must not make retryable sequence numbers stale.
- Destroyed roots and scopes must reject or ignore later work instead of
  reviving dead behavior implicitly.

## Acceptance Criteria

- A plain HTML app can load the browser runtime, register signals and handlers,
  scan a root, and update the DOM without a build step.
- An app on the no-compiler layers can add a simple web server, route partials,
  snapshots, and out-of-order boundary patches without adopting a
  build-required app compiler.
- A compiler-generated app can improve authoring DX while still producing the
  same protocol artifacts consumed by apps on the no-compiler layers.
- A server-rendered document can include snapshots and be activated without
  rerendering the app in the browser.
- A route partial can render locally in CSR/SPA modes and remain native in SSR
  or MPA modes.
- A server result can apply value, signal, cache, boundary, redirect, or error
  effects through the explicit envelope model.
- A boundary patch can update state and HTML out of order while preserving
  delegated behavior.

## Open Or Deferred Decisions

- Exact compiler authoring language priority for the compiler layers (owned by
  [16-whole-program-compiler.md](./16-whole-program-compiler.md) for L7).
- Compact binary or dense JSON encoding for future protocol records.
- Public devtools and protocol-inspection APIs.
- How much of future resume metadata should be stable public contract versus
  compiler-private optimization.
