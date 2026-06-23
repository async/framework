# Deferred Systems

Reference file for [Async Framework](../framework.md). This file captures
System 2 work that should not distort the current System 1 runtime protocol.

## Purpose

Async needs room for compiler layers, lazy module metadata, deeper
resumability, richer authoring systems, and a no-bundler module-cache delivery
model. These future systems are primarily for build-required apps, where
abstractions improve DX and reduce the mental model required to understand which
runtime systems a change affects. They must extend the System 1 protocol rather
than replace it.

## Responsibilities

- Name future systems explicitly so current specs do not imply they already
  exist.
- Preserve Layer 1 and Layer 1.5 behavior while System 2 layers are designed.
- Define constraints future compiler output must respect.
- Keep deferred work from leaking into current public promises prematurely.

## Public Contract

Deferred systems may include:

- JSX or TSRX authoring transforms.
- Higher-level app abstractions that hide protocol detail when that reduces
  mental load in larger codebases.
- Compiler-generated registry descriptors.
- Lazy chunk manifests and symbol resolver tables.
- Resource graphs and preload/prefetch hints.
- Compact snapshot and boundary-patch encodings.
- Deeper no-rerender resume records for component and async work.
- Build integrations for app frameworks and static hosting.
- A no-bundler delivery system that can use browser module caching and explicit
  invalidation metadata to request only the current modules or code needed by
  active protocol records.

None of these deferred systems may make the no-build or low-build protocol
invalid.

## Subsystem Boundaries

- Future compilers and build-required abstractions own source analysis and
  generated artifacts.
- The runtime protocol owns what generated artifacts must target.
- Packaging owns any public subpaths for future build tools.
- A future no-bundler/module-cache spec owns cache keys, invalidation records,
  module identity, and request policy for unbundled code loading.
- Resume/streaming owns activation semantics for generated protocol records.
- Diagnostics own failure messages when future authoring forms cannot lower
  safely.
- Build-required systems may improve DX, but they must not invent a separate
  hidden runtime model that no-build and Layer 1.5 apps cannot speak.

## Protocol Contract

System 2 systems must lower into explicit protocol records:

- Generated HTML must remain scannable.
- Generated registries must use stable IDs and declaration types.
- Generated server calls must use explicit transport/envelope rules.
- Generated lazy descriptors must resolve to public registry behavior.
- No-bundler descriptors must distinguish current module identity from stale
  module identity, so the runtime can request needed code without accidentally
  executing old code.
- Generated resume metadata must be inspectable enough to debug protocol
  ownership.
- Compiler output must be explainable as protocol artifacts that the lower
  runtime systems already understand.
- Flow declarations lower into the normal `signal` and `handler` registries.
  Flow signal refs, computed values, async-signal helper paths, and strict state
  helpers remain ordinary signal entries; Flow `on` handlers remain ordinary
  handler entries. The lower runtime must not require a separate Flow registry
  path for binding, scheduling, snapshot restore, or browser protocol records.

## Resume Contract

System 2 resume work should improve startup and interaction costs without
changing the core model:

- Component bodies should not need to execute on browser resume for HTML that
  already carries sufficient protocol metadata.
- Lazy modules should load because the protocol references a behavior, not
  because a hidden component tree is being hydrated.
- Bundles may still exist, but resume-capable code loading should be able to
  request only modules referenced by active protocol records and cache them
  safely across visits.
- Resource and symbol metadata should make resume more precise, not less
  explicit.
- Static documents with no interactive protocol should not pay for resume code.

## Invariants

- No future system may require VDOM reconciliation as the normal update path.
- No future system may make implicit browser fetch the default server-call or
  route behavior.
- No future authoring form may bypass the server/data JSON transport contract.
- No future compiler output may depend on private source-only state that cannot
  be represented by protocol records.
- No future no-bundler delivery path may reuse stale module URLs when the
  protocol says a newer behavior version is required.
- Runtime primitives stay useful without the compiler.

## Failure Modes

- Unsupported authoring patterns must produce diagnostics, not hidden runtime
  fallbacks.
- Missing lazy chunks or symbols must fail closed with stable error metadata.
- Protocol version mismatches must be detectable before partial activation
  corrupts state.
- Stale module-cache hits must be detected before old behavior executes for a
  current protocol record.
- Generated metadata that cannot be applied by the current runtime must be
  rejected rather than ignored.

## Acceptance Criteria

- Future compiler and abstraction examples can be explained as generated Async
  protocol.
- Lazy behavior can be tested through registry descriptors and explicit module
  resolution.
- Resume metadata can be validated without needing original source files.
- A future no-bundler example can prove the browser requests only the modules
  needed by active protocol records and invalidates stale code correctly.
- A no-build app, a Layer 1.5 server/streaming app, and a compiler-generated
  System 2 app can share the same loader, signals, server, router, cache, and
  boundary systems.
- Deferred decisions are reopened in specs before implementation commits to a
  public behavior.

## Open Or Deferred Decisions

- First official compiler target and syntax.
- Protocol versioning and compatibility policy.
- Manifest shape for lazy chunks and resource graphs.
- Dedicated no-bundler/module-cache delivery spec, including cache-key format,
  version/invalidation records, request policy, and interaction with bundled
  builds.
- Devtools protocol and debugging artifacts.
- Whether deep resumability records become public API or compiler-private
  artifacts.
