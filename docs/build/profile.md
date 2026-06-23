# Build Profile

The build-required profile adds JSX, TypeScript, optimizer reports, and framework plans while preserving the L1 and L1.5 runtime contracts.

## JSX entrypoints

The package exposes JSX profile entrypoints for runtime and buildtime authoring:

```json
{
  "jsxImportSource": "@async/framework/jsx"
}
```

TypeScript automatic JSX runtime support uses profile-specific `jsx-runtime` and `jsx-dev-runtime` entrypoints.

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

## Current boundary

The package includes the runtime, server bridge, JSX profile types, and Vite profile helpers. Full compiler emission, lazy chunk manifests, TSRX lowering, and higher-level resume metadata remain later layers.
