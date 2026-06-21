# Runtime Events Counter Size Scenario

Showcases the composed build-required runtime slice path with signals and
events, without the full no-build app hub.

Key files:

- `index.html` defines runtime-plan `data-async-id` locators.
- `main.js` calls `start(...)` from `dist/runtime.js` with a compact runtime
  plan.
- `scenario.json` measures runtime slice files plus this scenario script.

Start from the repo root:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/examples/size/runtime-events-counter/`.

Verify:

```bash
pnpm run scenario:size:check
```
