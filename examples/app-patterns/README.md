# App Authoring Patterns Example

Shows the recommended full-app shape: plain catalog data, one registered root
component, component-local selection state, computed view fields, delegated
handlers, signal bindings, and app-level error reporting.

Key files:

- `index.html` declares the root with `async:component="CatalogApp"`.
- `main.js` keeps catalog records as plain data and puts only selection and
  derived view state in signals.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/app-patterns/`.

Verify:

```bash
pnpm run examples:check
```
