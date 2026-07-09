# Test Suites

Tests are categorized by directory so a focused suite can run on its own.
Every suite is plain `node:test`; happy-dom provides the DOM where needed.

| Suite | Run | Covers |
| --- | --- | --- |
| `tests/unit/` | `pnpm run test:unit` | Pure module units: signals, scheduler, handlers, cache, partials, registries, async signals, delay. |
| `tests/runtime/` | `pnpm run test:runtime` | DOM runtime: loader activation and swaps, components, elements, app runtime (SSR render + browser activation), runtime events/signals, boundary receiver, flow bridge. |
| `tests/router/` | `pnpm run test:router` | Route matching, navigation modes, server route partials, prefetch, router state. |
| `tests/server/` | `pnpm run test:server` | Server envelope protocol, server proxy/transport, server registries. |
| `tests/timing/` | `pnpm run test:timing` | Rendering and `requestAnimationFrame` gotchas (see below). |
| `tests/performance/` | `pnpm run test:performance` | Hot-path performance contracts (see below). |
| `tests/build/` | `pnpm run test:build` | Built `dist/` artifacts, bundle guardrails, optimizer reports, size baselines, import boundaries, registry lint. Runs `bundle` first. |
| `tests/examples/` | `pnpm run test:examples` | Example apps compile and behave. |

`pnpm test` runs `bundle` and then every suite (`tests/**/*.test.js`).
`tests/fixtures/` holds shared fixtures and is not a suite.

## The timing suite

Real browsers commit boundary swaps on animation frames; node commits
synchronously. That difference has hidden two production bugs:

- awaiting commit completion (`loader._whenCommitted`, or anything that
  resolves on the commit phase) inside `scheduler.batch(...)` deadlocks,
  because automatic flushes are suppressed while a batch is open;
- hidden tabs suspend `requestAnimationFrame` entirely, freezing frame-timed
  commits (and any navigation awaiting them) until the tab becomes visible.

`tests/timing/` forces frame timing explicitly (`createScheduler({
requestAnimationFrame, frameFallbackMs })`) so those browser-shaped failure
modes stay covered by the node suite:

- `frame-timing.test.js` — scheduler-level: fallback when frames are
  suspended, exactly-once commits when frame and fallback race, FIFO commit
  ordering, commits scheduled inside an open batch landing at batch end,
  commit promises resolving without manual flushes.
- `rendering-commit.test.js` — rendering-level: loader swaps and
  `_whenCommitted` under frame timing and suspended frames, handler rebinding
  on swapped content, swap ordering, fire-and-forget swaps from handlers
  (the safe composition — never await commit completion inside a handler,
  handler dispatch runs in a batch), signal writes coalescing with swaps,
  and router navigation: local partials, server route partials with
  sub-boundaries, suspended-frame navigation, popstate re-renders.

When adding frame- or commit-phase behavior, add its regression here with an
explicit frame-timed scheduler — a green synchronous run does not prove the
browser path.

## The performance suite

Performance work lives in three places with three different jobs:

1. **Contracts — `tests/performance/`.** Deterministic operation-count
   assertions (tree traversals per scan, fetches per navigation, DOM
   mutations per write batch, animation-frame waits per commit batch). No
   wall-clock timing, so they are CI-stable and run in every `pnpm test`.
   They pin the *algorithmic shape* of a hot path; making one fail requires
   an actual complexity regression, not a slow machine.
2. **Benchmarks — `benchmark/` and `scripts/benchmark-swap-scan.js`.**
   Wall-clock harnesses (cross-framework apps, swap/scan strategies). Run on
   demand; too noisy to gate merges.
3. **Budgets — `tests/build/scenario-size.test.js`, `bundle:size:check`.**
   Size baselines with tolerances, checked in `tests/build/`.

The hot-path registry, `tests/performance/hot-paths.json`, maps each
hot-path source file to the contract tests that guard it, with a reason.
`hot-path-coverage.test.js` enforces the registry: contracts must exist and
declare their sources in a `// @hot-paths:` header, every performance test
must be registered, and — the part that makes this automatic — every
registered source must appear in the `test.performance` pipeline task inputs
in `pipeline.ts`. The pipeline caches on those inputs, so touching a hot-path
file is exactly what re-runs the performance suite.

To declare new code a hot path: add the registry entry, write the contract
test with the `// @hot-paths:` header, and add the source file to the
`test.performance` task inputs. The guardrail fails until all three agree.
