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
  System 2 or compiler-required work must compile down to the same HTML,
  registry, snapshot, server-envelope, route-partial, cache, and boundary
  protocol.

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
