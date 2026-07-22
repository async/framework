# Stream Backpatch Size Scenario

Showcases default browser bundle plus opt-in stream helper size for out-of-order
stream backpatch handling.

Key files:

- `index.html` defines reveal metadata, boundaries, stream templates, and JSON
  stream patches.
- `main.js` starts `Async`, creates a boundary receiver, and applies stream
  patch scripts.
- `scenario.json` measures `dist/browser.min.js`, `dist/stream.min.js`, and
  this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/stream-backpatch/`.

## Imperative DOM exception

This named stream adapter enumerates transport-owned patch scripts so the
stream receiver can apply each payload. The query is limited to
`script[async:stream-patch]`; application features do not search or render the
document directly.

Verify:

```bash
pnpm run scenario:size:check
```
