# Composition Patterns

Async composition keeps ownership explicit. Default children, named regions,
scoped templates, presenter components, local outlets, and boundaries solve
different problems and should not collapse into one `children` escape hatch.

## Pattern Map

| Pattern | Use When | Avoid When |
| --- | --- | --- |
| Default children | The caller supplies content and the callee places it once. | The callee must pass row, state, or option data into the content. |
| Named regions | The caller fills fixed areas such as header, footer, actions, empty, or fallback. | The region needs callee-owned context values. |
| Scoped content templates | The callee owns context values and the caller owns markup. | Static placement or a reusable component prop is clearer. |
| Presenter component props | The caller chooses a reusable component that the callee renders with explicit props. | The callsite wants small inline markup. |
| Dynamic outlets | A local child component changes after mount and old child cleanup must run. | The content is static mount-time projection. |
| Partials and boundaries | Server, route, stream, or async work owns replacement. | Local component composition is enough. |

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

### L2

Nested JSX children lowering is represented in optimizer artifacts. Full source
emission is planned:

```tsx
<Card title="Status">
  <p>Ready</p>
</Card>
```

### Advanced OOS

Default children stream with the boundary that contains them. Give the content
its own `async:boundary` only when it needs independent server, route, stream,
or async replacement. Independent boundaries may commit out of source order;
same-boundary patches stay sequence-ordered. Streamed HTML is rescanned after
insertion, so `on:`, `signal:`, `class:`, `intersect:`, and component protocol
attributes activate normally.

## Named Regions

Named regions are fixed caller-owned fragments such as header, actions, empty,
fallback, media, sidebar, or toolbar. Region helper APIs are planned.

### L1

Planned:

```js
this.render(
  Card,
  {
    header: this.region(html`<h2>Status</h2>`),
    actions: this.region(html`<button type="button">Retry</button>`)
  },
  html`<p>Ready</p>`
);
```

### L2

Planned:

```tsx
<Card>
  <Card.Header>Status</Card.Header>
  <p>Ready</p>
  <Card.Actions>
    <button type="button">Retry</button>
  </Card.Actions>
</Card>
```

### Advanced OOS

A named region does not become an independent stream target by itself. It
commits with the owning component unless the region content contains its own
`async:boundary`. Separate region boundaries may commit independently; repeated
patches for the same boundary remain sequence-ordered and are rescanned after
HTML insertion.

## Scoped Content Templates

Scoped content templates handle caller-owned markup that needs callee-owned
context, such as `{ row, index }` for a list. Template helper APIs are planned.

### L1

Planned:

```js
this.render(List, {
  rows,
  item: this.template(({ row, index }) => html`
    <li>${index + 1}. ${row.label}</li>
  `)
});
```

### L2

Planned:

```tsx
<List rows={rows}>
  <List.Item let:row let:index>
    <li>{index + 1}. {row.label}</li>
  </List.Item>
</List>
```

### Advanced OOS

The template creates fragments; boundaries own out-of-order commit behavior. If
rows can stream independently, each rendered row needs a stable
`async:boundary`, such as `row:${row.id}`. Independent row boundaries may commit
out of source order, same-row patches stay sequence-ordered, and inserted row
HTML is rescanned for protocol attributes.

## Presenter Component Props

Presenter component props let the caller choose a component that the callee
renders with explicit props. This is useful for reusable rows, icons, empty
views, panels, or editors.

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

### L2

Component-valued prop source checks and lazy presenter policies are planned:

```tsx
<List rows={rows} Item={ProductRow} />
```

### Advanced OOS

The presenter prop chooses a component; it does not choose stream order. The
callee can wrap presenter instances in `async:boundary` elements when each item
may arrive independently. Independent presenter boundaries may commit out of
source order; patches for the same presenter boundary remain sequence-ordered.
Boundary swaps clean removed scopes before inserted presenter HTML is rescanned
for protocol attributes.

## Dynamic Outlets And Boundaries

Use outlets for local post-mount child replacement. Use partials and
boundaries when server, route, stream, or async work owns replacement.

### L1

Released local outlet:

```js
const pane = this.slot(activePane.value, () => ({ item: selected.value }));

return html`<section on:attach="${pane.attach}"></section>`;
```

Released boundary target:

```html
<section async:boundary="product"></section>
```

### L2

Outlet source syntax is planned. Boundary markup is protocol syntax:

```tsx
<>
  <Outlet component={activePane} item={selected} />
  <section async:boundary="product" />
</>
```

### Advanced OOS

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
| Function children | Scoped content templates |
| Render prop callbacks | Scoped content templates |
| Authored `children={...}` source props | Nested children or named regions |
| Child inspection | Named regions or scoped templates |
| Clone-style child mutation | Presenter component props |
| Positional children arrays | Named regions |
| Mixed outlet and children APIs | Outlets for replacement, children for projection |

### L1

Avoid callable default children:

```js
this.render(List, {}, function children(row) {
  return html`<li>${row.label}</li>`;
});
```

Use a planned scoped template instead:

```js
this.render(List, {
  rows,
  item: this.template(({ row }) => html`<li>${row.label}</li>`)
});
```

### L2

Avoid function children:

```tsx
<List>{(row) => <li>{row.label}</li>}</List>
```

Use planned scoped-template source:

```tsx
<List rows={rows}>
  <List.Item let:row>
    <li>{row.label}</li>
  </List.Item>
</List>
```

### Advanced OOS

Out-of-order streaming does not make ambiguous composition safer. Put
`async:boundary` on the rendered content that needs independent patches, but
choose the explicit composition primitive first. The boundary controls commit
order; the composition pattern controls ownership and scope. Independent
boundaries may commit out of source order, same-boundary patches remain
sequence-ordered, and inserted streamed HTML is rescanned for protocol
attributes after each patch.
