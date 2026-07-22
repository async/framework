# @async/framework Agent Guide

This file adds repo-specific rules for the `@async/framework` checkout. The
root workspace `AGENTS.md` still applies.

## Repo Shape

- Work from this repository checkout and check `git status --short --branch`
  before editing.
- This package is `@async/framework`: a no-build Async runtime with browser and
  server entrypoints, signals, command events, route partials, cache split, SSR
  activation, and streaming boundaries.
- Use Node.js 24 or newer and `pnpm` 11. Keep the package ESM-only with `.js`
  source files and explicit `.js` import extensions. Do not add `.mjs` files
  unless a tool explicitly requires one.
- Main source lives in `src/`; tests live in `tests/<suite>/*.test.js`,
  categorized by suite (`unit`, `runtime`, `router`, `server`, `timing`,
  `performance`, `build`, `examples` — see `tests/README.md`); examples live
  in `examples/`; docs and system contracts live in `README.md`, `docs/`, and
  `specs/`.

## Design Sources And Invariants

- For behavioral changes, start with `specs/framework.md`, then read the
  relevant `specs/framework/*.md` subsystem contract before editing.
- If implementation and specs disagree, treat it as a framework design issue:
  deliberately update the spec or change the implementation to match it.
- Preserve the core runtime contract: no VDOM, no hidden hydration/diff/rerender
  path, no implicit fetches during startup, and no server-only state or cache
  contents leaking into browser snapshots.
- Keep the no-compiler layers (L0-L3, L5) understandable without future
  compiler layers. Compiler-layer work (L4, L6, L7) must compile down to the
  same HTML, registry, snapshot, server-envelope, route-partial, cache, and
  boundary protocol.

## Framework Shorthand

Use these abbreviations in ADRs, issues, review notes, and Codex prompts:

The layer model is the L0-L7 abstraction layers owned by
`specs/framework/15-abstraction-layers.md`. Layers are authoring abstractions;
capabilities are protocol properties available from the lowest layer the
protocol allows.

- `L0` Enhance: behavior references on server-owned HTML. Protocol attributes
  plus a script tag; native/MPA partial swaps; no app model, build, or client
  router.
- `L1` Interpret: the runtime-interpreted app model, no build. Registries,
  `Async.use(...)` conventions, scoped fragment components, lifecycle,
  scheduler-batched bindings.
- `L2` Bundle: build as delivery plus client routing and an app server.
  Bundling must not change protocol semantics; the build stays optional here.
- `L3` SSR: server-rendered component functions with browser activation from
  snapshots. No hydration, no rerender. (Not "Resume": resume is the
  protocol-wide contract, not a layer.)
- `L4` Transform: JSX/TSX source transforms lowering onto the same protocol,
  mainly JSX/TSX lowering to protocol records. First layer where a build is
  required.
- `L5` Stream: progressive documents; boundary fallback and settling; reveal
  ordering; async signals settling server-side. No compiler required.
- `L6` Reorder: out-of-order settling automated by the Optimizer: Qwik-style
  `server$`, co-located server-function extraction, chunks, lazy descriptors,
  generated plans, runtime slices. The OOS protocol itself is L5-available.
- `L7` Optimize: whole-program compiler
  (`specs/framework/16-whole-program-compiler.md`). Specification only.
- Legacy mapping: pre-2026-07 notes use `L1` for layers L0-L1, `L1.5` for the
  server/streaming capability set (now spread across L3 and L5), and `L2` for
  the compiler layers (L4, L6, L7). See the legacy table in
  `specs/framework/15-abstraction-layers.md`.
- `NB`: no-build profile, covering layers L0-L3 and L5. Author HTML and
  JavaScript run directly with `Async.start(...)`, default shorthand
  attributes, and no compiler.
- `BR`: build-required profile, covering layers L4, L6, and L7. Author JSX/TSX
  uses imports such as `@async/framework/jsx`; the compiler/optimizer emits
  protocol-compatible output the no-compiler layers can speak.
- `OOS`: out-of-order streaming/rendering. Chunks may become ready in a
  different order than source order.
- `Suspense`: async boundary ownership for fallback and final content.
- `Reveal`: OOS commit policy for sibling boundaries, such as `as-ready`,
  `forwards`, `backwards`, `together`, plus tail visibility.
- `Plan`: generated or virtual framework plan. In BR it is private compiler
  plumbing, not a hand-written author API.
- `Optimizer`: the L6 BR compiler pipeline that classifies source, signals,
  ownership, events, Suspense/Reveal, runtime slices, chunks, and plan output.
  Distinct from the deferred L7 whole-program compiler.

## Attribute Example Style

- In framework docs, ADRs, specs, examples, review notes, and prompts, always
  describe author-facing syntax with the default shorthand prefixes: `async:`,
  `signal:`, `on:`, `class:`, and `intersect:`.
- Use `on:` syntax for no-build event examples. Use JSX event props such as
  `onClick` only when the subject is the BR JSX authoring profile or its
  lowering to `on:click`.
- Treat `data-async-*`, `data-signal-*`, `data-on-*`, and related data
  attributes as configured compatibility forms, not the framework's syntax.
  Do not use them when explaining syntax or giving ordinary examples. Mention
  them only when the subject is custom attribute configuration, raw
  compatibility behavior, or compatibility tests.
- For reveal examples, prefer `async:reveal`, `async:reveal-order`, and
  `async:reveal-tail`.

## Public App Examples

- Treat `docs/start/app-authoring.md` as the authoritative application
  authoring contract. Public examples must use framework-owned attachment,
  delegated events, signal bindings, and boundary updates.
- Do not add global selector APIs, document-level feature listeners, or
  `innerHTML` rendering to normal example feature code.
- Narrow platform adapters may use imperative DOM only when the adjacent
  README includes an `Imperative DOM exception` section that names the
  capability and ownership boundary.
- Keep `tests/examples/authoring-contract.test.js` exact: new occurrences are
  failures unless the example is a justified named adapter with a precise
  count and README rationale.

## Generated Artifacts And Pipeline

- Edit source, tests, examples, scripts, specs, `package.json`, and
  `pipeline.ts`; do not edit generated output as the source of truth.
- `scripts/build-framework-bundle.js` owns generated package artifacts in
  `dist/`, including `browser.js`, `browser.min.js`, `browser.umd.min.js`,
  `browser.ts`, `browser.d.ts`, `framework.ts`, `framework.d.ts`, `server.js`,
  and `dist/package.json`.
- The generated `dist/` directory is the package root for `npm pack` and
  release publishing. Consumers still receive package-root artifacts; they
  should not import from `dist/`.
- `pipeline.ts` owns GitHub Actions, Pages, release, GitHub Packages mirror,
  npm publish, release doctor wiring, and generated pipeline scripts/locks.
- Do not hand-edit `.github/workflows/async-pipeline.yml` except to inspect
  generated output. Change `pipeline.ts`, then run:

```bash
pnpm run pipeline:sync:generate
pnpm run pipeline:sync:check
pnpm run pipeline:github:check
```

## Public API Changes

- For public API or export-map changes, update the relevant source exports,
  docs/specs, and tests together.
- Cover root imports, `@async/framework/browser`, `@async/framework/server`,
  generated declarations, and browser/server bundle separation when the public
  surface changes.
- Do not run local package verification commands such as `pnpm run pack:check`,
  `npm pack`, or local publish dry runs by default. Leave package verification
  to the release workflow unless the user explicitly asks for a local package
  check.
- Keep browser bundles free of server-only registry internals and implicit
  global fetch behavior.

## Verification

- Focused behavior check: `node --test tests/<suite>/<area>.test.js`, or a
  whole suite via `pnpm run test:<suite>` (`unit`, `runtime`, `router`,
  `server`, `timing`, `performance`, `build`, `examples`).
- Frame-timing or commit-phase changes must add coverage in `tests/timing/`
  with an explicit frame-timed scheduler (see `tests/README.md`) — node's
  synchronous commits hide browser-only failures.
- Hot-path changes (files registered in `tests/performance/hot-paths.json`)
  must keep the performance contracts green; new hot paths get a registry
  entry, a `// @hot-paths:` contract test, and a `test.performance` pipeline
  input so changes auto-select the suite.
- Runtime checks: `pnpm test` and `pnpm run bundle:check`.
- Registry/docs/workflow checks: `pnpm run registry:lint`,
  `pnpm run pipeline:pages`, and `pnpm run release:check`.
- Documentation-only changes can use `git diff --check` when package behavior,
  generated artifacts, and workflow definitions are untouched.

## Release Path

- Release automation stays generated through Async Pipeline and
  `async/actions`.
- The publish order is GitHub Packages mirror first, npm publish second, and
  release doctor last.
- Do not bypass the generated GitHub Actions publish path with local publish
  commands unless the user explicitly asks for a local release operation.
