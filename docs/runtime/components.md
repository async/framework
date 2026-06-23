# Components

Components render scoped fragments. They can own local signals, handlers, effects, lifecycle hooks, and child content.

## Define a component

```js
import { Async, component, html } from "@async/framework";

const Counter = component(function Counter() {
  const count = this.signal(0);
  const increment = this.handler(function () {
    count.update((value) => value + 1);
  });

  return html`
    <button type="button" on:click="${increment}">
      Count <span signal:text="${count}"></span>
    </button>
  `;
});

Async.use({
  component: { Counter }
});
```

## Mount from HTML

```html
<section async:component="Counter"></section>
```

## Lifecycle hooks

Use `on:attach` for setup, `on:visible` for one-shot visibility, and `on:intersect` for continuous observation.

```js
return html`<article on:attach="${attach}" on:visible="${visible}">...</article>`;
```

## Children

No-build components can receive explicit template children from a direct child template.

```html
<section async:component="Card">
  <template async:children>
    <h2>Product</h2>
  </template>
</section>
```

The loader captures the children template before the component mounts, then scans inserted content after render.
