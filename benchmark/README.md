# Async Framework Benchmark Harness

This folder contains the modern local harness for framework comparison work.
It keeps app loading checks separate from actual benchmark runs.

## Apps

The comparable apps live in `apps/`:

- `async-framework`
- `js-only`
- `react`
- `qwik-v1`
- `qwik-v2`
- `solid-v1`
- `solid-v2`

`async-framework` uses the local root `@async/framework` browser source through
the benchmark server, so its result version follows the package being tested.
Qwik v2 and Solid v2 are beta package lines as of June 20, 2026. Their folders
stay structurally aligned with the v1 apps except for package imports and build
configuration required by those package lines.

## Setup

```bash
cd benchmark
npm ci --registry=https://registry.npmjs.org
npm run install-apps --registry=https://registry.npmjs.org
```

If npm is configured to use a local registry on `127.0.0.1:4873`, start that
registry first or pass `--registry=https://registry.npmjs.org`.

## App Health

Use this for cheap local verification. It builds the seven apps, starts or reuses
the local server, loads each app page in Chromium, and verifies the shared
controls are present. It does not click row-operation buttons, collect timings,
or write trace data.

From the repository root:

```bash
pnpm run benchmark:apps
```

From this folder:

```bash
npm run apps
```

To only load already-built apps:

```bash
npm run app-health
```

## Benchmark Runs

Use these only when you intend to run benchmark operations:

```bash
npm run benchmark:smoke
npm run benchmark:run -- --benchmark 01_ --iterations 1
npm run benchmark:results
```

By default, benchmark runs include `async-framework` plus the JavaScript-only,
React, Qwik, and Solid apps. To select a subset:

```bash
npm run benchmark:run -- --framework async-framework react solid-v2 --benchmark 01_ --iterations 3
```

The benchmark runner uses Playwright and Chromium CDP trace events for
CPU/script/paint metrics. JSON results are written under `runner/results/`, and
raw traces are written under `runner/traces/`.

The local server also exposes the latest JSON as a table at `/results`.

The local benchmark server starts automatically when `/ls` is not already
reachable on `localhost:8080`.
