# Runtime Signals Counter Size Scenario

Showcases the smallest signal-only runtime slice.

Key files:

- `index.html` defines the runtime-plan count locator.
- `main.js` calls `startSignals(...)` from `dist/runtime/signals.js`.
- `scenario.json` measures the signal runtime slice plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/runtime-signals-counter/`.

Verify:

```bash
pnpm run scenario:size:check
```
