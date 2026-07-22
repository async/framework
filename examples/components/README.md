# Components Example

Showcases scoped fragment components, scoped handlers, lifecycle attach hooks,
class bindings, and attribute bindings.

Key files:

- `index.html` declares the `Toggle` host with `async:component`.
- `main.js` registers the component through `Async.use` and starts the
  document root.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/components/`.

Verify:

```bash
pnpm run examples:check
```
