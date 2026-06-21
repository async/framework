# Server Call Button Size Scenario

Showcases full browser bundle size for a server-command button using a local
transport stub.

Key files:

- `index.html` defines a `server.*(...)` click command and signal output.
- `main.js` registers signals and starts `Async` with `createServerProxy(...)`.
- `scenario.json` measures `dist/browser.min.js` plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/server-call-button/`.

Verify:

```bash
pnpm run scenario:size:check
```
