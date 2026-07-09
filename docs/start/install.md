# Install & Load

```bash
pnpm add @async/framework
```

The package is ESM-only and supports Node.js 24 and newer for tests, examples,
and package lifecycle tooling. Browser consumers import ESM directly.

## CDN

The package ships browser CDN artifacts for UNPKG and can be loaded without a
build step. Use `@latest` for quick prototypes, and pin an exact version in
production:

| File | Format | Use |
| --- | --- | --- |
| `browser.js` | ESM | Readable browser module bundle |
| `browser.min.js` | ESM | Compact browser module bundle |
| `browser.umd.js` | UMD | Readable script-tag/CommonJS-style bundle |
| `browser.umd.min.js` | UMD | Compact script-tag/CommonJS-style bundle and default CDN file |
| `browser.ts` | Bundled browser TypeScript source | TS-aware runtimes and compiler-layer tooling |
| `browser.d.ts` | Type declarations | TypeScript declarations for the browser API |
| `server.js` | ESM | Server-capable Node.js bundle |
| `framework.ts` | Bundled server-capable TypeScript source | TS-aware runtimes and compiler-layer tooling |
| `framework.d.ts` | Type declarations | TypeScript declarations for the server-capable API |

```html
<main async:container>
  <button type="button" on:click="increment">+</button>
  <strong signal:text="count"></strong>
</main>

<script type="module">
  import {
    Async,
    createSignal
  } from "https://unpkg.com/@async/framework@latest/browser.js";

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
</script>
```

For a plain script tag, use the UMD bundle. In this UMD-only global form,
`globalThis.Async` is the app hub plus the exported helper functions, with
`globalThis.AsyncFramework` kept as an alias. Lower-level bootloader code can
call `Async.Loader(...)` directly.

```html
<script src="https://unpkg.com/@async/framework@latest/browser.umd.min.js"></script>
<script>
  Async.use({
    signal: {
      count: Async.createSignal(0)
    },
    handler: {
      increment() {
        this.signals.update("count", (count) => count + 1);
      }
    }
  });

  Async.start({ root: document });
</script>
```

You can also use an import map so app code imports `@async/framework` by name:

```html
<script type="importmap">
{
  "imports": {
    "@async/framework": "https://unpkg.com/@async/framework@latest/browser.js"
  }
}
</script>

<script type="module">
  import {
    Async,
    createSignal
  } from "@async/framework";

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
</script>
```

## Related
- Guide: [Getting Started](#/docs/getting-started)
- Build guide: [Vite & Hono](#/build/vite-hono)
- Contract: [09-packaging-and-delivery.md](../../specs/framework/09-packaging-and-delivery.md)
