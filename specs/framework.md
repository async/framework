# Async Framework

This is the root intent spec for `@async/framework`. It defines the framework
thesis, app classes, layer model, protocol/resume relationship, and subsystem
ownership. The reference files under
[specs/framework](./framework/00-system-overview.md) are the detailed contracts
for each system.

Async is both a protocol-first framework and a resume-capable framework. The
protocol defines the durable contract: HTML attributes, registries, snapshots,
server-result envelopes, route partials, cache patches, and boundary patches.
Resume defines how an existing document continues from that contract without
reconstructing application state through a virtual tree. Neither framing is
secondary: the protocol must be strong enough to resume, and resume must
preserve the protocol instead of bypassing it.

## How To Use This File

Source order:

1. Use this file to understand the framework intent and find the owning
   reference file.
2. Read [00-system-overview.md](./framework/00-system-overview.md) for the
   product thesis and non-goals, and
   [15-abstraction-layers.md](./framework/15-abstraction-layers.md) for the
   layer model.
3. Read the narrow reference file for the behavior being designed,
   implemented, or reviewed.
4. If implementation behavior conflicts with these specs, treat the conflict as
   a framework design issue. Update the spec deliberately or change the
   implementation to match the spec.

These specs are intent-first. They describe the system Async should become, not
only the code that exists today.

## Protocol And Resume

Async differs from frameworks that lead with component resumption as the primary
concept. Async leads with an explicit runtime protocol that can be consumed by a
no-build app, by a server-rendered app, by a streaming receiver, and by future
compiler output.

The protocol contract includes:

- scannable HTML attributes for containers, commands, signals, class toggles,
  lifecycle hooks, and boundaries
- registry declarations for signals, handlers, server functions, partials,
  routes, components, cache definitions, and lazy descriptors
- JSON snapshots that restore browser-visible state without executing server
  logic
- explicit server-result envelopes for value, signal, cache, HTML, redirect,
  and error effects
- route and partial contracts for local navigation and server-rendered
  fragments
- boundary patches for streamed or out-of-order UI replacement

The resume contract includes:

- attaching behavior to already-rendered HTML without a hydration diff
- restoring signal and async-signal state from snapshots
- preserving delegated event and lifecycle behavior after HTML replacement
- applying server and stream effects in deterministic order
- supporting future lazy module and compiler metadata without changing the
  lower HTML/runtime protocol

The important consequence is that no-build apps, simple server apps, streaming
apps, and future compiler/build-required apps should all speak the same
protocol. A compiler can improve DX, but it must compile down to protocol
artifacts rather than inventing a separate hidden runtime model.

## Layers

Async's L0-L7 abstraction layers are owned by
[15-abstraction-layers.md](./framework/15-abstraction-layers.md). Each layer is
anchored to an era of framework history and named by the abstraction it adds
between the author and the runtime protocol:

1. L0 Enhance: server-led HTML, native forms/actions, and behavior references
   on server-owned views.
2. L1 Interpret: the runtime-interpreted app model, no build.
3. L2 Bundle: build as delivery, client routing, and an app server.
4. L3 SSR: server-rendered component functions with browser activation.
5. L4 Transform: JSX/TSX source transforms that lower to protocol records.
6. L5 Stream: progressive documents with boundary reveal ordering.
7. L6 Reorder: out-of-order settling, co-located server-function extraction,
   chunks, and plans automated by the Optimizer.
8. L7 Optimize: whole-program compilation, currently specification only.

Layers are authoring abstractions; capabilities are protocol properties. A
capability lands at the lowest layer the protocol allows, layers compose within
one document, and industry patterns such as islands are layer combinations,
not layers.

The two app classes remain, redefined by layers. System 1 apps use the
no-compiler layers (L0-L3, L5): smaller, platform-close apps authored through
HTML, browser modules, explicit registries, and simple server integration.
System 2 apps use the compiler layers (L4, L6, L7), where abstractions improve
DX and reduce the mental model required to understand which runtime systems a
change affects. The current framework focus is System 1. Compiler-layer work
is deferred and must compile down to the same protocol instead of replacing
it with a private component tree or hidden hydration model.

## Reference Files

- [00-system-overview.md](./framework/00-system-overview.md) - product thesis,
  protocol/resume framing, app classes, layers, goals, and non-goals.
- [01-authoring-model.md](./framework/01-authoring-model.md) - HTML-first
  authoring, registered behavior, and future compiler targets.
- [02-runtime-kernel.md](./framework/02-runtime-kernel.md) - app hub, runtime
  lifecycle, registries, roots, isolation, and cleanup.
- [03-reactivity-system.md](./framework/03-reactivity-system.md) - signals,
  computed/effect behavior, async signals, snapshots, cancellation, and
  scheduler interaction.
- [04-dom-protocol.md](./framework/04-dom-protocol.md) - HTML attributes,
  scanning, bindings, command events, class protocol, and boundaries.
- [05-component-system.md](./framework/05-component-system.md) - scoped
  fragment components, lifecycle hooks, intersection, child rendering, and
  disposal.
- [06-server-and-data-system.md](./framework/06-server-and-data-system.md) -
  server functions, explicit transport, envelopes, request context, and cache
  split.
- [07-routing-and-partials.md](./framework/07-routing-and-partials.md) -
  router and partial contracts, navigation modes, and ownership.
- [08-resume-and-streaming.md](./framework/08-resume-and-streaming.md) -
  snapshot activation, boundary patches, sequence handling, redirects, errors,
  and streaming semantics.
- [09-packaging-and-delivery.md](./framework/09-packaging-and-delivery.md) -
  package entrypoints, CDN artifacts, generated bundles, examples, and release
  expectations.
- [10-deferred-systems.md](./framework/10-deferred-systems.md) - deferred
  compiler-layer systems, lazy chunks, deeper resumability metadata, and future
  decisions.
- [11-runtime-slice-entrypoints.md](./framework/11-runtime-slice-entrypoints.md)
  - optimized built-mode runtime entrypoints, generated plan contracts, slice
  controllers, teardown, and scenario size budgets.
- [12-composition-patterns.md](./framework/12-composition-patterns.md) -
  composition pattern guidance for children, regions, templates, presenters,
  outlets, boundaries, and anti-patterns.
- [13-scheduler-and-commit-phase.md](./framework/13-scheduler-and-commit-phase.md)
  - scheduler timing, visual commit phase, background work, and
  `Async.loader.swap(...)` completion semantics.
- [14-use-declarations-and-conventions.md](./framework/14-use-declarations-and-conventions.md)
  - `Async.use(...)` declarations, convention routing, duplicate policies,
  system identity, materialization timing, and queued capability facades.
- [15-abstraction-layers.md](./framework/15-abstraction-layers.md) - the
  L0-L7 abstraction layers, layer contracts, capability availability,
  cross-layer pattern composition, legacy layer mapping, and build-config
  direction.
- [16-whole-program-compiler.md](./framework/16-whole-program-compiler.md) -
  the deferred L7 whole-program compiler profile, ownership boundaries,
  resumability record constraints, and spec-only status.
- [17-diagnostics-and-errors.md](./framework/17-diagnostics-and-errors.md) -
  stable runtime error codes, diagnostic shape, event-driven reporting, and
  snapshot safety boundaries.
