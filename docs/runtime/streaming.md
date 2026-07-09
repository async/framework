# Streaming & Boundaries

Out-of-order HTML can target a boundary and keep delegated handlers working:

```js
loader.swap(
  "product",
  `
    <article>
      <h1 signal:text="product.title"></h1>
      <button type="button" on:click="selectProduct">Select</button>
    </article>
  `
);
```

`swap(boundaryId, fragmentOrTemplate, options?)` replaces the boundary contents
and rescans inserted content by default. For large stable shells that refresh
from local state, pass `strategy: "morph"` to preserve matching DOM nodes while
updating changed text, attributes, and children.

Use config-first `swap(...)` for the advanced variants:

```js
loader.swap({ boundary: "view", html });
loader.swap({ type: "ifChanged", boundary: "view", html: renderView });
loader.swap({ type: "many", updates: { filters, timeline }, scan: "once" });
loader.swap({ type: "many", ifChanged: true, updates, scan: "once" });
```

`type: "ifChanged"` skips cleanup, DOM replacement, and rescanning when the
next rendered HTML matches the previous swap for that boundary. The render
function form receives `{ boundary, boundaryId, loader, signals, handlers,
server, router, cache, scheduler }`.

`type: "many"` applies several boundary replacements before activation.
`updates` can be an object, `Map`, or iterable of `[boundaryId, html]` entries.
Each entry may also be `{ html, strategy, attach }` for per-boundary morph or
attach behavior. Pass `ifChanged: true` to skip unchanged entries inside the
batch. `scan: "once"` defers scanning until every update has been inserted, which
avoids interleaving cleanup/scan work across multiple same-tick refreshes.

Use `loader.defineRefreshPlan(...)` and `loader.refresh(scope)` for declarative
scope-to-boundary orchestration in signal-router dashboards:

```js
loader.defineRefreshPlan({
  timeline: {
    boundaries: ["view-timeline"],
    render({ signals }) {
      return {
        "view-timeline": { html: buildTimeline(signals), strategy: "morph" }
      };
    }
  },
  chrome: ["app-chrome", "view-filters"]
});

loader.refresh("timeline");
loader.refresh("chrome", { "app-chrome": chromeHtml, "view-filters": filtersHtml });
```

Use `type: "bind"` when local signal state owns a large region. The render
function runs once, tracks signal reads made while rendering, and schedules one
unchanged-aware refresh for same-tick signal changes. Pass `deps: [...]` to
subscribe only to explicit signal paths instead of every read inside `render`.
It returns a cleanup function.

```js
const stopTimeline = loader.swap({
  type: "bind",
  boundary: "view-timeline",
  deps: ["demoState.settings.rangeMode"],
  render({ signals }) {
    const view = buildTimelineView(signals.get("timeline.filters"));
    return html`<section>${view.items.map(renderTimelineItem)}</section>`;
  },
  strategy: "morph"
});
```

The `strategy` option controls how the boundary changes:

| Option | Behavior |
| --- | --- |
| `replace` | Default. Clean up all existing children, replace them, and activate the inserted subtree. |
| `morph` | Reconcile matching children by tag and stable identity, preserving unchanged nodes and cleaning up removed or replaced nodes. |

The `attach` option applies to morph swaps:

| Option | Behavior |
| --- | --- |
| `preserve` | Default. Preserved `on:attach` nodes keep their attach handlers across morph. |
| `rebind` | Preserved `on:attach` nodes rerun attach handlers after morph. |

Morph matching uses `async:key`, `data-key`, or `id` when present. Without a
stable identity it falls back to sibling order and tag name.

The `scan` option controls activation:

| Option | Behavior |
| --- | --- |
| `auto` | Default. For replacement, scan inserted roots. For morphing, scan changed or inserted roots. |
| `full` | Scan the boundary element and its subtree. |
| `none` | Do not scan inserted content; call `loader.scan(...)` later if needed. |

`type: "many"` also accepts `scan: "once"` as a batched `auto` scan after all
updates are applied.

When boundary patches can arrive independently, use `createBoundaryReceiver`.
It keeps per-boundary sequence state, applies signal/cache effects before the
HTML swap, flushes scheduled bindings, and ignores stale child patches after a
parent scope is destroyed.

```js
import { createBoundaryReceiver } from "@async/framework/browser";

const receiver = createBoundaryReceiver({
  loader: runtime.loader,
  signals: runtime.signals,
  cache: runtime.browser.cache,
  scheduler: runtime.scheduler,
  router: runtime.router
});

await receiver.apply({
  boundary: "product",
  seq: 1,
  signals: {
    product: { title: "Keyboard" }
  },
  cache: {
    browser: {
      "product:sku-1": { title: "Keyboard" }
    }
  },
  html: `
    <article>
      <h1 signal:text="product.title"></h1>
      <button type="button" on:click="server.cart.add(productId)">Add</button>
    </article>
  `
});
```

Sequence numbers are tracked per boundary: `hero` patch `10` can apply before
`reviews` patch `2`, while a later `hero` patch `9` is ignored. The receiver
does not add transport management, a transaction log, hydration, or component
rerendering.

## Related
- Guide: [Server Calls & Cache](#/runtime/server-calls)
- Router boundaries: [Router & Partials](#/runtime/router-partials)
- Contract: [08-resume-and-streaming.md](../../specs/framework/08-resume-and-streaming.md)
