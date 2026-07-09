# SSR & Activation

SSR uses the same registry and HTML protocol as browser startup. The server renders HTML and snapshots; the browser activates the already-rendered document without hydration, diffing, or an implicit fetch.

## Build-Step Runtime

The no-build layers keep working without a build step. A build step can
optimize the same runtime by emitting SSR HTML plus compact registry
descriptors. The browser can
start in the document head, apply snapshots, and wait for a root to appear:

```html
<script type="importmap">
{
  "imports": {
    "@async/framework": "https://unpkg.com/@async/framework@latest/browser.js"
  }
}
</script>

<script type="application/json" async:snapshot>
{
  "signal": {
    "productId": "sku-1"
  },
  "handler": {
    "cart.add": { "url": "cart.add.js" }
  },
  "component": {
    "ProductCard": { "url": "ProductCard.js" }
  },
  "asyncSignal": {
    "product.load": { "url": "product.load.js" }
  }
}
</script>

<script type="module">
  import {
    Async,
    defineAsyncContainerElement,
    defineAsyncSuspenseElement,
    readSnapshot
  } from "@async/framework";

  Async.start({
    snapshot: readSnapshot(document),
    registryAssets: { baseUrl: "_async" }
  });

  defineAsyncContainerElement();
  defineAsyncSuspenseElement();
</script>
```

`Async.start()` defaults to rootless browser startup. It creates registries,
applies snapshots, and prepares the scheduler/server proxy context without
scanning DOM. Attach a root later with `Async.attachRoot(root)` or by using
`<async-container>`:

```html
<async-container>
  <button type="button" on:click="cart.add">Add</button>
</async-container>
```

Descriptor URLs are relative to a type folder under `registryAssets.baseUrl`.
The default is:

```js
{
  baseUrl: "_async",
  paths: {
    component: "component",
    handler: "handler",
    asyncSignal: "asyncSignal",
    partial: "partial",
    route: "route"
  }
}
```

So this descriptor:

```json
{ "url": "ProductCard.js#ProductCard" }
```

resolves as:

```txt
/_async/component/ProductCard.js#ProductCard
```

If `#export` is omitted, Async tries the registry id leaf, then the file
basename, then `default`.

For declarative async boundaries, use `<async-suspense>` or keep using
`this.suspense(...)` inside components:

```html
<async-suspense for="product.load">
  <template loading>Loading...</template>
  <template ready>
    <h1 signal:text="product.load.title"></h1>
  </template>
  <template error>
    <p signal:text="product.load.$error.message"></p>
  </template>
</async-suspense>
```

The compiler layers can hide `createBoundaryReceiver(...)` setup, but streaming
is still explicit boundary patches: boundary id, sequence number, HTML, signal
patches, and browser-cache patches. Async does not ship a component resume graph.

## SSR Flow

SSR uses related app definitions: a server runtime with server functions,
server cache, partials, and route rendering; and a browser runtime with DOM
handlers, browser cache, signals, and usually a server proxy.

```js
const serverRuntime = createApp(serverApp, {
  target: "server",
  request
});

const response = await serverRuntime.render("/products/123");
```

`runtime.render(url)` returns:

```js
{
  html,
  status,
  signals,
  cache: {
    browser: {}
  }
}
```

The returned HTML includes a route boundary plus a JSON snapshot:

```html
<section async:boundary="route">
  <!-- server-rendered route partial -->
</section>
<script type="application/json" async:snapshot>{}</script>
```

Browser activation scans the existing HTML and attaches events. It does not
hydrate, diff, patch, rerender, or fetch route fragments:

```js
createApp(browserApp, {
  root: document
}).start();
```

If browser handlers or async signals need server commands, pass a server proxy
with an explicit transport:

```js
createApp(browserApp, {
  root: document,
  server: createServerProxy({
    endpoint: "/__async/server",
    transport: httpTransport
  })
}).start();
```

If an `async:snapshot` script is present under the root or document,
`createApp(...)` reads it automatically. You can also inspect it directly:

```js
const snapshot = readSnapshot(document);
```

## Related
- Guide: [Server Calls & Cache](#/runtime/server-calls)
- Streaming: [Streaming & Boundaries](#/runtime/streaming)
- Contract: [08-resume-and-streaming.md](../../specs/framework/08-resume-and-streaming.md)
