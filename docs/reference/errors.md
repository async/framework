# Errors And Diagnostics

Framework failures use stable codes and corrective hints without changing the
existing human-readable message. Import the public helpers from the browser,
router, flow, or server entrypoint used by the application:

```js
import {
  AsyncError,
  asyncErrorCodes,
  isAsyncError,
  toAsyncDiagnostic
} from "@async/framework/browser";
```

## Error Shape

`AsyncError` uses an object-first constructor:

```js
const error = new AsyncError({
  code: asyncErrorCodes.componentNotRegistered,
  message: 'Component "ProductCard" is not registered.',
  hint: "Register it with Async.use({ component }).",
  context: { component: "ProductCard" },
  cause
});
```

`code`, `message`, `hint`, and `context` are runtime fields. `cause` remains on
the error for local debugging. `isAsyncError(value)` identifies framework
errors.

`toAsyncDiagnostic({ error, code, hint, context })` returns a frozen record:

```js
{
  severity: "error",
  code: "component-not-registered",
  message: 'Component "ProductCard" is not registered.',
  hint: "Register it with Async.use({ component }).",
  context: { component: "ProductCard" }
}
```

Diagnostic context accepts only finite numbers, strings, booleans, and `null`.
It never contains a stack, cause, DOM node, request body, array, or arbitrary
object. This makes diagnostics suitable for structured logs and UI messages;
the original error remains available to local error tooling.

## Stable Code Catalogue

| Code | Meaning | Typical correction |
| --- | --- | --- |
| `runtime-error` | An unknown runtime failure was normalized. | Inspect the original error and the operation context. |
| `handler-not-registered` | An `on:*` command names a missing handler. | Register the handler with `Async.use({ handler })` or create it with `this.handler(...)`. |
| `invalid-handler-command` | A delegated handler or server command is malformed. | Use a registered command name and valid literal arguments. |
| `server-command-unavailable` | A server command was used without a server registry or proxy. | Configure the server registry or browser server transport before invoking it. |
| `handler-failed` | A delegated event or lifecycle handler threw. | Fix the named handler and inspect the original cause. |
| `component-not-registered` | `async:component` names a missing component. | Register the component before starting or scanning the host. |
| `async-component-unsupported` | A component returned a Promise. | Keep rendering synchronous and move async work into a signal, partial, handler, or boundary. |
| `partial-not-registered` | A route or caller names a missing partial. | Register the partial before rendering or navigating. |
| `boundary-not-found` | A swap or refresh names a missing boundary. | Add the matching `async:boundary` or correct the boundary ID. |
| `route-not-matched` | No registered route matches the URL. | Register the route or choose document fallback for native navigation. |
| `navigation-failed` | Event-driven navigation failed after matching or interception. | Inspect the cause, route, partial, and transport used by the navigation. |
| `entrypoint-required` | A feature was registered through an entrypoint that does not install it. | Import the router or flow entrypoint named by the diagnostic. |
| `invalid-server-transport-response` | The server transport returned an unsupported response shape or unreadable body. | Return a supported response object or JSON envelope from the transport. |
| `unsupported-server-json-value` | A server result contains a value JSON transport cannot preserve. | Return JSON-compatible data and inspect the reported value path. |

Codes are additive public API. Consumers should branch on a known code and
retain a default branch for future codes.

## Event-Driven Failures

`LoaderOptions`, `RouterOptions`, and `CreateAppOptions` accept the same
callback:

```js
const runtime = Async.start({
  root: document,
  onError({ error, diagnostic }) {
    errorService.capture(error, diagnostic);
  }
});
```

The runtime calls `onError` and then always dispatches `async:error` from the
owned target. The event bubbles, is cancelable, and exposes the same report as
`event.detail`:

```js
document.addEventListener("async:error", (event) => {
  showErrorMessage(event.detail.diagnostic);
  event.preventDefault();
});
```

A callback invocation that returns normally handles the original failure. So
does `event.preventDefault()`. If neither handles it, the runtime calls
`globalThis.reportError(error)` or queues a throw when no platform reporter is
available. If the callback throws, its exception is reported separately and
the original failure remains unhandled unless the event is canceled.

An application callback is passed to every root loader and its router. An
explicit `routerOptions.onError` overrides it for router failures. An external
loader keeps its callback unless the application explicitly supplies
`onError`.

Direct methods such as `handlers.run(...)`, `router.navigate(...)`,
`partials.render(...)`, and `loader.swap(...)` throw or reject to their caller.
They are not globally reported a second time. Scheduler error ownership is
unchanged.

## Related

- [App Authoring Contract](#/docs/app-authoring)
- [Entrypoints](#/reference/entrypoints)
- [Diagnostics contract](../../specs/framework/17-diagnostics-and-errors.md)
