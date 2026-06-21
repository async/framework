# Events Counter Size Scenario

Showcases full browser bundle size for no-build signal and delegated event
registration.

Key files:

- `index.html` defines the click handler and signal text binding.
- `main.js` registers a signal, handler, and starts `Async`.
- `scenario.json` measures `dist/browser.min.js` plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/events-counter/`.

Verify:

```bash
pnpm run scenario:size:check
```
