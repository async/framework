# Components

Components are scoped fragment functions. They return strings or `html`
templates; Loader inserts and scans the result. There is no virtual node
type and no rerender loop.

Declare the component host in HTML:

```html
<main async:container async:component="Toggle"></main>
```

```js
import { Async, component, html } from "@async/framework/browser";

const Toggle = component(function Toggle() {
  const selected = this.signal(false);
  const attach = this.handler("attach", function ({ element }) {
    element.dataset.attached = "true";
  });
  const visible = this.handler("visible", function ({ element }) {
    element.dataset.visible = "true";
  });

  return html`
    <button
      type="button"
      on:attach="${attach}"
      on:visible="${visible}"
      on:click="${this.handler(function () {
        selected.update((value) => !value);
      })}"
      class:selected="${selected}"
      signal:class="${["toggle", { active: selected }]}"
      signal:attr:aria-pressed="${selected}"
    >
      Toggle
    </button>
  `;
});

Async.use({ component: { Toggle } });
Async.start({ root: document, router: false });
```

Use `loader.attach(target, Component)` only when a named platform adapter
already owns a direct target element. Normal app feature code should prefer
`async:component` and registry-driven attachment.

Component helpers:

| Helper | Behavior |
| --- | --- |
| `this.signal(name, initial)` | Scoped named get-or-create signal |
| `this.signal(initial)` | Generated scoped local signal |
| `this.computed(name, fn)` | Scoped computed signal |
| `this.asyncSignal(name, fn)` | Scoped async signal |
| `this.effect(fn)` | Scoped effect with cleanup |
| `this.handler(name, fn)` | Scoped named handler registry entry |
| `this.handler(fn)` | Generated scoped handler registry entry |
| `this.render(Component, props, children?)` | Child fragment rendering with optional default children |
| `this.slot(Component, propsOrFn)` | Child component outlet using an `on:attach` target |
| `this.suspense(signalRef, views)` | Async boundary template helper |
| `this.on(event, fn)` | Fragment lifecycle fallback for `attach`, `visible`, and `destroy` |
| `this.onAttach(fn)` | Fragment attach lifecycle fallback |
| `this.onVisible(fn)` | Compatibility alias for `this.on("visible", fn)` |
| `this.on("intersect", options?, fn)` | Continuous intersection lifecycle for the attached component scope |
| `this.intersect(element, options?, fn)` | Component-owned continuous intersection observer for a direct element |

`this.suspense(...)` is sugar for Loader boundaries:
`asyncSignal + async:boundary + async:* templates`. It emits only templates. The
caller owns the boundary element, and the loader chooses the loading, ready, or
error template from the async signal status.

```js
const Product = component(function Product() {
  const product = this.asyncSignal("product", async function () {
    return this.server.products.get("sku-1");
  });

  return html`
    <article async:boundary="${product.id}">
      ${this.suspense(product, {
        loading() {
          return html`<p>Loading...</p>`;
        },
        ready(product) {
          return html`<h1 signal:text="${product.id}.title"></h1>`;
        },
        error(product) {
          return html`<p signal:text="${product.id}.$error.message"></p>`;
        }
      })}
    </article>
  `;
});
```

The shorthand form treats the callback as the ready template:

```js
this.suspense(product, (product) => html`
  <h1 signal:text="${product.id}.title"></h1>
`);
```

`this.suspense(...)` is not React Suspense. It does not throw promises,
hydrate, diff, rerender a component tree, or emit a wrapper element.

Default children are a scoped fragment owned by the framework. Pass them as the
third `this.render(...)` argument, then interpolate `children` in the child
component:

```js
const Card = component(function Card({ title, children }) {
  return html`
    <article>
      <h2>${title}</h2>
      ${children}
    </article>
  `;
});

const Page = component(function Page() {
  return html`
    ${this.render(Card, { title: "Status" }, html`
      <p>Ready</p>
    `)}
  `;
});
```

Children can also be lazy when the caller supplies a factory. The factory runs
only if the child component interpolates `children`, and any nested components
or handlers created while rendering the fragment are cleaned up with the
consuming component fragment:

```js
this.render(Card, { title: "Status" }, function children() {
  return html`<p>${this.render(Badge, { label: "Live" })}</p>`;
});
```

No-build HTML component hosts use an explicit inert template for default
children:

```html
<section async:component="Card">
  <template async:children>
    <p>Ready</p>
  </template>
</section>
```

The loader captures only a direct child `<template async:children>` before
attaching the registered component. Ordinary host content is not implicitly
captured, and the template content is inserted and scanned only if the
component interpolates `children`.

Do not pass `children` in the props object when also using the third argument.
Default children are consumed once by interpolation; use `this.slot(...)` for
post-attach replacement and use ordinary props when the child needs data from the
caller.

Component-scoped signals and handlers are unregistered when the attached
fragment is destroyed. `loader.swap(...)` cleans up old DOM bindings and attached
component fragments under the swapped boundary before inserting the new HTML.

Lifecycle fallbacks are scoped to the component fragment that registered them.
A component attached directly with `loader.attach(target, Component)` receives the
attach target. A child rendered through `this.render(Child)` receives its own
single element root when one exists. If the child returns text or multiple root
nodes, the fallback target is the nearest containing element. `this.onVisible`
and `this.on("intersect", ...)` observe the same scoped target.

Put component lifecycle on the component root element when there is one:

```js
const attach = this.handler("attach", function ({ element }) {
  element.dataset.attached = "true";
});
const visible = this.handler("visible", function ({ element }) {
  element.dataset.visible = "true";
});

return html`<article on:attach="${attach}" on:visible="${visible}">...</article>`;
```

If a component returns text or multiple root nodes, use the scoped fallback:

```js
this.on("attach", (target) => {
  target.dataset.attached = "true";
});

this.on("destroy", () => {
  // Clean up fragment-scoped resources.
});
```

`on:visible` is defined as a component lifecycle pseudo-event. It runs once when
the component root first becomes visible. Lifecycle events do not drive
component rerenders.

Use `on:intersect` when markup should receive continuous intersection updates
through a registered handler:

```html
<section
  on:intersect="trackSection"
  intersect:threshold="0,0.25,0.5,0.75,1"
  intersect:root-margin="-20% 0px -55% 0px"
>
  ...
</section>
```

The handler receives `element`, `entry`, `entries`, `observer`,
`isIntersecting`, `intersectionRatio`, and `unsupported`. Custom roots are not
selector-based; use `this.intersect(...)` with a direct root element when a
custom observer root is needed.

Use `this.on("intersect", ...)` when a component needs continuous visibility
state:

```js
const Card = component(function Card() {
  const visible = this.signal(false);

  this.on("intersect", { threshold: 0.5 }, ({ isIntersecting }) => {
    visible.set(isIntersecting);
  });

  return html`<article class:visible="${visible}">...</article>`;
});
```

Use `this.intersect(...)` with a direct element when a parent owns scroll-spy or
active-section state:

```js
const Section = component(function Section({ id, observeSection }) {
  const attach = this.handler("attach", function ({ element }) {
    return observeSection(id, element);
  });

  return html`<section on:attach="${attach}"><h2>${id}</h2></section>`;
});

const Page = component(function Page() {
  const active = this.signal("intro");
  const ratios = new Map();
  const options = {
    rootMargin: "-20% 0px -55% 0px",
    threshold: [0, 0.25, 0.5, 0.75, 1]
  };

  const observeSection = (id, element) => this.intersect(element, options, ({ entry }) => {
    ratios.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
    const best = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0];
    active.set(best?.[0] ?? id);
  });

  return html`
    <nav signal:text="${active}"></nav>
    ${this.render(Section, { id: "intro", observeSection })}
    ${this.render(Section, { id: "runtime", observeSection })}
  `;
});
```

## Related
- Guide: [HTML Protocol](#/runtime/html-protocol)
- Streaming: [Streaming & Boundaries](#/runtime/streaming)
- Contract: [05-component-system.md](../../specs/framework/05-component-system.md)
- Composition contract: [12-composition-patterns.md](../../specs/framework/12-composition-patterns.md)
