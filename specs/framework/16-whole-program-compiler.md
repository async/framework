# Whole-Program Compiler

Reference file for [Async Framework](../framework.md). This file owns the
deferred L7 Optimize layer of the abstraction layers defined in
[15-abstraction-layers.md](./15-abstraction-layers.md): a whole-program
compiler profile in the style of the React Compiler / TSRX era.

## Status

Specification only. No implementation is scheduled. This file exists so L7
constraints are named before any code exists, so nearer-term work (the L6
Optimizer, runtime slices, JSX authoring) does not accidentally foreclose
them, and so no current spec implies L7 behavior already exists.

## Purpose

At L7 the compiler owns the work that authors and the L6 Optimizer still
handle: extracting the reactivity graph from plain TSX source, deciding
memoization and scheduling, eliminating protocol machinery the app provably
never uses, and emitting compact resumability records. The author writes
unremarkable TSX with no framework performance rituals: no manual chunk
hints, no hand-written plans, no memo wrappers.

L7 differs from L6 in what is derived rather than declared. The L6 Optimizer
automates chunking, lazy descriptors, and plan generation for behavior the
author already expressed through framework forms. The L7 compiler derives
the behavior graph itself from source, then produces the same classes of
artifacts.

## Responsibilities

- Derive signals, derivations, effects, event behavior, ownership, and
  server/browser splits from plain TSX source.
- Decide memoization, batching, and scheduling without author annotations.
- Emit protocol records, generated plans, chunk manifests, and lazy
  descriptors that the released runtime systems already understand.
- Emit compact resumability records that improve startup and interaction
  cost without changing resume semantics.
- Eliminate dead protocol machinery only when the app provably cannot reach
  it, and report what was eliminated.
- Produce diagnostics for source patterns it cannot lower safely.

## Ownership Boundaries

- The L7 compiler owns source analysis, derivation, and generated-artifact
  decisions.
- The L6 Optimizer contract in
  [11-runtime-slice-entrypoints.md](./11-runtime-slice-entrypoints.md) and
  [10-deferred-systems.md](./10-deferred-systems.md) owns plan and slice
  shapes; L7 targets those shapes rather than inventing parallel ones.
- The runtime protocol owns what generated artifacts must lower to; nothing
  in L7 may require a private runtime model.
- Packaging owns any future public subpaths for compiler tooling.
- Diagnostics own failure messages when source cannot be lowered.

## Public Contract

There is no public L7 API today. When one is proposed, it must arrive as
deliberate spec changes here first, and it is constrained in advance:

- Input is plain TSX/TS modules without framework-specific performance
  annotations.
- Output is protocol artifacts: registries, plans, chunks, descriptors,
  snapshots metadata, and resumability records.
- Output must remain meaningful without source maps or original component
  source, matching [01-authoring-model.md](./01-authoring-model.md).
- A compiled app must interoperate in one document with regions authored at
  any lower layer.

## Protocol Contract

- Generated HTML remains scannable protocol HTML.
- Generated registries use stable IDs and existing declaration types.
- Generated server calls use the explicit transport and envelope rules of
  [06-server-and-data-system.md](./06-server-and-data-system.md).
- Generated plans and descriptors target the contracts in
  [11-runtime-slice-entrypoints.md](./11-runtime-slice-entrypoints.md).
- Resumability records are versioned, inspectable, and rejected cleanly on
  version mismatch.
- Dead-protocol elimination must never remove machinery reachable through
  protocol records the document still carries.

## Resume Contract

- Compiled apps resume through the same protocol-wide resume model; L7 may
  make resume cheaper, never different.
- Component bodies must not execute on the browser for HTML that carries
  sufficient generated metadata.
- Resumability records may be compiler-private in format but must stay
  debuggable enough to attribute behavior to protocol ownership.
- Static documents with no interactive protocol pay nothing for L7 output.

## Invariants

- No VDOM and no reconciliation-based update path, compiled or not.
- No implicit browser fetch introduced by compilation.
- Runtime primitives stay useful without the compiler; L7 remains optional
  forever.
- Compiled output must be expressible as records a lower-layer app could
  author by hand, however impractical that authoring would be.
- Memoization and scheduling decisions must not change observable protocol
  semantics.

## Failure Modes

- Source patterns that cannot be lowered safely produce diagnostics, not
  silent runtime fallbacks.
- Version-mismatched resumability records are detected before partial
  activation corrupts state.
- Missing generated chunks or symbols fail closed with stable error
  metadata.
- Elimination decisions that strip reachable machinery are compiler bugs and
  must be detectable by comparing records against eliminated capabilities.

## Acceptance Criteria

- This spec can be evaluated against any proposed L7 design without code
  existing.
- A future L7 proposal names its authoring subset, diagnostics, and record
  formats as changes to this file before implementation starts.
- A compiled example can be explained artifact-by-artifact as generated
  protocol, per [10-deferred-systems.md](./10-deferred-systems.md).
- An L7-compiled region and an L0-enhanced region can share one document and
  one runtime.

## Open Or Deferred Decisions

- Authoring language priority and the supported TSX subset.
- Resumability record encoding (dense JSON versus binary) and versioning
  policy.
- Which records become public contract versus compiler-private artifacts.
- Whether dead-protocol elimination reports become a public build artifact.
- Devtools and inspection surfaces for compiled apps.
- Relationship between the L7 compiler and the L6 Optimizer pipeline: one
  tool with modes, or two tools sharing artifact contracts.
