# Vite JSX Streaming Example

Shows the build-required Vite lane for JSX source that declares signal, event,
Suspense, and Reveal intent while the optimizer selects compact runtime slices.

- `src/Dashboard.jsx` is the authoring source.
- `src/streaming-profile.json` is the current optimizer input shape used by the
  Vite plugin.
- `src/main.js` imports the plugin bootstrap from the JSX file and starts the
  optimized runtime plan.

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
