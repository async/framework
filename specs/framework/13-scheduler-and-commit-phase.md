# Scheduler And Commit Phase

Reference file for [Async Framework](../framework.md). This file owns
scheduler timing, visual commit ordering, background work, and
`Async.loader.swap(...)` promise completion.

## Purpose

Async needs deterministic ordering for signal effects, lifecycle callbacks,
route partials, and streamed boundary patches without turning the runtime into a
component renderer. The scheduler orders explicit work that the protocol
already names. It is not React Fiber, a virtual DOM reconciler, or a hidden
renderer loop.

## Responsibilities

- Keep registration and validation synchronous.
- Resolve signal effects, async-signal state, and lifecycle work in microtasks.
- Commit visual DOM replacement and morph work in the commit phase.
- Resolve post-commit promises only after inserted DOM has been scanned and the
  post flush has completed.
- Run non-critical background work only after required visible work is done.
- Provide deterministic fallbacks for server, command-line, and test runtimes
  that do not expose browser frame or idle callbacks.

## Timing Model

Scheduler timing is phase based:

1. Sync and registration: `Async.use(...)`, registry adoption, option
   validation, boundary lookup, signal reads, signal writes, and direct handler
   invocation remain ordinary synchronous JavaScript.
2. Microtask resolve and effects: binding updates, lifecycle callbacks, signal
   effects, and async-signal work flush from the microtask scheduler unless a
   manual scheduler is supplied.
3. Animation-frame commit: visual boundary replacement, morph work, route
   partial DOM commits, and streamed HTML swaps run in the commit phase. Browser
   runtimes use `requestAnimationFrame` for this phase when it is available.
4. Post flush: post callbacks and completion promises settle after commit work
   has run, inserted DOM has been scanned and bound, and earlier phase work
   created by that scan has drained.
5. Idle and background: optional non-critical work runs after the post flush.
   Browser runtimes may use `requestIdleCallback` for this phase.

`requestAnimationFrame` is only for visual commit work. `requestIdleCallback` is
only for non-critical background work. Neither callback is required to run
registration, signal writes, event dispatch, server result parsing, or ordinary
effect scheduling.

## Public Contract

`createScheduler(...)` exposes a small deterministic scheduler with named
phases, `enqueue(...)`, `afterFlush(...)`, `commit(...)`, `flush(...)`,
`flushScope(...)`, scope cancellation, and inspection.

`Async.loader.swap(...)` is the app-level promise-returning swap API. It queues
until a concrete browser loader exists, schedules DOM mutation in the scheduler
commit phase, and resolves only after:

- the target boundary has been replaced or morphed
- inserted protocol attributes have been scanned
- signal, class, event, component, and lifecycle bindings created by that scan
  have had their required flush opportunity
- post-commit scheduler callbacks have completed

The concrete runtime loader still validates synchronously, returns the same
boundary, boundary array, or cleanup function shape as before, and is used by
routers, server-result application, and streaming receivers. Integrations that
need completion semantics must wait for the scheduled commit before reporting
success, redirecting, or resolving app-level promises.

## Fallbacks

When `requestAnimationFrame` is unavailable, the commit phase falls back to a
synchronous deterministic commit. This keeps server and test runtimes stable
while preserving the same post-flush promise boundary.

When `requestIdleCallback` is unavailable, background work remains a normal
scheduler phase after post flush. It must not be required for visible DOM
correctness.

Manual schedulers do not auto-flush. Tests and custom runtimes that choose a
manual scheduler must call `flush(...)` or `flushScope(...)` to advance queued
work.

## Subsystem Boundaries

- The scheduler orders work; it does not discover DOM, diff components, own a
  render tree, or decide what HTML should exist.
- The loader owns boundary lookup, cleanup, replacement, morphing, scanning,
  and binding.
- The router owns navigation state and route partial selection, then waits for
  loader commit completion before finishing DOM-changing navigation.
- The boundary receiver owns patch sequence and retry state, then waits for
  loader commit completion before consuming a successful sequence number.
- Server-result application owns envelope effect ordering, then waits for
  loader commit completion before following redirects that depend on committed
  HTML.

## Invariants

- Sync validation errors surface before commit scheduling.
- Commit jobs for the same boundary serialize when frame-backed commits are
  deferred.
- Independent boundaries may prepare or commit independently unless a caller
  explicitly batches them.
- Post callbacks do not resolve before earlier phase work created by a commit
  has had a chance to drain.
- Background work never gates boundary correctness.

## Failure Modes

- A missing boundary fails before a swap is scheduled.
- A scan or binding failure during commit rejects the app-level swap promise and
  lets streaming receivers retry the same sequence number.
- Destroyed scopes cancel their pending scheduler work.
- A destroyed runtime rejects queued loader work and prevents later commit
  attempts from targeting detached roots.

## Acceptance Criteria

- A frame-backed app-level `Async.loader.swap(...)` does not mutate the DOM
  before the animation-frame commit.
- The same promise resolves only after replacement, scan, inserted bindings,
  lifecycle flush, and post flush complete.
- Non-browser runtimes without `requestAnimationFrame` keep deterministic
  synchronous commit fallback behavior.
- Same-boundary frame commits serialize so a later swap cannot commit before an
  earlier in-flight swap finishes.
- Streamed boundary patches report success only after the scheduled loader
  commit finishes.
