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
- Main source lives in `src/`; tests live in `tests/*.test.js`; examples live
  in `examples/`; docs and system contracts live in `README.md` and `specs/`.

## Design Sources And Invariants

- For behavioral changes, start with `specs/framework.md`, then read the
  relevant `specs/framework/*.md` subsystem contract before editing.
- If implementation and specs disagree, treat it as a framework design issue:
  deliberately update the spec or change the implementation to match it.
- Preserve the core runtime contract: no VDOM, no hidden hydration/diff/rerender
  path, no implicit fetches during startup, and no server-only state or cache
  contents leaking into browser snapshots.
- Keep Layer 1 and Layer 1.5 understandable without future compiler layers.
  L2 or compiler-required work must compile down to the same HTML,
  registry, snapshot, server-envelope, route-partial, cache, and boundary
  protocol.

## Framework Shorthand

Use these abbreviations in ADRs, issues, review notes, and Codex prompts:

- `L1`: Layer 1, the no-build browser runtime core. It owns DOM scanning,
  attribute prefixes, event binding, signals, command handlers, startup, and the
  smallest usable runtime.
- `L1.5`: Layer 1.5, the no-build/low-build server and streaming bridge above
  the runtime core. It owns scheduler ordering, async signal settling, SSR
  activation, route partials, browser/server cache split, boundary patches,
  stream sequencing, and reveal/OOS coordination without requiring a compiler.
- `L2`: Layer 2, the build-required authoring/compiler profile. It owns JSX/TSX
  authoring, build adapters, optimizer reports, generated plans, generated
  registries, and chunk/manifest decisions that lower onto L1 and L1.5
  protocols.
- `NB`: no-build profile. Author HTML and JavaScript run directly with
  `Async.start(...)`, default shorthand attributes, and no compiler.
- `BR`: build-required profile. Author JSX/TSX uses imports such as
  `@async/framework/jsx`; the compiler/optimizer emits L1/L1.5-compatible
  output.
- `OOS`: out-of-order streaming/rendering. Chunks may become ready in a
  different order than source order.
- `Suspense`: async boundary ownership for fallback and final content.
- `Reveal`: OOS commit policy for sibling boundaries, such as `as-ready`,
  `forwards`, `backwards`, `together`, plus tail visibility.
- `Plan`: generated or virtual framework plan. In BR it is private compiler
  plumbing, not a hand-written author API.
- `Optimizer`: the BR compiler pipeline that classifies source, signals,
  ownership, events, Suspense/Reveal, runtime slices, chunks, and plan output.

## Attribute Example Style

- In NB docs and examples, prefer the default shorthand prefixes:
  `async:`, `signal:`, `on:`, `class:`, and `intersect:`.
- Treat `data-async-*`, `data-signal-*`, `data-on-*`, and related data
  attributes as configured compatibility forms. Use them in examples only when
  documenting custom attribute configuration or raw compatibility behavior.
- For reveal examples, prefer `async:reveal`, `async:reveal-order`, and
  `async:reveal-tail`. The configured compatibility form
  `data-async-reveal`, `data-async-reveal-order`, and
  `data-async-reveal-tail` must continue to work when the `async` prefix maps
  to `data-async-`.

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
  generated declarations, browser/server bundle separation, and packed package
  resolution when the public surface changes.
- Keep browser bundles free of server-only registry internals and implicit
  global fetch behavior.

## Verification

- Focused behavior check: `node --test tests/<area>.test.js`.
- Runtime/package checks: `pnpm test`, `pnpm run bundle:check`, and
  `pnpm run pack:check`.
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
