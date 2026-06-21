# Server Call Example

Showcases command events invoking registered server functions and applying
server-result signal effects.

Key files:

- `index.html` submits a form through a `server.*(...)` command.
- `main.js` registers the local server function and returned signal patch.

Start from the repo root:

```bash
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/server-call/`.

Verify:

```bash
pnpm run examples:check
```
