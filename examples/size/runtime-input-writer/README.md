# Runtime Input Writer Size Scenario

Showcases the build-required runtime plan for input events that write directly
to signal state.

Key files:

- `index.html` defines runtime-plan input and output locators.
- `main.js` calls `start(...)` with `setSignal` input commands and text/value
  bindings.
- `scenario.json` measures runtime slice files plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/runtime-input-writer/`.

Verify:

```bash
pnpm run scenario:size:check
```
