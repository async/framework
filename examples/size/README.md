# Scenario Size Examples

Showcases minimal scenario fixtures used by `scripts/scenario-size.js` to track
raw and gzip closure size for full browser bundles and runtime-slice entrypoints.

Each child directory has an `index.html`, runtime entry script, and
`scenario.json` declaring the measured scripts and gzip budget.

Start a scenario from the repo root after building package artifacts:

```bash
pnpm run bundle
python3 -m http.server 4173
```

Open a scenario URL, such as
`http://127.0.0.1:4173/examples/size/runtime-events-counter/`.

Verify all scenarios:

```bash
pnpm run scenario:size:check
```
