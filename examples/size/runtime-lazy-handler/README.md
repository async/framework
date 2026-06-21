# Runtime Lazy Handler Size Scenario

Showcases strict lazy handler descriptors in the build-required runtime event
slice.

Key files:

- `index.html` defines runtime-plan button and count locators.
- `main.js` calls `start(...)` with a strict versioned handler descriptor.
- `handler.js` exports the lazily imported handler.
- `scenario.json` measures runtime slice files, this scenario script, and the
  lazy handler module.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/runtime-lazy-handler/`.

Verify:

```bash
pnpm run scenario:size:check
```
