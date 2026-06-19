# Runtime Kernel

Reference file for [Async Framework](../framework.md). This file owns app
declarations, runtime instances, roots, registries, and lifecycle isolation.

## Purpose

The runtime kernel turns app declarations into running browser or server
contexts. It must let a reusable app definition create isolated mutable runtime
state while preserving a shared registry vocabulary.

## Responsibilities

- Provide the `Async` app hub and isolated app hubs from `defineApp(...)`.
- Start browser or server runtimes through `createApp(...)`.
- Materialize registries for signals, handlers, server functions, partials,
  routes, components, cache definitions, and lazy descriptors.
- Attach and detach DOM roots.
- Apply snapshots before or after startup.
- Destroy runtimes, roots, schedulers, and scoped resources deterministically.

## Public Contract

The runtime exposes:

- `Async.use(...)` for app-level declaration registration.
- `Async.start(...)` and `createApp(...).start()` for runtime creation.
- `runtime.use(...)` for late declaration adoption.
- `runtime.attachRoot(root)` and `runtime.detachRoot(root)` for root lifecycle.
- `runtime.applySnapshot(snapshot)` for browser-visible state restoration.
- `runtime.registry` and `Async.registry` for inspection.

Browser runtimes may start rootless and attach roots later. Server runtimes do
not attach DOM roots.

## Subsystem Boundaries

- The kernel owns registry materialization and runtime lifecycle.
- The loader owns DOM scanning once a root is attached.
- The router owns navigation once started for a root.
- The scheduler owns queued work ordering.
- Signal and cache registries own mutable data state.
- Server registries own privileged function execution.

## Protocol Contract

The kernel must preserve registry shapes:

- Canonical declaration keys are `signal`, `handler`, `server`, `partial`,
  `route`, `component`, `asyncSignal`, `cache.browser`, and `cache.server`.
- Runtime registry inspection exposes public declaration metadata without
  leaking server-only executable functions into browser contexts.
- Late declarations are adopted by live runtimes without mutating previous
  runtime-owned signal or cache values unexpectedly.
- Snapshots may be applied before startup or to active runtimes.

## Resume Contract

Runtime activation must support resumed documents:

- A browser runtime can start with an existing document and snapshot.
- A rootless runtime can prepare registries before the root exists.
- Attaching a root scans existing protocol attributes and connects them to the
  runtime registries.
- Detaching or destroying a root cancels scoped scheduler jobs and cleanup
  hooks so later resumed or streamed work cannot target dead scopes.

## Invariants

- App declarations are reusable; runtime state is not shared by accident.
- A runtime's signal and cache registries are mutable runtime state.
- Server cache and browser cache are distinct runtime surfaces.
- Destroyed runtimes reject future root attachment.
- Attaching the same root more than once is idempotent.

## Failure Modes

- Unknown declaration types fail during `use(...)`.
- Duplicate IDs fail unless a subsystem explicitly defines compatible adoption.
- Server runtimes reject DOM root attachment.
- Destroyed runtimes reject future lifecycle operations.
- Snapshot parse or shape failures are surfaced as Async-specific errors.

## Acceptance Criteria

- Two runtimes created from one app declaration do not share mutable signal
  values or cache entries.
- Late `app.use(...)` declarations become visible to active runtimes.
- Rootless startup can later attach and detach roots without duplicate binding.
- Runtime inspection can list registry keys without exposing browser-forbidden
  server internals.
- Destroying a runtime cleans loaders, routers, signal state, and owned
  scheduler work.

## Open Or Deferred Decisions

- Public shape of deeper runtime introspection APIs.
- Whether app hubs should support named runtime instances.
- How strict live declaration replacement should be when IDs already exist.
- Whether root lifecycle should emit public diagnostic events.
