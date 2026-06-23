# Welcome to Async

No virtual DOM. No hidden hydration. Plain HTML plus ESM for reactive apps.

## Quickstart

Install the package and start a root.

```bash
pnpm add @async/framework
```

> Async ships zero runtime work for a page until you start it.

## Next steps

- [Core Concepts](#/docs/core-concepts) explains the runtime pieces.
- [HTML Protocol](#/runtime/html-protocol) lists the author-facing attributes.
- [Router & Partials](#/runtime/router-partials) covers hash routing, route boundaries, and fragment swaps.
- [Server & Streaming](#/runtime/server-streaming) shows server calls and streamed boundary patches.

## Runtime shape

Use ordinary HTML with Async protocol attributes.

```html
<main async:container>
  <button type="button" on:click="decrement">-</button>
  <strong signal:text="count"></strong>
  <button type="button" on:click="increment">+</button>
</main>
<script type="module" src="./main.js"></script>
```

```js
import { Async, createSignal } from "@async/framework";

Async.use({
  signal: {
    count: createSignal(0)
  },
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    },
    decrement() {
      this.signals.update("count", (count) => count - 1);
    }
  }
});

Async.start({ root: document });
```

Async uses registries for signals, handlers, components, partials, routes, cache entries, and server calls. HTML attributes connect those registries to DOM behavior.

| Piece | Purpose |
| --- | --- |
| `Async.use(...)` | Register app declarations before or after startup |
| `Async.start(...)` | Scan a root, bind events, restore signals, and start the router |
| `signal:*` | Bind state to text, values, attributes, properties, and classes |
| `on:*` | Run delegated handlers or server commands |
| `async:boundary` | Mark a region that can be swapped or streamed |
