# Server & Streaming

Server functions and streamed patches share the same response envelope shape: values, signal patches, cache patches, boundary HTML, redirects, and errors.

## Server commands

```js
Async.use({
  server: {
    async "cart.add"(productId) {
      return {
        value: { ok: true },
        signals: {
          "cart.count": 1
        }
      };
    }
  }
});
```

```html
<button type="button" on:click="server.cart.add(productId)">
  Add
</button>
```

## Server proxy

Browser code can call server namespaces through a transport.

```js
const server = createServerProxy({
  endpoint: "/__async/server",
  transport,
  signals,
  loader,
  router
});

await server.cart.add("sku-1", 2);
```

## Boundary patches

A response can replace a boundary and apply signal changes before or after the swap.

```js
return {
  boundary: "product",
  html: "<h1>Loaded product</h1>",
  signals: {
    "product.ready": true
  }
};
```

## Streaming

Stream patches target named boundaries and carry sequence data so stale patches do not overwrite newer content.

```html
<section async:boundary="product">
  <template async:loading="product">Loading...</template>
  <template async:ready="product"></template>
  <template async:error="product"></template>
</section>
```

Use route boundaries for page-level swaps and smaller boundaries for independent server or stream regions.
