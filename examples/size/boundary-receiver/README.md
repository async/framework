# Boundary Receiver Size Scenario

Showcases the full browser bundle plus `createBoundaryReceiver(...)` setup for
streamed boundary patch receiving.

Key files:

- `index.html` defines the `product` boundary.
- `main.js` starts `Async` and creates a boundary receiver.
- `scenario.json` measures `dist/browser.min.js` plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/boundary-receiver/`.

Verify:

```bash
pnpm run scenario:size:check
```
