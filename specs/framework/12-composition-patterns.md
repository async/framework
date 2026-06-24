# Composition Patterns

Async composition keeps ownership explicit. Default children, component-valued
props, slots, and boundaries solve different problems and should not collapse
into one `children` escape hatch.

## Pattern Map

| Pattern | Use When | Avoid When |
| --- | --- | --- |
| Default children | The caller supplies content and the callee places it once. | The callee must pass row, state, or option data into the content. |
| Component-valued props | The caller chooses reusable markup and the callee renders it with explicit props. | The callsite wants one-off static projection. |
| Slots | A local child component changes after mount and old child cleanup must run. | The content is static mount-time projection. |
| Partials and boundaries | Server, route, stream, or async work owns replacement. | Local component composition is enough. |

Named regions, scoped templates, and source-level outlets are not current
framework primitives. Current specs should keep those exact API shapes outside
the current contract.

## Default Children

Default children are framework-owned fragments consumed by interpolation. They
are projection, not callback props.

### L1

Released:

```js
this.render(Card, { title: "Status" }, html`<p>Ready</p>`);
```

No-build component hosts can pass default children with an explicit template:

```html
<section async:component="Card">
  <template async:children>
    <p>Ready</p>
  </template>
</section>
```

### L1.5

Default children stream with the boundary that contains them. Give the content
its own `async:boundary` only when it needs independent server, route, stream,
or async replacement. Independent boundaries may commit out of source order;
same-boundary patches stay sequence-ordered. Streamed HTML is rescanned after
insertion, so `on:`, `signal:`, `class:`, `intersect:`, and component protocol
attributes activate normally.

## Component-Valued Props

Component-valued props let the caller choose a component that the callee renders
with explicit props. This is useful for reusable rows, icons, empty views,
panels, or editors.

### L1

Released through ordinary component-valued props:

```js
const List = component(function List({ rows, Item }) {
  return html`
    <ul>
      ${rows.map((row, index) => this.render(Item, { row, index }))}
    </ul>
  `;
});

this.render(List, { rows, Item: ProductRow });
```

The callee owns when each child component is rendered. The caller owns the
component implementation and receives explicit props from the callee.

### L1.5

The presenter prop chooses a component; it does not choose stream order. The
callee can wrap presenter instances in `async:boundary` elements when each item
may arrive independently. Independent presenter boundaries may commit out of
source order; patches for the same presenter boundary remain sequence-ordered.
Boundary swaps clean removed scopes before inserted presenter HTML is rescanned
for protocol attributes.

## Slots And Boundaries

Use `this.slot(...)` for local post-mount child replacement. Use partials and
boundaries when server, route, stream, or async work owns replacement.

### L1

Released local slot:

```js
const pane = this.slot(activePane.value, () => ({ item: selected.value }));

return html`<section on:attach="${pane.attach}"></section>`;
```

Released boundary target:

```html
<section async:boundary="product"></section>
```

### L1.5

`this.slot(...)` is local replacement owned by the current component.
`async:boundary` is the stream target. Boundary patches can apply signal,
cache, HTML, redirect, or error effects. Independent boundaries may commit out
of source order; same-boundary patches are serialized by sequence number.
Boundary swaps clean removed scopes before inserted HTML is scanned.

## Anti-Patterns

Avoid patterns that hide ownership or turn default children into a general
execution channel.

| Avoid | Use Instead |
| --- | --- |
| Function children | Component-valued props. |
| Render prop callbacks | Component-valued props with explicit props. |
| Authored `children={...}` source props | Nested children or `<template async:children>`. |
| Child inspection | Explicit props or component-valued props. |
| Clone-style child mutation | Component-valued props. |
| Positional children arrays | Explicit prop names. |
| Mixed slot and children APIs | Slots for replacement, children for projection. |

### L1

Avoid callable default children:

```js
this.render(List, {}, function children(row) {
  return html`<li>${row.label}</li>`;
});
```

Use an explicit component-valued prop instead:

```js
const Row = component(function Row({ row }) {
  return html`<li>${row.label}</li>`;
});

this.render(List, { rows, Item: Row });
```

### L1.5

Out-of-order streaming does not make ambiguous composition safer. Put
`async:boundary` on the rendered content that needs independent patches, but
choose the explicit composition primitive first. The boundary controls commit
order; the composition pattern controls ownership and scope. Independent
boundaries may commit out of source order, same-boundary patches remain
sequence-ordered, and inserted streamed HTML is rescanned for protocol
attributes after each patch.
