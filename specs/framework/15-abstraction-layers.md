# Abstraction Layers

Reference file for [Async Framework](../framework.md). This file owns the
framework layer model: the L0-L7 abstraction layers, layer contracts,
capability availability, cross-layer pattern composition, the legacy
L1/L1.5/L2 mapping, and the build-config direction.

## Purpose

Async's L0-L7 abstraction layers are anchored to eras of JavaScript framework
history. Each layer is named by the abstraction it adds between the author and
the runtime protocol; the era is the mnemonic, not the name.

The layer model separates two ideas that framework history bundled together:

- A **capability** is a protocol property: signal bindings, delegated command
  events, route partials, SSR snapshots and activation, server-result
  envelopes, cache split, streamed boundary patches, out-of-order patch
  application, lazy descriptors, and generated plans. Capabilities are owned
  by the subsystem reference files and are available to any layer whose
  runtime loads the relevant machinery.
- A **layer** is an authoring property: how much machinery sits between what
  the developer writes and the protocol artifacts the runtime consumes.
  Layers only add abstraction (interpretation, bundling, server rendering,
  source transforms, optimizers, compilers) and must lower to the same
  protocol artifacts a lower-layer app could write by hand.

Every capability lands at the lowest layer the protocol allows. Higher layers
only automate authoring. Async serves out-of-order streaming to a no-build
CDN script; history did not offer that below its compiler era.

## Layer Table

| Layer | Name | Era anchor | Abstraction added | Async requires |
| --- | --- | --- | --- | --- |
| L0 | Enhance | jQuery/Backbone; htmx | Server-led HTML, native forms/actions, and behavior references on server-owned views | Script tag |
| L1 | Interpret | angular.js, runtime, no build | Runtime-interpreted app model | Script tag or ESM |
| L2 | Bundle | angular.js + build, SPA + server | Build as delivery; client routing; app server | Build optional |
| L3 | SSR | React-without-JSX + SSR server | Server-rendered component functions; activation | Server; build optional |
| L4 | Transform | React+JSX | Source transforms; JSX/TSX lowering to protocol records | Build |
| L5 | Stream | Streaming SSR; early Suspense | Progressive documents; boundary reveal ordering | Streaming server |
| L6 | Reorder | RSC; islands; Qwik-style `server$` | Out-of-order settling, co-located server functions, chunks, and plans automated by the Optimizer | Optimizer for automation |
| L7 | Optimize | React Compiler; TSRX | Whole-program compilation | Compiler; spec only |

### L0 Enhance

The server owns rendering; the browser adds behavior only through protocol
attributes. The server can be any backend that returns an HTML document or
fragment string. Native `method`/`action` forms can own POST/action flows, and
the response can be a full document, a route partial, or an explicit envelope
targeting a boundary. Authors write ordinary HTML plus `async:*`, `signal:*`,
`on:*`, `class:*`, and `intersect:*` attributes when the returned view needs
Async behavior. No app model, no client router, no build.

- Owning references: [04-dom-protocol.md](./04-dom-protocol.md),
  [07-routing-and-partials.md](./07-routing-and-partials.md),
  [06-server-and-data-system.md](./06-server-and-data-system.md).
- Delivery: CDN UMD/ESM browser artifacts from
  [09-packaging-and-delivery.md](./09-packaging-and-delivery.md).
- Status: released behavior. A documented minimal enhancement profile and
  size budget are open decisions.

### L1 Interpret

The browser interprets a full declarative app model at runtime with no build
step: registries as the declaration container, `Async.use(...)` conventions,
scoped fragment components, lifecycle pseudo-events, and scheduler-batched
bindings. `signal:value` plus `on:input` is the two-way binding story. Flow
authoring is an opt-in subpath.

- Owning references: [02-runtime-kernel.md](./02-runtime-kernel.md),
  [03-reactivity-system.md](./03-reactivity-system.md),
  [05-component-system.md](./05-component-system.md),
  [12-composition-patterns.md](./12-composition-patterns.md),
  [13-scheduler-and-commit-phase.md](./13-scheduler-and-commit-phase.md),
  [14-use-declarations-and-conventions.md](./14-use-declarations-and-conventions.md).
- Status: released.

### L2 Bundle

The build appears as a delivery optimization and must not change protocol
semantics. Client-side navigation (router CSR/SPA modes) and an app server
serving the shell live here, as does the Vite plugin with Hono dev-server
composition. Async keeps the build optional at this layer: an SPA router works
from CDN scripts.

- Owning references: [07-routing-and-partials.md](./07-routing-and-partials.md),
  [09-packaging-and-delivery.md](./09-packaging-and-delivery.md).
- Status: released.

### L3 SSR

Server-rendered component functions with browser activation. Component
functions render on the server; JSON snapshots carry browser-visible state;
the browser activates existing HTML by scanning protocol attributes. There is
no hydration pass and no component rerender to attach behavior. This layer
works no-build: the server emits protocol HTML and a CDN script activates it.

This layer is deliberately not called "Resume". Resume is a protocol-wide
execution model (see Resume Contract below); naming a layer after it would
wrongly localize it and collide with "resumability" as another framework's
term of art. L3 is where resume becomes most visible, not where it starts.

- Owning references: [05-component-system.md](./05-component-system.md),
  [06-server-and-data-system.md](./06-server-and-data-system.md),
  [07-routing-and-partials.md](./07-routing-and-partials.md),
  [08-resume-and-streaming.md](./08-resume-and-streaming.md).
- Status: released.

### L4 Transform

The first layer where a build is required, because the abstraction is the
source transform itself: JSX/TSX authoring lowering onto the same registries
and protocol attributes (JSX `onClick` lowers to `on:click`). L4 can improve
syntax, type ergonomics, and file organization, but it does not introduce a
separate runtime contract or server-function co-location.

- Owning references: [01-authoring-model.md](./01-authoring-model.md),
  [09-packaging-and-delivery.md](./09-packaging-and-delivery.md),
  [14-use-declarations-and-conventions.md](./14-use-declarations-and-conventions.md).
- Status: JSX authoring helpers and the Vite plugin are released.

### L5 Stream

The document arrives over time. Boundaries own fallback and settled content;
async signals settle server-side and stream patches; reveal policies
(`async:reveal`, `async:reveal-order`, `async:reveal-tail`) order sibling
commits. No compiler is required; the browser side is the opt-in
`@async/framework/stream` receiver.

- Owning references: [08-resume-and-streaming.md](./08-resume-and-streaming.md),
  [13-scheduler-and-commit-phase.md](./13-scheduler-and-commit-phase.md).
- Status: released. The server transport protocol for patch streams remains
  an open decision in [08-resume-and-streaming.md](./08-resume-and-streaming.md).

### L6 Reorder

Independent boundaries settle out of source order, and the Optimizer takes
over the performance refactoring authors previously did by hand: code
splitting, lazy descriptors with versioned browser imports, chunk decisions,
and generated plans consumed by the runtime slice entrypoints.

Qwik-style `server$` and co-located server functions belong here because the
Optimizer owns the source analysis that extracts server-only code, emits
explicit generated transport artifacts, and preserves the app-mounted
transport boundary. Browser network access stays explicit; extraction must not
introduce an implicit global fetch path.

Out-of-order patch application is L5-available protocol; L6 adds the
build-owned automation, not the capability. Async also does not need a
server/client component split: protocol HTML without behavior references
ships no behavior JavaScript at any layer, so the RSC-era "server-only
component" is the default state of unannotated HTML. L6 formalizes and
automates that decision rather than introducing it.

- Owning references: [01-authoring-model.md](./01-authoring-model.md),
  [06-server-and-data-system.md](./06-server-and-data-system.md),
  [08-resume-and-streaming.md](./08-resume-and-streaming.md),
  [10-deferred-systems.md](./10-deferred-systems.md),
  [11-runtime-slice-entrypoints.md](./11-runtime-slice-entrypoints.md).
- Status: the out-of-order protocol and runtime slice entrypoints are
  released; end-to-end optimizer automation (source to generated plan and
  chunks) is partial and deferred.

### L7 Optimize

Whole-program compilation: the compiler owns reactivity-graph extraction from
plain TSX, memoization and scheduling decisions, dead-protocol elimination,
and compact resumability records. Authors write unremarkable TSX with no
framework performance rituals.

- Owning reference:
  [16-whole-program-compiler.md](./16-whole-program-compiler.md).
- Status: specification only. No implementation is scheduled.

## Capability Availability

Capabilities land at the lowest layer the protocol allows, independent of the
era that introduced them elsewhere:

| Capability | History arrived at | Async available from |
| --- | --- | --- |
| Declarative bindings on server HTML | Enhancement era | L0, no build |
| Full runtime app model | angular.js era | L1, no build |
| Client-side routing / SPA | Built-SPA era | L2, build optional |
| SSR with client continuation | Hydration era | L3, via activation, build optional |
| Server functions from the browser | `server$` / actions era | L0 protocol; L6 adds co-located authoring and extraction |
| Progressive streaming | React 18 era | L5, no compiler |
| Out-of-order settling | RSC era | L5 protocol; L6 automates |
| Compiler-managed code splitting | RSC / islands era | L6 |
| Whole-program optimization | React Compiler era | L7, spec only |

## Cross-Layer Pattern Map

The layer model orders abstractions; it does not partition apps or features.

Layers compose within one document. Regions authored at different layers
interoperate through the protocol, so an L2-bundled SPA may contain an
L0-enhanced form next to an L5-streamed boundary. An app's tooling
requirement is the highest layer it uses anywhere: a build appears with the
first L4 region, the Optimizer with the first L6 region. The layer model
classifies what was written where, not what the app is.

Industry patterns are layer combinations, not layers:

| Pattern | Layer mix in Async | Mechanism |
| --- | --- | --- |
| Islands | L0 page + L1/L3 regions; L6 chunks them | Every `async:container` root is an island; islands activate, they never hydrate |
| Partial or progressive hydration | L1/L3 + lazy loading | `intersect:` lifecycle and lazy descriptors load behavior on visibility |
| Hypermedia (htmx-style) | L0, available at every layer | Any backend can render HTML strings; native `method`/`action` forms, route partials, and server envelopes stay first-class inside JSX apps |
| Resumability | Not a layer; protocol-wide | Snapshot and registry activation everywhere; see Resume Contract |
| Server islands / deferred regions | L3 + L5 | Boundary fallback now, streamed patch when ready |
| Server-only components | Any layer | HTML without behavior references ships no behavior JS; L6 automates the decision |

This table is the cross-layer pattern map. The composition-primitive pattern
map in [12-composition-patterns.md](./12-composition-patterns.md) is a
different, narrower table about children, props, slots, and boundaries.

## Legacy Model Mapping

Specs, ADRs, issues, and notes written before 2026-07 use the earlier
L1/L1.5/L2 model. Read them through this mapping:

| Legacy term | Meaning | New home |
| --- | --- | --- |
| L1 | No-build browser runtime core | Layers L0-L1; machinery owned by specs 02-05 |
| L1.5 | No/low-build server + streaming bridge | A capability set, not a layer: SSR and activation at L3, partials/server/cache from L0, streaming and out-of-order protocol at L5 |
| L2 | Build-required authoring/compiler profile | Layers L4 (transform), L6 (optimizer), L7 (compiler) |
| System 1 | No-build/low-build app class | The no-compiler layers: L0-L3 and L5 |
| System 2 | Build-required app class | The compiler layers: L4, L6, and L7 |
| NB | No-build profile | Unchanged; covers layers L0-L3 and L5 |
| BR | Build-required profile | Unchanged; covers layers L4, L6, and L7 |

The legacy numbers collide with the new layer model (legacy L1 is not layer L1;
legacy L2 is not layer L2). New writing must use the layer model; the legacy terms
remain only in this table, historical changelog entries, and quoted material.

## Build Config Direction

Build tooling must declare needs, not layer numbers. For the Vite plugin:

- Entries declare render targets. A `server.entry` selects the server/SSR
  lane; a `client.entry` selects the browser lane; both select both. There is
  no `render` mode flag: the entries already carry the information, and
  [09-packaging-and-delivery.md](./09-packaging-and-delivery.md) forbids the
  plugin from introducing server streaming, SSR, or implicit browser fetch
  behavior itself.
- Named flags declare transforms: `jsx` (L4), later `optimizer` (L6) and a
  compiler flag (L7). Flags are orthogonal and composable.
- The layer is output, not input. Dev and build logs should report the derived
  position (transforms used, targets built, capabilities in play).
- Preset sugar, if added, is named (`profile: "nb" | "br"`), never numbered.
  Presets set defaults; they never gate capabilities.
- The existing `layer: 1` option is deprecated: accepted with a warning and
  mapped to bundle-only delivery, then removed after one minor cycle. The
  final option names get a small ADR with the implementation change.

## Protocol Contract

Every layer lowers to the same protocol records: scannable HTML attributes,
registry declarations by stable ID, JSON snapshots, explicit server-result
envelopes, route and partial contracts, cache patches, boundary patches, and
generated plans. A layer that cannot express its output as these records is
not a valid Async layer. Generated artifacts remain inspectable without the
original source.

## Resume Contract

Resume is a protocol-wide execution model, not a layer. Activation from
protocol attributes and snapshots applies from L0 up; higher layers may add
metadata that makes resume cheaper or more precise, but no layer introduces
resume and no layer may break it. The word "resume" is reserved for this
contract and must not be used as a layer name.

## Invariants

- A capability never requires a higher layer than its owning protocol spec
  needs.
- Layer N output must be expressible as protocol records a lower-layer app
  could author by hand.
- Layers compose within one document; the protocol is the interop boundary.
- An app's tooling requirement is the highest layer it uses anywhere.
- Lower layers remain valid forever; no layer deprecates the layer below it.
- The no-compiler layers (L0-L3, L5) stay understandable without reading any
  compiler spec.
- Layer numbers never appear as config input; config surfaces declare needs
  by name.

## Failure Modes

- A spec, doc, or example that gates a capability behind a higher layer than
  its owning reference requires is a spec bug, not a support boundary.
- Compiler or optimizer output that cannot be expressed as protocol records
  is invalid Async output.
- A config surface that keys behavior off a layer number is invalid.
- Legacy layer numbering outside the mapping table, changelog history, or
  quoted material is a documentation defect.

## Acceptance Criteria

- Each layer L0-L6 is provable by at least one runnable example; L7 has none
  by design while it is spec-only.
- One example document mixes at least three layers (an L0-enhanced region, an
  L3 SSR shell, an L5 streamed boundary) and activates, swaps, and streams
  correctly.
- README and docs-site layer material presents the layer model and the capability
  availability table.
- A search for legacy layer terms across specs and docs hits only the legacy
  mapping table, changelog history, and quoted material.
- When build tooling lands derived-layer reporting, a build using JSX reports
  L4 transforms without the author declaring a layer.

## Open Or Deferred Decisions

- Additional cross-layer pattern map entries (PESPA, MPA view transitions,
  optimistic UI).
- Whether Flow stays anchored at L1 as an authoring option available above,
  or is described per layer.
- Whether the layer model gets a dedicated docs-site landing page.
- Whether `examples/layers/` complements or replaces the current flat
  examples set (current assumption: complements).
- The minimal L0 enhancement profile and its size budget.
- Final option names for the needs-based Vite config and the deprecation
  window for `layer`.
