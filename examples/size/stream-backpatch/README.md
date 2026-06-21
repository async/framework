# Stream Backpatch Size Scenario

Showcases full browser bundle size for out-of-order stream backpatch handling.

Key files:

- `index.html` defines reveal metadata, boundaries, stream templates, and JSON
  stream patches.
- `main.js` starts `Async`, creates a boundary receiver, and applies stream
  patch scripts.
- `scenario.json` measures `dist/browser.min.js` plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/stream-backpatch/`.

Verify:

```bash
pnpm run scenario:size:check
```
