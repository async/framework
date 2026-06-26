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
   product thesis, layer model, and non-goals.
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

## App Classes And Layers

Async has two major app classes:

1. System 1 apps are no-build or low-build apps. They are usually smaller in
   scale, closer to the browser platform, and authored through HTML, browser
   modules, explicit registries, and simple server integration.
2. System 2 apps are build-required apps. They use compiler or framework
   abstractions to improve DX and reduce the mental model required to understand
   which runtime systems are affected when a developer changes code.

The current framework focus is System 1:

1. Layer 1 runtime protocol: browser primitives that work without a build step.
2. Layer 1.5 no-build/low-build server path: a simple web server, route
   partials, SSR snapshots, cache patches, and possible out-of-order streaming
   without requiring an app compiler or bundler.

System 2 is deferred. Higher layers may generate protocol artifacts, lazy module
metadata, or deeper resumability records, but those abstractions must compile
down to the System 1 protocol instead of replacing it with a private component
tree or hidden hydration model.

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
- [10-deferred-systems.md](./framework/10-deferred-systems.md) - System 2
  compiler layers, lazy chunks, deeper resumability metadata, and future
  decisions.
- [11-runtime-slice-entrypoints.md](./framework/11-runtime-slice-entrypoints.md)
  - optimized built-mode runtime entrypoints, generated plan contracts, slice
  controllers, teardown, and scenario size budgets.
- [12-composition-patterns.md](./framework/12-composition-patterns.md) -
  composition pattern guidance for children, regions, templates, presenters,
  outlets, boundaries, and anti-patterns.
- [13-use-declarations-and-conventions.md](./framework/13-use-declarations-and-conventions.md)
  - `Async.use(...)` declarations, convention routing, duplicate policies,
  system identity, materialization timing, and queued capability facades.
