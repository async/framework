# Signals

Signals are the state boundary for Async apps. They drive DOM bindings, handlers, async state, server effects, and router state.

## Create state

```js
import { Async, createSignal } from "@async/framework";

Async.use({
  signal: {
    count: createSignal(0)
  }
});
```

## Update state

Handlers receive a context with `this.signals`.

```js
Async.use({
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  }
});
```

## Bind state to HTML

```html
<strong signal:text="count"></strong>
<button signal:attr:disabled="saving">Save</button>
<article class:selected="selected"></article>
```

## Async signals

Async signals track status, loading state, errors, versioning, and cancellation.

```js
Async.use({
  asyncSignal: {
    async product({ id }) {
      return this.server.products.get(id);
    }
  }
});
```

Async signal metadata is available through paths such as `product.$loading`, `product.$error`, and `product.$status`.
