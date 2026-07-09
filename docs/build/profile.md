# Build Profile

The build-required profile covers the compiler rungs of the abstraction ladder: L4 Transform (JSX, TypeScript) and L6 Reorder (optimizer reports, framework plans, runtime slices). It preserves the no-compiler runtime contracts (rungs L0-L3, L5) — see the [Layers guide](#/docs/layers).

## JSX entrypoints

The package exposes profile-specific JSX entrypoints for runtime and buildtime authoring. Set the automatic JSX import source to the profile you author against:

```json
{
  "jsxImportSource": "@async/framework/jsx/runtime"
}
```

or

```json
{
  "jsxImportSource": "@async/framework/jsx/buildtime"
}
```

The runtime profile accepts protocol props (`on:*`, `signal:*`, `class:*`) and rejects JSX-native event props. The buildtime profile accepts JSX-native props (`onClick`, `value`, ...) and rejects protocol props.

`@async/framework/jsx` also works as an import source — its `jsx-runtime` and `jsx-dev-runtime` subpaths resolve and default to the runtime profile types — but the profile-specific import sources are recommended so TypeScript checks props against the profile you author in.

## Runtime contract

Build output should lower to the same primitives no-build authors use:

- signals and async signals.
- `on:` command events.
- `signal:` and `class:` bindings.
- `async:boundary` regions.
- components, partials, and routes.
- cache and server response envelopes.

## Optimizer reports

The optimizer classifies source inventory, signal ownership, event syntax, children fragments, Suspense, Reveal, runtime slices, chunks, and plan output.

Each selected runtime slice carries a `status`: `available` slices (`signals`, `events`) activate through `@async/framework/runtime` today, while `planned` slices (`async-signals`, `stream`) are recorded in the report — with a `runtime-slice-planned` warning diagnostic — until their runtime entrypoints ship.

## Vite plugin config

`asyncFramework(...)` declares needs, not ladder positions:

- `server.entry` selects the server lane. The plugin composes the Hono dev server; the app owns the HTML shell, SSR, and streaming.
- `client.entry` selects the browser build lane.
- The JSX bootstrap is detected from imports of `@async/framework/jsx` in `.jsx`/`.tsx` modules; there is no transform switch to set.
- The legacy `layer` option only annotates the build report and is scheduled for replacement by the needs-based config in `specs/framework/15-abstraction-layers.md`; omit it.

## Current boundary

The package includes the runtime, server bridge, JSX profile types, and Vite profile helpers. The optimizer consumes a fixture profile (`asyncFramework({ fixture })`); source-derived profile generation, full compiler emission, lazy chunk manifests, TSRX lowering, boundary activation for `planned` slices, and higher-level resume metadata remain later compiler-rung work (L6, and L7 per `specs/framework/16-whole-program-compiler.md`).
