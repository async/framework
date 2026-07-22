# Entrypoints

For npm consumers, `@async/framework` uses conditional exports: browser-aware
tooling receives the browser entry, while Node receives the server-capable
entry. Use explicit subpaths when the target matters.
The root export also uses condition-specific declarations, so browser-conditioned
root imports expose the same API as `@async/framework/browser`; server-only APIs
remain declared on the Node/server entrypoints.

```js
import {
  Async,
  AsyncError,
  Loader,
  attributeName,
  asyncErrorCodes,
  asyncSignal,
  createApp,
  createCacheRegistry,
  createComponentRegistry,
  createLazyRegistry,
  computed,
  component,
  createSignal,
  createHandlerRegistry,
  createRegistryStore,
  createScheduler,
  createServerProxy,
  createSignalRegistry,
  defineAsyncContainerElement,
  defineAsyncSuspenseElement,
  defineAttributeConfig,
  defineApp,
  defineCache,
  defineRegistrySnapshot,
  delay,
  effect,
  html,
  isAsyncError,
  readSnapshot,
  signal,
  toAsyncDiagnostic
} from "@async/framework/browser";
```

Use feature subpaths when an app needs the larger browser systems:

```js
import { AsyncStream } from "@async/framework/stream";
import { Async, defineRoute } from "@async/framework/router";
import { flow, flowSignal, flowStatus, compose, when, transition } from "@async/framework/flow";
```

The flow entry re-exports the complete `@async/flow` authoring surface:
declaration helpers (`flowSignal`, `flowComputed`, `flowAsyncSignal`,
`flowStatus`), step helpers (`set`, `update`, `when`, `branch`, `guard`,
`transition`, `dispatch`, `after`, `onError`), condition helpers (`bool`,
`every`, `some`, `not`, `can`, `matches`, `inspect`), and composition
(`compose`, `parallel`, `remember`). Apps do not need to install
`@async/flow` separately.

Server-only APIs live behind the server entry:

```js
import {
  createRequestContextStore,
  createServerRegistry
} from "@async/framework/server";
```

`Loader` is the canonical loader factory. `AsyncLoader` remains as a
compatibility alias for older code.

`AsyncError`, `asyncErrorCodes`, `isAsyncError`, and `toAsyncDiagnostic` are
available from the browser, router, flow, and server entrypoints. See
[Errors & Diagnostics](#/reference/errors) for the stable code catalogue and
event-reporting contract.

## Related
- Guide: [Install & Load](#/docs/install)
- Symbol reference: [API Reference](#/reference/api)
- Contract: [09-packaging-and-delivery.md](../../specs/framework/09-packaging-and-delivery.md)
