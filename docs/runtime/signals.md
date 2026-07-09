# Signals & Async Signals

Signals are the state boundary for Async apps. They drive DOM bindings, handlers, async state, server effects, router state, and scheduled DOM work.

## Signal Registry

```js
const signals = createSignalRegistry();

signals.register("count", createSignal(0));
signals.register("products", createSignal([]));

signals.get("count");
signals.set("count", 1);
signals.update("count", (count) => count + 1);
signals.subscribe("count", (count) => console.log(count));
signals.ref("count").value;
signals.unregister("count");
```

Initializer maps are supported:

```js
const signals = createSignalRegistry({
  count: createSignal(0),
  products: createSignal([])
});
```

Nested paths read through the first registered signal id:

```js
signals.register("product", createSignal({ title: "Keyboard" }));
signals.get("product.title");
signals.set("product.title", "Headphones");
```

`signal(...)` remains a compatibility alias for `createSignal(...)`.

## Scheduler

The scheduler is the runtime ordering engine behind bindings, SSR activation,
and streaming. Signal writes are still synchronous:

```js
signals.set("count", 3);
signals.get("count");
// 3
```

DOM bindings, component lifecycle callbacks, component effects, and async signal
refreshes are scheduled through deterministic phases:

```txt
binding -> lifecycle -> effect -> async -> post
```

Browser runtimes use a microtask scheduler by default. Server runtimes use a
manual scheduler and drain it during `runtime.render(...)`.

```js
import {
  createScheduler
} from "@async/framework";

const scheduler = createScheduler({
  strategy: "manual"
});

const runtime = Async.start({
  root: document,
  scheduler
});

signals.set("count", 1);
await scheduler.flush();
```

Most apps do not need to call the scheduler directly. It is exposed for tests,
custom runtimes, streaming receivers, and higher layers that need explicit flush
boundaries.

## Async Signals

Async signals add loading state, error state, versions, refresh, and cancel to a
normal signal value.

```js
const signals = createSignalRegistry({
  productId: createSignal("sku-1")
});

const product = signals.asyncSignal("product", async function () {
  const id = this.signals.get("productId");
  const response = await fetch(`/api/products/${id}`, {
    signal: this.abort
  });

  return response.json();
});
```

The async function context includes:

| Field | Purpose |
| --- | --- |
| `this.signals` | The signal registry |
| `this.id` | Current async signal id |
| `this.version` | Run version |
| `this.abort` | Native `AbortSignal` with non-enumerable `cancel(reason?)` |
| `this.scheduler` | Current runtime scheduler |
| `this.refresh()` | Start a new run |

`this.abort` can be passed directly to `fetch` or to `delay`:

```js
await delay(250, this.abort);
```

If a dependency read through `this.signals.get(...)` changes, the async signal
reruns and the previous run is aborted.

Dependency reads are captured while the async signal function starts running.
Read signal dependencies before the first `await`; reads that happen later are
ordinary reads and do not create refresh subscriptions.

## Related
- Guide: [Runtime Overview](#/runtime/overview)
- Protocol: [HTML Protocol](#/runtime/html-protocol)
- Contract: [03-reactivity-system.md](../../specs/framework/03-reactivity-system.md)
- Scheduler contract: [13-scheduler-and-commit-phase.md](../../specs/framework/13-scheduler-and-commit-phase.md)
