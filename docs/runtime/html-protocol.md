# HTML Protocol

Async uses shorthand attributes as the author-facing syntax.

## Core attributes

| Attribute | Purpose |
| --- | --- |
| `async:container` | Marks a scannable app root |
| `async:boundary="route"` | Marks a replaceable boundary |
| `async:snapshot` | Holds serialized startup state |
| `async:component="Card"` | Mounts a registered component |
| `async:children` | Captures template children for a component |

## Signal bindings

```html
<h1 signal:text="product.title"></h1>
<input signal:value="product.quantity">
<button signal:attr:disabled="product.$loading">Save</button>
<input type="checkbox" signal:prop:checked="selected">
<article class:selected="selected"></article>
```

Use `signal:class` when a signal returns a string, object, or array of classes.

```html
<button signal:class="buttonClasses">Add</button>
```

## Event commands

`on:*` attributes run named handlers, server commands, or semicolon-separated command chains.

```html
<button on:click="cart.add">Add</button>
<form on:submit="preventDefault; server.products.save(productId, $form)">
  ...
</form>
```

## Intersection commands

```html
<section
  on:intersect="trackSection"
  intersect:threshold="0,0.25,0.5,0.75,1"
  intersect:root-margin="-20% 0px -55% 0px">
</section>
```

Use `on:visible` for a one-shot visibility lifecycle hook and `on:intersect` for continuous observation.
