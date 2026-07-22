# Diagnostics And Errors

Reference file for [Async Framework](../framework.md). This file owns stable
runtime error codes, diagnostic shape, event-driven reporting, and the boundary
between runtime-local errors and serialized snapshots.

## Purpose

Async errors should identify the failed framework contract, retain the original
cause, and tell an author how to correct the problem without requiring message
parsing. Failures with a direct caller remain throws or rejections. Failures
from delegated events and lifecycle work must have an observable unhandled
path.

## Public Contract

The runtime exports:

- `asyncErrorCodes`, a frozen map of stable lowercase kebab-case codes.
- `AsyncError({ code, message, hint, context, cause })`.
- `isAsyncError(value)`.
- `toAsyncDiagnostic({ error, code, hint, context })`.
- `onError({ error, diagnostic })` options on app, loader, and router runtime
  creation.

An `AsyncDiagnostic` contains:

```js
{
  severity: "error",
  code: "handler-not-registered",
  message: 'Handler "save" is not registered.',
  hint: "Register the handler before starting the app.",
  context: { handler: "save", event: "click" }
}
```

Context accepts only strings, finite numbers, booleans, and `null`. It does not
contain DOM nodes, request bodies, server values, arbitrary objects, causes, or
stacks.

## Stable Codes

The initial public catalog is:

- `runtime-error`
- `handler-not-registered`
- `invalid-handler-command`
- `server-command-unavailable`
- `handler-failed`
- `component-not-registered`
- `async-component-unsupported`
- `partial-not-registered`
- `boundary-not-found`
- `route-not-matched`
- `navigation-failed`
- `entrypoint-required`
- `invalid-server-transport-response`
- `unsupported-server-json-value`

Codes are additive. Existing codes are not renamed to improve wording; a new
code may be introduced when semantics differ materially.

## Reporting Contract

Event-driven loader and router failures use this order:

1. Normalize the original failure into an `AsyncDiagnostic`.
2. Invoke the configured synchronous `onError` callback with one
   `{ error, diagnostic }` record.
3. Dispatch a bubbling, cancelable `async:error` event with the same record as
   `event.detail`.
4. Treat a successful callback or `event.preventDefault()` as handled.
5. If unhandled, call `globalThis.reportError(error)`; when unavailable, queue a
   throw of the original error.

The callback and event both run so application-level handling and DOM-level
observation remain available. If the callback throws, its exception is reported
and the original error remains unhandled unless the event is canceled.

Direct calls such as `handlerRegistry.run(...)`, `router.navigate(...)`,
`loader.swap(...)`, partial rendering, and server proxy calls throw or reject to
their caller and do not enter this reporting path automatically.

## Ownership And Precedence

- `Async.start({ onError })` supplies the callback to every root loader and the
  default router.
- `routerOptions.onError` overrides the app callback for router failures.
- A supplied loader keeps its callback when the app does not provide one. An
  explicit app callback becomes the shared callback for that runtime.
- A standalone router uses its explicit callback, otherwise it reuses the
  supplied loader callback.
- Scheduler errors continue using scheduler ownership and are not routed
  through this contract.

## Snapshot Boundary

Async signal snapshots serialize only stable error name, message, and code.
Hints, context, causes, and stacks stay runtime-local. Restoring a snapshot does
not recreate an `AsyncError` instance or expose private runtime data.

## Failure Modes

- An unknown error code fails `AsyncError` construction instead of creating an
  undocumented compatibility surface.
- Invalid diagnostic context values are omitted rather than serialized.
- An unavailable `CustomEvent` constructor skips DOM dispatch but does not skip
  callback or unhandled reporting.
- An unavailable `reportError` queues a throw so a failure cannot disappear.

## Acceptance Criteria

- Runtime and generated type surfaces expose the same code and report shapes.
- Existing error message substrings remain recognizable.
- Event-driven failures are handled exactly once or reach the platform.
- Direct failures remain owned by their caller.
- Snapshot serialization excludes hint, context, cause, and stack.
- Focused unit, runtime, router, server, build, and bundle tests cover the
  contract.
