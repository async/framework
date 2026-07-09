# Vite & Hono

The Vite entry can run a Hono app as the local development server while the
browser stays on the no-build runtime (L1 Interpret; the build is L2 Bundle
delivery). Install the optional Hono dev packages in apps that use this
profile:

```bash
pnpm add hono
pnpm add -D vite@^8 @hono/vite-dev-server
```

```js
// vite.config.js
import { defineConfig } from "vite";
import { asyncFramework } from "@async/framework/vite";

export default defineConfig({
  plugins: [
    asyncFramework({
      server: {
        entry: "src/server.js"
      },
      client: {
        entry: "src/client.js",
        outDir: "public/static"
      }
    })
  ]
});
```

`asyncFramework(...)` declares needs, not layer numbers: entries declare
render targets (`server.entry` selects the server lane, `client.entry` the
browser build lane), and transforms are detected from imports — `.jsx`/`.tsx`
modules importing `@async/framework/jsx` opt into the JSX bootstrap (L4). The
legacy `layer` option only annotates the build report; it is scheduled for
replacement by the needs-based config in
[specs/framework/15-abstraction-layers.md](../../specs/framework/15-abstraction-layers.md),
so omit it.

During local development, run Vite:

```json
{
  "scripts": {
    "dev": "vite"
  }
}
```

`asyncFramework({ server })` composes `@hono/vite-dev-server`, serves the
default-exported Hono app, and leaves Hono's client reload injection enabled.
The Hono entry owns the HTML shell:

```js
// src/server.js
import { Hono } from "hono";

const app = new Hono();

app.get("/", (context) => {
  const clientScript = import.meta.env?.DEV ? "/src/client.js" : "/static/client.js";

  return context.html(`<!doctype html>
    <html>
      <body async:app>
        <button type="button" on:click="increment">
          Count: <span signal:text="count"></span>
        </button>
        <script type="module" src="${clientScript}"></script>
      </body>
    </html>`);
});

export default app;
```

The client entry stays ordinary no-build runtime code:

```js
// src/client.js
import {
  Async,
  createSignal
} from "@async/framework/browser";

Async.use({
  signal: {
    count: createSignal(0)
  },
  handler: {
    increment() {
      this.signals.update("count", (count) => count + 1);
    }
  }
});

Async.start({ root: document });
```

For production assets, build only the client bundle:

```json
{
  "scripts": {
    "build": "vite build --mode client"
  }
}
```

The client build emits into `public/static` by default. Vercel serves
`public/**` as static assets and runs the Hono app through its native Hono
support when the app is default-exported from an entry such as `src/server.js`.
There is no `target` option in this profile yet; production platform behavior
belongs to the host until Async adds an explicit build target contract.

See [`examples/vite-hono`](../../examples/vite-hono) for a local Hono app and
client build setup. See [`examples/vite-jsx-streaming`](../../examples/vite-jsx-streaming)
for the Vite JSX optimizer lane that hides bootstrap setup and plans the
stream runtime slice from Suspense and Reveal intent. Slice selection reports
`signals` and `events` as `available` today; `async-signals` and `stream` are
reported as `planned` until their runtime entrypoints ship, so streaming
boundaries are recorded but not yet activated by `@async/framework/runtime`.

## Related
- Guide: [Build Profile](#/build/profile)
- Example: [examples/vite-hono](../../examples/vite-hono)
- Contract: [09-packaging-and-delivery.md](../../specs/framework/09-packaging-and-delivery.md)
