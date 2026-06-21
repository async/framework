# Router Example

Showcases CSR first render and local route boundary swaps backed by registered
partials.

Key files:

- `index.html` defines navigation links and the `route` boundary.
- `main.js` registers route partials and starts the runtime in CSR mode.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/router/`.

Verify:

```bash
pnpm run examples:check
```
