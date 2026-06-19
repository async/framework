# Reactivity System

Reference file for [Async Framework](../framework.md). This file owns signals,
computed values, effects, async signals, snapshots, dependency tracking, and
scheduler interaction.

## Purpose

Async reactivity should be explicit, small, and protocol-friendly. Signals are
the state boundary for no-build apps and the target that future compiler layers
can emit.

## Responsibilities

- Provide mutable signals with `get`, `set`, `update`, `subscribe`, and
  snapshot behavior.
- Provide computed and effect declarations that bind to registry reads.
- Provide async signals with loading, ready, error, version, refresh, cancel,
  and abort semantics.
- Track synchronous signal reads for computed/effect/async dependencies.
- Restore plain and async signal snapshots.
- Route DOM update work through the scheduler instead of a render loop.

## Public Contract

Public primitives include:

- `createSignal(initial)` and `signal(initial)`.
- `computed(fn)` and `effect(fn)`.
- `createSignalRegistry(initialMap?)`.
- `asyncSignal(id, fn)` and registry `asyncSignal(...)` helpers.
- Signal refs from registry `ref(...)` and component helpers.

Signal paths use the first registered segment as the signal ID. Dotted paths
inside that signal read or write nested values unless an exact snapshot ID is
being restored by the runtime.

## Subsystem Boundaries

- Signal registries own state values and subscriptions.
- The scheduler owns phase ordering for DOM bindings, lifecycle, effects, async
  refreshes, and post-flush work.
- The loader consumes signal subscriptions to update DOM.
- Async signals may call server namespaces through the active runtime context.
- Snapshot restore is owned by the runtime but delegated to signal primitives.

## Protocol Contract

Signal state is part of the protocol:

- `signal:*` attributes read signal paths.
- `class:*` and `signal:class` consume signal values for class updates.
- Server-result envelopes and boundary patches may set signal paths.
- Snapshots may restore signal values and async-signal status records.
- Browser-visible snapshots must serialize stable public error fields for async
  failures.

## Resume Contract

Resume depends on signal restoration:

- Browser activation must restore signal values before bindings are expected to
  display final state.
- Async-signal descriptors must be adopted before matching snapshots are
  restored, so resumed async records do not trigger unnecessary refreshes.
- Canceled, restored, disposed, unregistered, or superseded async runs must not
  commit late values or errors.
- Abort signals must stay tied to the run that created them.

## Invariants

- Signal writes are synchronous from the registry point of view.
- DOM binding updates are scheduled and ordered by phase.
- Async dependencies are captured before the first awaited boundary.
- Late async completions from stale runs are ignored.
- Error snapshots expose stable `name`, `message`, and optional `code` fields
  rather than arbitrary error objects.

## Failure Modes

- Reading or writing an unregistered signal path fails clearly.
- Async signals that refresh after unregister or disposal fail as inactive.
- Scheduler errors are reported through configured error channels or thrown from
  manual flushes.
- Unsupported snapshot shapes fall back only when explicitly defined by the
  signal primitive.

## Acceptance Criteria

- Signal text, value, attribute, property, and class bindings update after
  signal changes.
- Computed values update from tracked registry reads.
- Effects clean up when owning scopes are destroyed.
- Async signals abort stale runs and expose loading, ready, error, and version
  state.
- SSR snapshots can restore rejected async-signal errors into readable DOM
  bindings.

## Open Or Deferred Decisions

- Whether collection-specific reactive helpers belong in the runtime layer.
- Public debugging API for dependency graphs.
- More compact async-signal snapshot encodings.
- Compiler-owned state lowering semantics for future authoring layers.
