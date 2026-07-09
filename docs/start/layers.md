# Layers

Async's layer model is an abstraction ladder anchored to eras of JavaScript
framework history. Each rung is named by the abstraction it adds between the
author and the runtime protocol; the era is the mnemonic, not the name.

Two definitions keep the ladder honest:

- A **capability** is a protocol property: signal bindings, command events,
  route partials, SSR snapshots and activation, server envelopes, streamed
  boundary patches, out-of-order application, generated plans. Capabilities
  are available to any rung whose runtime loads the relevant machinery.
- A **rung** is an authoring property: how much machinery sits between what
  you write and the protocol artifacts the runtime consumes. Every rung
  lowers to the same protocol a lower-rung app could write by hand.

## The ladder

| Rung | Name | Era anchor | Adds | Requires |
| --- | --- | --- | --- | --- |
| L0 | Enhance | jQuery/Backbone; htmx | Behavior references on server-owned HTML | Script tag |
| L1 | Interpret | angular.js: runtime, no build | Runtime-interpreted app model | Script tag or ESM |
| L2 | Bundle | Built SPAs | Build as delivery, client routing, app server | Build optional |
| L3 | SSR | React-without-JSX + SSR server | Server-rendered components with activation, no hydration | Server; build optional |
| L4 | Transform | React+JSX; Qwik-style `server$` | JSX/TSX transforms, co-located server functions | Build |
| L5 | Stream | Streaming SSR; Suspense | Progressive documents, boundary reveal ordering | Streaming server |
| L6 | Reorder | RSC; islands | Out-of-order settling automated by the Optimizer | Optimizer |
| L7 | Optimize | React Compiler; TSRX | Whole-program compilation | Spec only today |

## Capabilities arrive early

Because capabilities are protocol properties, they land at the lowest rung
the protocol allows — usually earlier than the era that introduced them
elsewhere:

| Capability | History arrived at | Async available from |
| --- | --- | --- |
| Declarative bindings on server HTML | Enhancement era | L0, no build |
| Full runtime app model | angular.js era | L1, no build |
| Client-side routing / SPA | Built-SPA era | L2, build optional |
| SSR with client continuation | Hydration era | L3, via activation, build optional |
| Server functions from the browser | `server$` / actions era | L0 protocol; L4 adds co-location |
| Progressive streaming | React 18 era | L5, no compiler |
| Out-of-order settling | RSC era | L5 protocol; L6 automates |
| Compiler-managed code splitting | RSC / islands era | L6 |
| Whole-program optimization | React Compiler era | L7, spec only |

Resume is deliberately absent from the rung names: it is the protocol-wide
execution model. Activation from snapshots and protocol attributes applies at
every rung from L0 up; L3 is only where it becomes most visible.

## Rungs compose

The ladder orders abstractions; it does not partition apps. Regions authored
at different rungs interoperate through the protocol, so an L2-bundled SPA
can host an L0-enhanced form next to an L5-streamed boundary. An app's
tooling requirement is the highest rung it uses anywhere: a build appears
with the first L4 region, the Optimizer with the first L6 region.

Industry patterns are rung combinations, not rungs:

| Pattern | Rung mix | Mechanism |
| --- | --- | --- |
| Islands | L0 page + L1/L3 regions | Every `async:container` root is an island; islands activate, they never hydrate |
| Partial hydration | L1/L3 + lazy loading | `intersect:` lifecycle and lazy descriptors load behavior on visibility |
| Hypermedia (htmx-style) | L0, available everywhere | Route partials and server envelopes stay first-class inside JSX apps |
| Resumability | Protocol-wide, not a rung | Snapshot and registry activation at every rung |
| Server islands | L3 + L5 | Boundary fallback now, streamed patch when ready |
| Server-only components | Any rung | HTML without behavior references ships no behavior JS |

## Where the package is today

The package ships the no-compiler rungs (L0-L3, L5) as released behavior:
protocol attributes, the runtime app model, router modes, the Vite + Hono
profile, SSR activation, and streamed boundaries. The first compiler-rung
surfaces are the `./jsx` entrypoints and Vite plugin (L4) and the
`./runtime/*` slice entrypoints with optimizer reports (L6). L7 is
specification only.

Build tooling declares needs, never ladder positions: entries select render
targets, and the JSX bootstrap is detected from imports. The owning contract
is `specs/framework/15-abstraction-layers.md` in the repository.
