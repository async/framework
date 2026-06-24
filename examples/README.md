# Async Framework Examples

These examples run from the source checkout. Most examples are no-build static
HTML plus ESM modules that import from `../../src/index.js`. Vite examples have
their own package files and run from their example directories.

## Static Examples

From the repo root:

```bash
python3 -m http.server 4173
```

Then open the example URL, such as
`http://127.0.0.1:4173/examples/counter/`.

## Example Index

| Example | Shows | Start |
| --- | --- | --- |
| [counter](./counter/README.md) | Signal text binding and delegated handlers | `http://127.0.0.1:4173/examples/counter/` |
| [product](./product/README.md) | Async signal loading, ready, and error boundaries | `http://127.0.0.1:4173/examples/product/` |
| [components](./components/README.md) | Scoped fragment components and lifecycle hooks | `http://127.0.0.1:4173/examples/components/` |
| [streaming](./streaming/README.md) | Boundary swaps with rescanned handlers | `http://127.0.0.1:4173/examples/streaming/` |
| [server-call](./server-call/README.md) | Command events calling server functions | `http://127.0.0.1:4173/examples/server-call/` |
| [router](./router/README.md) | CSR first render and local route boundary swaps | `http://127.0.0.1:4173/examples/router/` |
| [partials](./partials/README.md) | Server-rendered partial fragments | `http://127.0.0.1:4173/examples/partials/` |
| [cache](./cache/README.md) | Browser and server cache declarations | `http://127.0.0.1:4173/examples/cache/` |
| [ssr](./ssr/README.md) | Server render output and browser activation snapshot | `http://127.0.0.1:4173/examples/ssr/` |
| [vite-hono](./vite-hono/README.md) | Hono-backed Vite dev server plus client asset build | `pnpm run dev` |
| [vite-jsx-streaming](./vite-jsx-streaming/README.md) | JSX optimizer bootstrap with stream runtime slice selection | `pnpm run dev` |
| [size](./size/README.md) | Scenario-size fixtures for bundle and runtime slices | `pnpm run scenario:size:check` |

## Verification

```bash
pnpm run examples:check
pnpm run registry:lint
pnpm run scenario:size:check
```
