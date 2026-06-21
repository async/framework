# Counter Example

Showcases signal text binding and delegated click handlers in a no-build app.

Key files:

- `index.html` defines the `signal:text` binding and `on:click` commands.
- `main.js` registers the `counter` signal and increment/decrement handlers.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/counter/`.

Verify:

```bash
pnpm run examples:check
```
