# Streaming Example

Showcases boundary swaps where inserted HTML is rescanned for signal bindings
and delegated handlers.

Key files:

- `index.html` defines a `product` boundary and stream button.
- `main.js` swaps product HTML into the boundary and updates a selected signal.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/streaming/`.

Verify:

```bash
pnpm run examples:check
```
