# @async/framework App Authoring Contract

Use this contract for applications, public examples, and reusable feature code
built with `@async/framework`. The framework owns attachment, event delegation,
signal bindings, fragment cleanup, and boundary updates.

## Start From The HTML Protocol

Register behavior once, declare the component host in HTML, and start the
document root:

```html
<main async:container async:component="CatalogApp"></main>
```

```js
import { Async, component, html } from "@async/framework/browser";

const CatalogApp = component(function CatalogApp() {
  const selected = this.signal("selected", false);

  return html`
    <button
      type="button"
      on:click="${this.handler(function () {
        selected.update((value) => !value);
      })}"
      class:selected="${selected.id}"
      signal:attr:aria-pressed="${selected.id}"
    >
      Select
    </button>
  `;
});

Async.use({ component: { CatalogApp } });
Async.start({ root: document, router: false });
```

`document` and `document.body` are valid startup roots. Feature code should not
use them to rediscover framework-owned elements after startup.

## Preferred Authoring Patterns

| Need | Use | Avoid in normal feature code |
| --- | --- | --- |
| Attach a root component | `async:component` plus `Async.use({ component })` | `document.querySelector(...)` plus `loader.attach(...)` |
| Handle an event | `on:*` with a registered or component-local handler | document-level feature listeners |
| Reflect state | `signal:*`, `class:*`, and computed signals | manual `textContent`, attributes, or class mutation |
| Render a stable child shape | `this.render(...)` | rebuilding a subtree by hand |
| Replace a dynamic child shape | `this.slot(...)` | assigning `innerHTML` |
| Load server or route HTML | partials and named `async:boundary` targets | fetching and injecting arbitrary markup |
| Share application behavior | `Async.use(...)` registries | hidden module-level DOM ownership |

Keep catalog entries, API records, route data, and other domain values as plain
data. Put view state and derived values in signals. A selected record ID is
signal state; the unchanged catalog it selects from is ordinary data.

Prefer component-local `this.signal(...)`, `this.computed(...)`, and
`this.handler(...)` when state and behavior belong to one rendered fragment.
Use app registries when multiple roots, routes, or features share the same
declaration.

## DOM Escape Hatches

Imperative DOM is allowed when the DOM operation is the platform capability:

- a scoped lifecycle handler receives `element`, performs focus, measurement,
  canvas work, or widget setup, and returns cleanup when it creates resources;
- a named adapter activates SSR output or applies stream patches;
- a named adapter integrates a third-party widget that cannot use the HTML
  protocol.

Keep the escape hatch narrow. Pass elements into the adapter instead of
searching the whole document, and keep feature state in signals rather than in
DOM reads. Public examples with an imperative adapter must explain the
exception next to the example.

## Structure And Updates

Components are synchronous fragment functions. Move asynchronous work into an
async signal, partial, handler, or boundary update; do not return a Promise from
a component.

Use `this.render(...)` when the child structure is known while the parent
renders. Use `this.slot(...)` when the child component or props must change
after attachment. Use named partials and boundaries for server-owned or
route-owned fragments. These paths preserve delegated handlers, signal
bindings, scheduler ordering, and cleanup.

Do not use `innerHTML` as a feature rendering mechanism. It bypasses framework
ownership and can leave stale handlers, bindings, and component resources.

## Actionable Errors

Install an app-level callback for event-driven failures:

```js
Async.start({
  root: document,
  router: false,
  onError({ error, diagnostic }) {
    errorService.capture(error, diagnostic);
  }
});
```

`diagnostic` is a stable, safe record with `severity`, `code`, `message`, an
optional `hint`, and optional scalar-only `context`. Use `diagnostic.code` for
branching and logs; display `hint` as corrective guidance.

Event-driven failures call `onError` first and then dispatch a bubbling,
cancelable `async:error` event containing the same `{ error, diagnostic }`
report. A callback that returns normally or an event listener that calls
`preventDefault()` handles the failure. Otherwise the runtime forwards the
original error to the platform error reporter, with a queued throw as the
fallback.

Direct API calls continue to throw or reject to their caller. Catch those at
the call site; the runtime does not report them a second time.

Use `AsyncError`, `asyncErrorCodes`, `isAsyncError`, and `toAsyncDiagnostic`
when an adapter needs to create or normalize a framework-compatible failure.
Keep causes, stacks, DOM nodes, request bodies, and arbitrary values out of
diagnostic context.
