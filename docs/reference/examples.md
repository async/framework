# Examples

The repository includes small examples for the main runtime surfaces.

## Static examples

| Example | Covers |
| --- | --- |
| `examples/counter` | Signal text binding and delegated handlers |
| `examples/product` | Async signal loading, ready, and error boundaries |
| `examples/components` | Scoped fragment components and lifecycle hooks |
| `examples/streaming` | Boundary swaps with rescanned handlers |
| `examples/server-call` | Command events calling server functions |
| `examples/hateoas-actions` | Hono-rendered HATEOAS links and forms enhanced into partial swaps |
| `examples/router` | CSR first render and local route boundary swaps |
| `examples/partials` | Server-rendered partial fragments |
| `examples/cache` | Browser and server cache declarations |
| `examples/ssr` | Server render output and browser activation snapshot |
| `examples/vite-hono` | Hono-backed Vite dev server plus client asset build |
| `examples/vite-jsx-streaming` | JSX optimizer bootstrap with stream runtime slice selection |
| `examples/size` | Scenario-size fixtures for runtime slices |

## Verify examples

```bash
pnpm run examples:check
```

The examples test checks that each static example has the expected HTML and JavaScript entrypoints.
