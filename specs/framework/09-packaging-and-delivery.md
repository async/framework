# Packaging And Delivery

Reference file for [Async Framework](../framework.md). This file owns public
entrypoints, CDN artifacts, generated bundles, examples, docs site, and release
expectations.

## Purpose

Async should be usable directly from npm, browser ESM, and script tags while
preserving a clear browser/server split. Generated artifacts are part of the
published contract, but source files remain the implementation surface. Bundles
are allowed as delivery artifacts, but they are not the only intended delivery
model.

## Responsibilities

- Publish condition-aware browser and server entrypoints.
- Generate browser ESM, browser UMD, minified, TypeScript, and declaration
  artifacts.
- Keep package exports aligned with runtime and type surfaces.
- Provide examples for core protocol use cases.
- Verify package file lists, installed package resolution, bundle shape, and
  release metadata.
- Use generated Async Pipeline workflows for verification, Pages, release, and
  publishing.

## Public Contract

Package surfaces include:

- Root import with condition-specific browser and Node behavior.
- `@async/framework/browser` for browser runtime APIs.
- `@async/framework/stream` for opt-in browser streaming boundary receivers.
- `@async/framework/flow` for opt-in browser Flow authoring helpers and Flow
  runtime attachment.
- `@async/framework/router` for opt-in browser route helpers, route registries,
  and router runtime attachment.
- `@async/framework/server` for server-capable APIs.
- `@async/framework/jsx` for the current build-required JSX authoring helpers.
- `@async/framework/vite` for the current Vite 8+ with Rolldown build-required
  plugin.
- The Vite entry can also compose a Hono-backed dev server when
  `asyncFramework({ server })` is enabled. Hono remains app-owned and optional;
  production hosts such as Vercel run the app's default Hono export instead of
  a framework-owned server target.
- `@async/framework/runtime` and `@async/framework/runtime/*` for optimized
  built-mode runtime slices defined by
  [11-runtime-slice-entrypoints.md](./11-runtime-slice-entrypoints.md).
- Explicit artifact subpaths such as `browser.js`, `browser.min.js`,
  `browser.umd.min.js`, `browser.ts`, `browser.d.ts`, `stream.js`,
  `flow.js`, `router.js`, `server.js`, `framework.ts`, and
  `framework.d.ts`.
- CDN defaults for UNPKG and jsDelivr.

The package is ESM-first and expects Node.js 24 or newer for package tooling and
server-side verification.

## Subsystem Boundaries

- Source files own implementation.
- Build scripts own generated root artifacts.
- Package metadata owns exports and published files.
- Examples own usage coverage.
- Registry lint owns duplicate/conflicting registry declaration checks.
- Async Pipeline owns generated GitHub Actions, Pages, package verification,
  release, GitHub Packages mirror, npm publish, and release doctor tasks.

## Protocol Contract

Delivery must preserve the protocol:

- Browser bundles expose the public browser runtime API.
- Flow, router, and streaming browser bundles expose their opt-in subpath APIs
  without requiring the default browser asset to carry those implementations.
- UMD bundles expose `Async` and helper functions without namespace conflicts.
- Browser bundles exclude server-only registry internals where possible.
- Generated declaration files match browser/server runtime availability.
- Examples demonstrate registry IDs, protocol attributes, server envelopes,
  routing, cache, SSR snapshots, and streaming boundaries.
- Build-required examples should demonstrate Vite setup through the public
  `./vite`, `./jsx`, and runtime slice subpaths without requiring the no-build
  `Async` global once source-derived profile generation is available.
- Hono dev-server composition must keep client-side reload behavior local to
  Vite development and must not introduce server streaming, SSR, or implicit
  browser fetch transport.
- Future no-bundler delivery must still preserve explicit protocol records,
  module identity, and cache ownership instead of hiding code loading behind an
  opaque app bundle.

## Resume Contract

Published artifacts must support resume and streaming:

- Browser entrypoints can read snapshots and scan existing documents.
- Server-capable entrypoints can render snapshot-bearing route HTML.
- Boundary receiver APIs are available to browser consumers through
  `@async/framework/stream`.
- Generated artifacts must not introduce implicit fetch behavior that bypasses
  explicit server transport or router-mode rules.
- Bundled and no-bundler delivery must both support requesting only the
  behavior modules needed by the active protocol records, without reusing stale
  module URLs after code changes.
- Installed package smoke tests must cover browser/server entrypoint
  resolution, not just checkout-local imports.

## Invariants

- Generated root artifacts are reproducible from source.
- `src/`, `tests/`, and `examples/` are not required in the published runtime
  tarball unless the package intentionally changes its file contract.
- Release checks must validate generated bundle shape before publish.
- Generated workflows are owned by `pipeline.ts` and Async Pipeline sync.
- Package delivery must preserve condition-specific declaration targets.

## Failure Modes

- Export-map/runtime/type mismatches fail package verification.
- Generated bundle drift fails bundle checks.
- Package file-list drift fails pack checks.
- Conflicting registry declarations fail registry lint.
- Release lifecycle drift fails release doctor or generated workflow checks.

## Acceptance Criteria

- A temp project can install the packed package and import root, browser, and
  server entrypoints.
- Browser ESM and UMD bundles expose the documented public APIs.
- Minified browser bundles preserve public `Async` behavior.
- Package file lists include generated public artifacts and exclude unintended
  implementation/test files.
- `release:check` covers verification, bundle size, docs site, pipeline sync,
  and generated workflow checks.

## Open Or Deferred Decisions

- Whether specs should be included in the published package file list.
- Public package policy for future compiler/build subpaths beyond the initial
  runtime slice lane.
- Browser compatibility targets beyond the current package baseline.
- Long-term release cadence and versioning policy for protocol changes.
- A dedicated no-bundler/module-cache delivery spec that defines how Async can
  use browser module caching and stable invalidation records to request only the
  current modules or code needed for active behavior, avoiding stale code while
  still allowing bundled delivery when useful.
