# Cache Example

Showcases separate browser and server cache declarations around one product
lookup.

Key files:

- `index.html` shows the product title and call count.
- `main.js` registers browser/server caches, a server lookup, and a load
  handler.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/cache/`.

Verify:

```bash
pnpm run examples:check
```
