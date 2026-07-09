# HTML Protocol

Async uses shorthand attributes as the author-facing syntax.

## Attributes

Loader scans regular HTML attributes:

| Attribute | Behavior |
| --- | --- |
| `async:container` | Marks a scannable app root |
| `on:click="selectProduct"` | Delegated command event |
| `on:submit="preventDefault; save"` | Sequential command chain |
| `on:click="server.cart.add(productId)"` | Server command with signal args |
| `on:attach="setup"` | Component root attach lifecycle pseudo-event |
| `on:visible="trackView"` | Component root visible lifecycle pseudo-event |
| `on:intersect="trackSection"` | Continuous intersection lifecycle pseudo-event |
| `intersect:threshold="0,0.5,1"` | Intersection threshold option for `on:intersect` |
| `intersect:root-margin="-20% 0px -55% 0px"` | Intersection root margin option for `on:intersect` |
| `intersect:once="true"` | Disconnect `on:intersect` after the first intersecting entry |
| `signal:text="product.title"` | Text binding |
| `signal:value="productId"` | Form value binding with writeback |
| `signal:attr:disabled="product.$loading"` | Attribute binding |
| `signal:prop:checked="selected"` | DOM property binding |
| `class:selected="selected"` | Class toggle from a signal path |
| `signal:class="buttonClasses"` | Class set from a signal value: string, object, or array |
| `async:boundary="product"` | Async or streamed replacement boundary |
| `async:loading="product"` | Boundary loading template |
| `async:ready="product"` | Boundary ready template |
| `async:error="product"` | Boundary error template |

```html
<section async:boundary="product">
  <template async:loading="product">
    <p>Loading...</p>
  </template>
  <template async:ready="product">
    <h1 signal:text="product.title"></h1>
  </template>
  <template async:error="product">
    <p signal:text="product.$error.message"></p>
  </template>
</section>
```

The default prefixes are `async:`, `signal:`, and `on:`. You can switch to
data attributes when a host needs that shape:

```js
Async.start({
  root: document,
  attributes: {
    async: "data-async-",
    class: "data-class-",
    intersect: "data-intersect-",
    signal: "data-signal-",
    on: "data-on-"
  }
});
```

That maps to `data-async-container`, `data-on-click="save"`,
`data-signal-text="product.title"`, `data-class-selected="selected"`, and
`data-intersect-threshold="0.5"`.

Inside `html` templates, signal refs can be passed directly to binding
attributes:

```js
const title = this.signal("Keyboard");
const disabled = this.signal(false);
const checked = this.signal(true);

return html`
  <h1 signal:text="${title}"></h1>
  <button signal:attr:disabled="${disabled}">Save</button>
  <input type="checkbox" signal:prop:checked="${checked}">
`;
```

Use `signal:value` for form value binding with writeback. Use `signal:prop:*`
when you only need one-way DOM property updates.

Named class toggles use their own top-level namespace:

```html
<button
  class="button"
  class:selected="selected"
>
  Add
</button>
```

Aggregate class binding uses `signal:class`. It reads the current signal value
and accepts strings, objects, and arrays:

```js
Async.use({
  signal: {
    buttonClasses: createSignal([
      "button-primary",
      { selected: true, disabled: false },
      ["compact"]
    ])
  }
});
```

```html
<button signal:class="buttonClasses">Add</button>
```

Inside `html` templates, `signal:class` can also receive objects or arrays
directly. Signal refs inside the object or array are tracked:

```js
const selected = this.signal("selected", false);
const tone = this.signal("tone", "primary");

return html`
  <article signal:class="${["card", tone, { selected }]}"}>
    ...
  </article>
`;
```

For component-local state that does not need a stable public id, omit the name.
The signal is still registered under the component scope:

```js
const selected = this.signal(false);
const tone = this.signal("primary");

return html`
  <article signal:class="${["card", selected, tone]}">
    ...
  </article>
`;
```

`value="${signalRef}"` in an `html` template is equivalent to adding
`signal:value` for that signal. It writes back on input/change:

```js
const productId = this.signal("productId", "sku-1");

return html`<input value="${productId}">`;
```

`signal:class:selected="selected"` remains supported as a compatibility alias,
but new examples should use `class:selected`. The parser-safe top-level
aggregate form `class:="buttonClasses"` also remains supported.

## Command Events

`on:*` works with any native DOM event name. `on:attach` and `on:visible` are
reserved component lifecycle pseudo-events with cleanup support. `on:mount` was
removed; stale markup warns and does not run.
When an `on:attach` handler installs listeners, observers, timers, or DOM
helpers, return a cleanup function. Boundary swaps destroy the old subtree and
run returned cleanup functions before inserting the next fragment.

Command chains use semicolons and are awaited sequentially:

```html
<form on:submit="preventDefault; server.products.save(productId, $form)">
  <input name="title">
  <button>Save</button>
</form>
```

Plain commands resolve through the handler registry. Built-ins are registered by
default:

```txt
prevent
preventDefault
stopPropagation
stopImmediatePropagation
```

`server.<id>(...)` resolves through the server registry or client proxy. Bare
arguments read signals. `$*` arguments read event locals:

| Argument | Value |
| --- | --- |
| `productId` | `signals.get("productId")` |
| `cart.quantity` | `signals.get("cart.quantity")` |
| `$value` | Current element value |
| `$checked` | Current element checked state |
| `$form` | Current form as a plain object |
| `$dataset` | Current element dataset as a plain object |
| `$event` | Raw DOM event, client-only |
| `$el` | Current element, client-only |

`$event` and `$el` are intentionally not serializable and cannot be passed to
`server.*(...)` commands.

Inline commands are not JavaScript. There is no `eval`, assignment, branching,
arithmetic, or inline `await`. Complex logic belongs in a registered handler:

```js
handlers.register("addToCart", async function () {
  const productId = this.signals.get("productId");
  const result = await this.server.cart.add(productId);
  this.signals.set("cart", result.cart);
});
```

## Related
- Guide: [Runtime Overview](#/runtime/overview)
- Signals: [Signals & Async Signals](#/runtime/signals)
- Contract: [04-dom-protocol.md](../../specs/framework/04-dom-protocol.md)
