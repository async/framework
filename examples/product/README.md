# Product Example

Showcases async signal loading with loading, ready, and error boundary
templates.

Key files:

- `index.html` defines the product select control and async boundary templates.
- `main.js` registers `productId` plus an async `product` signal.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/product/`.

Verify:

```bash
pnpm run examples:check
```
