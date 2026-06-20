# Async Framework Benchmark Harness

This folder is a trimmed copy of
[`krausest/js-framework-benchmark`](https://github.com/krausest/js-framework-benchmark)
for local `@async/framework` comparison work.

Imported upstream snapshot: `krausest/js-framework-benchmark@4fbccf5`.

## Included Frameworks

Only keyed implementations are included:

- `keyed/js-only` from upstream `vanillajs`
- `keyed/react` from upstream `react-hooks`
- `keyed/qwik-v1` from upstream `qwik`, using `@builder.io/qwik`
- `keyed/qwik-v2`, seeded from upstream `qwik`, using the public `@qwik.dev/*`
  beta packages
- `keyed/solid-v1` from upstream `solid`
- `keyed/solid-v2`, seeded from upstream `solid`, using the public
  `solid-js@next` beta package

As of June 20, 2026, Qwik 2 and Solid 2 are beta package lines, not stable
major releases. Their folders are present so we can start measuring and adjust
the implementation as those APIs settle.

## Setup

```bash
cd benchmark
npm ci --registry=https://registry.npmjs.org
npm run install-apps --registry=https://registry.npmjs.org
npm_config_registry=https://registry.npmjs.org npm run build-selected
```

If npm is configured to use the local registry on `127.0.0.1:4873`, start that
registry first or pass `--registry=https://registry.npmjs.org` for this
benchmark work. Use `npm_config_registry=https://registry.npmjs.org` for
scripts such as `build-selected` or `apps` that spawn nested npm installs.

`install-apps` installs only the modern Playwright app-health runner and the
local benchmark server. Use `install-local` only when you also need the legacy
upstream harness.

## App Health Check

Most local checks should start here. This builds the six selected apps, starts
or reuses the benchmark server, loads each app page in Chromium, and verifies
the shared app controls are present. It does not click row-operation buttons,
run benchmark iterations, collect timings, or produce trace data.

From the repository root:

```bash
pnpm run benchmark:apps
```

From this `benchmark/` folder:

```bash
npm run apps
```

To only load already-built apps:

```bash
npm run bench-modern-apps
```

## Benchmark Runs

The preferred local runner is the modern Playwright-first runner:

```bash
npm run bench-modern-smoke
npm run bench-modern -- --benchmark 01_ --iterations 1
npm run bench-modern-results
```

The modern runner starts the benchmark server automatically when `/ls` is not
already reachable on `localhost:8080`. It uses Playwright for browser control
and Chromium CDP trace events for CPU/script/paint metrics. Its JSON output is
written under `modern-runner/results/`, and raw traces are written under
`modern-runner/traces/`.

`webdriver-ts` is retained as the upstream-compatible legacy harness and
reference path while the modern runner proves parity.

Start the local benchmark server:

```bash
npm start
```

In another shell, run a quick smoke benchmark:

```bash
npm run bench-smoke -- --headless
```

Run the selected frameworks against the full benchmark set:

```bash
npm run bench-selected -- --headless
```

The original upstream README is kept in `UPSTREAM_README.md`.
