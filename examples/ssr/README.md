# SSR Example

Showcases server render output, snapshot transfer, and browser activation
without an implicit startup fetch.

Key files:

- `index.html` provides the `#app` activation root.
- `main.js` builds a shared app definition, renders a server response, applies
  the HTML, reads the snapshot, and starts the browser runtime.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/ssr/`.

Verify:

```bash
pnpm run examples:check
```
