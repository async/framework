# Router & Partials

Routes map URL patterns to partial IDs. Partials return HTML fragments or response envelopes that can update signals, cache entries, boundaries, and redirects.

## Register routes

```js
import {
  Async,
  defineRoute,
  html
} from "@async/framework";

Async.use({
  partial: {
    home() {
      return html`<h1>Home</h1>`;
    },
    "product.page"({ id }) {
      return html`<h1>Product ${id}</h1>`;
    }
  },
  route: {
    "/": defineRoute("home"),
    "/products/:id": defineRoute("product.page")
  }
});
```

## Start the router

```html
<main async:container>
  <nav>
    <a href="/">Home</a>
    <a href="/products/sku-1">Product</a>
  </nav>
  <section async:boundary="route"></section>
</main>
```

```js
Async.start({
  mode: "csr",
  boundary: "route",
  root: document
});
```

## Hash routing

Static hosts can use hash routes so every page loads through one `index.html`.

```js
Async.start({
  mode: "csr",
  urlMode: "hash",
  boundary: "route",
  root: document
});
```

With `urlMode: "hash"`, `#/docs/getting-started` is matched as `/docs/getting-started`. Plain section anchors such as `#quickstart` remain native page jumps.

## Router state

Router state lives under `router.*` signals:

```txt
router.url
router.path
router.params
router.query
router.route
router.pending
router.error
```

## Modes

| Mode | Initial route | Later navigation |
| --- | --- | --- |
| `csr` | Client renders into an empty route boundary | Client renders and swaps |
| `spa` | Existing route HTML may already be present | Client renders and swaps |
| `ssr` | Server-rendered document activates | Browser navigation stays native |
| `mpa` | Any document source | Browser navigation stays native |
