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
- `Async.attachRoot(root)` and `Async.detachRoot(root)` for singleton root
  lifecycle.
- `Async.applySnapshot(snapshot)` for browser-visible state restoration before
  or after startup.
- `Async.inspectRoots()` and `Async.inspectRuntime()` for diagnostics that do
  not expose the runtime as the public singleton API.
- `Async.loader.ready()`, `Async.loader.scan(...)`,
  `Async.loader.swap(...)`, `Async.loader.mount(...)`, and
  `Async.loader.inspect()` for promise-returning loader work that may be issued
  before a browser root has been attached.
- `runtime.registry` and `Async.registry` for inspection.

Browser runtimes may start rootless and attach roots later. Server runtimes do
not attach DOM roots.

`Async.runtime` is not a supported public API. The app hub may retain an
internal non-enumerable `_runtime` slot for framework integrations, but
application code should use app-level methods or the explicit runtime handle
returned from `Async.start(...)` / `createApp(...).start()`.

## Subsystem Boundaries

- The kernel owns registry materialization and runtime lifecycle.
- The loader owns DOM scanning once a root is attached.
- The app-level loader facade owns bootstrap ordering and promise completion for
  scheduled commit work. The concrete runtime loader keeps synchronous
  validation and return shapes while DOM mutation runs through the scheduler
  commit phase.
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
- The app-level loader facade can queue scan, swap, and mount operations until
  a concrete runtime loader exists.
- Attaching a root scans existing protocol attributes and connects them to the
  runtime registries.
- Detaching or destroying a root cancels scoped scheduler jobs and cleanup
  hooks so later resumed or streamed work cannot target dead scopes.

## Invariants

- App declarations are reusable; runtime state is not shared by accident.
- A runtime's signal and cache registries are mutable runtime state.
- App hubs do not expose mutable runtime state through a public `runtime`
  property.
- Server cache and browser cache are distinct runtime surfaces.
- Destroyed runtimes reject future root attachment.
- Attaching the same root more than once is idempotent.
- `Async.use(...)` remains synchronous and registry-first; queued loader work
  observes declarations that were registered before the queue flushes.

## Failure Modes

- Unknown declaration types fail during `use(...)`.
- Duplicate IDs fail unless a subsystem explicitly defines compatible adoption.
- Server runtimes reject DOM root attachment.
- Destroyed runtimes reject future lifecycle operations.
- Queued app-level loader operations reject individually if the concrete loader
  cannot apply them.
- Snapshot parse or shape failures are surfaced as Async-specific errors.

## Acceptance Criteria

- Two runtimes created from one app declaration do not share mutable signal
  values or cache entries.
- Late `app.use(...)` declarations become visible to active runtimes.
- Rootless startup can later attach and detach roots without duplicate binding.
- Loader work queued before startup flushes in order once the first browser
  root is attached, without changing the synchronous `runtime.loader` contract.
- Runtime inspection can report active target, root, loader, and router state
  without exposing the mutable runtime as `Async.runtime`.
- Destroying a runtime cleans loaders, routers, signal state, and owned
  scheduler work.

## Open Or Deferred Decisions

- Public shape of deeper runtime introspection APIs beyond
  `Async.inspectRuntime()`.
- Whether app hubs should support named runtime instances.
- How strict live declaration replacement should be when IDs already exist.
- Whether root lifecycle should emit public diagnostic events.
