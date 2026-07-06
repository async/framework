# Vite JSX Streaming Example

Shows the build-required Vite lane for JSX source that declares signal, event,
Suspense, and Reveal intent while the optimizer selects compact runtime slices.

- `src/Dashboard.jsx` is the authoring source, written against the buildtime
  JSX profile (`@async/framework/jsx/buildtime`). It declares intent only: the
  Vite plugin replaces the module with a generated bootstrap that exports
  `{ plan, report, startAsyncFramework }`, and the authored render function is
  never executed in the current build profile.
- `src/streaming-profile.json` is the current optimizer input shape used by the
  Vite plugin. Source-derived profile generation is a later layer, so this
  fixture is the source of truth for the emitted plan today — if you change
  `Dashboard.jsx`, update the fixture to match.
- `src/main.js` imports the plugin bootstrap from the JSX file and starts the
  optimized runtime plan.

The optimizer report selects four runtime slices for this profile. `signals`
and `events` are `available` and activate through `@async/framework/runtime`.
`async-signals` and `stream` are reported as `planned`: their records are
carried in the report, but boundary activation ships with the future stream
slice entrypoint, so the Suspense fallbacks in `index.html` stay visible.

Start from this directory:

```bash
pnpm install
pnpm run dev
```

Build the client bundle:

```bash
pnpm run build
```

The checked-in config aliases framework package imports back to source files so
the example can run from this checkout. In an app, remove the aliases and import
from the package subpaths directly.
