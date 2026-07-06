# Build Profile

The build-required profile adds JSX, TypeScript, optimizer reports, and framework plans while preserving the L1 and L1.5 runtime contracts.

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

## Current boundary

The package includes the runtime, server bridge, JSX profile types, and Vite profile helpers. The optimizer consumes a fixture profile (`asyncFramework({ fixture })`); source-derived profile generation, full compiler emission, lazy chunk manifests, TSRX lowering, boundary activation for `planned` slices, and higher-level resume metadata remain later layers.
