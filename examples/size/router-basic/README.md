# Router Basic Size Scenario

Showcases opt-in router bundle size for a small CSR route and partial boundary.

Key files:

- `index.html` defines navigation and the `route` boundary.
- `main.js` registers a partial and route, then starts CSR routing.
- `scenario.json` measures `dist/router.min.js` plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/router-basic/`.

Verify:

```bash
pnpm run scenario:size:check
```
