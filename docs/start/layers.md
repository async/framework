# Layers

Async uses L0-L7 abstraction layers anchored to eras of JavaScript framework
history. Each layer is named by the abstraction it adds between the author and
the runtime protocol; the era is the mnemonic, not the name.

Two definitions keep the layer model honest:

- A **capability** is a protocol property: signal bindings, command events,
  route partials, SSR snapshots and activation, server envelopes, streamed
  boundary patches, out-of-order application, generated plans. Capabilities
  are available to any layer whose runtime loads the relevant machinery.
- A **layer** is an authoring property: how much machinery sits between what
  you write and the protocol artifacts the runtime consumes. Every layer
  lowers to the same protocol a lower-layer app could write by hand.

## The layer model

| Layer | Name | Era anchor | Adds | Requires |
| --- | --- | --- | --- | --- |
| L0 | Enhance | jQuery/Backbone; htmx | Server-led HTML, native forms/actions, and behavior references on server-owned views | Script tag |
| L1 | Interpret | angular.js: runtime, no build | Runtime-interpreted app model | Script tag or ESM |
| L2 | Bundle | Built SPAs | Build as delivery, client routing, app server | Build optional |
| L3 | SSR | React-without-JSX + SSR server | Server-rendered components with activation, no hydration | Server; build optional |
| L4 | Transform | React+JSX | JSX/TSX transforms lowering to protocol records | Build |
| L5 | Stream | Streaming SSR; Suspense | Progressive documents, boundary reveal ordering | Streaming server |
| L6 | Reorder | RSC; islands; Qwik-style `server$` | Out-of-order settling, co-located server functions, chunks, and plans automated by the Optimizer | Optimizer |
| L7 | Optimize | React Compiler; TSRX | Whole-program compilation | Spec only today |

## Capabilities arrive early

Because capabilities are protocol properties, they land at the lowest layer
the protocol allows — usually earlier than the era that introduced them
elsewhere:

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

Resume is deliberately absent from the layer names: it is the protocol-wide
execution model. Activation from snapshots and protocol attributes applies at
every layer from L0 up; L3 is only where it becomes most visible.

## Layers compose

The layer model orders abstractions; it does not partition apps. Regions authored
at different layers interoperate through the protocol, so an L2-bundled SPA
can host an L0-enhanced form next to an L5-streamed boundary. An app's
tooling requirement is the highest layer it uses anywhere: a build appears
with the first L4 region, the Optimizer with the first L6 region.

Industry patterns are layer combinations, not layers:

| Pattern | Layer mix | Mechanism |
| --- | --- | --- |
| Islands | L0 page + L1/L3 regions | Every `async:container` root is an island; islands activate, they never hydrate |
| Partial hydration | L1/L3 + lazy loading | `intersect:` lifecycle and lazy descriptors load behavior on visibility |
| Hypermedia (htmx-style) | L0, available everywhere | Any backend can render HTML strings; native `method`/`action` forms, route partials, and server envelopes stay first-class |
| Resumability | Protocol-wide, not a layer | Snapshot and registry activation at every layer |
| Server islands | L3 + L5 | Boundary fallback now, streamed patch when ready |
| Server-only components | Any layer | HTML without behavior references ships no behavior JS |

## Where the package is today

The package ships the no-compiler layers (L0-L3, L5) as released behavior:
protocol attributes, the runtime app model, router modes, the Vite + Hono
profile, SSR activation, and streamed boundaries. The first compiler-layer
surfaces are the `./jsx` entrypoints and Vite plugin (L4) and the
`./runtime/*` slice entrypoints with optimizer reports (L6). L7 is
specification only.

Build tooling declares needs, never layer numbers: entries select render
targets, and the JSX bootstrap is detected from imports. The owning contract
is `specs/framework/15-abstraction-layers.md` in the repository.
