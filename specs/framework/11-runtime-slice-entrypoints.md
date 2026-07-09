# Runtime Slice Entrypoints

Reference file for [Async Framework](../framework.md). This file owns
optimized built-mode runtime entrypoints under `@async/framework/runtime/*`.

## Purpose

Async's root browser runtime stays the no-build, protocol-first API. Runtime
slice entrypoints add a second delivery lane for generated or bundled apps that
already know which protocol records they need.

The goal is to let built apps pay only for the runtime features they use:
signals, planned DOM bindings, delegated events, and later router, boundary, or
server-call support. A slice entrypoint must not import the full app hub,
generic loader, router, server proxy, cache, partial registry, component system,
or boundary receiver unless that slice explicitly owns those features.

This is additive. Existing code using `Async.use(...)`, `Async.start(...)`,
`@async/framework`, `@async/framework/browser`, or CDN bundles does not change.

## Public Entrypoints

Initial public subpaths:

```txt
@async/framework/runtime
@async/framework/runtime/signals
@async/framework/runtime/events
```

Initial exports:

```ts
// @async/framework/runtime
export function start(
  root: ParentNode,
  plan: RuntimePlan,
  options?: RuntimeStartOptions
): RuntimeController;

// @async/framework/runtime/signals
export function startSignals(
  root: ParentNode,
  plan: SignalRuntimePlan,
  options?: SignalRuntimeOptions
): SignalRuntimeController;

// @async/framework/runtime/events
export function startEvents(
  root: ParentNode,
  plan: EventRuntimePlan,
  options?: EventRuntimeOptions
): EventRuntimeController;
```

Naming rules:

- `start` is reserved for the composed root runtime entrypoint.
- Feature subpaths export feature-specific starters such as `startSignals` and
  `startEvents`.
- Feature subpaths must not export a generic `start` alias.
- Returned controllers own teardown. Do not add public `stopSignals(...)` or
  `stopEvents(...)` functions unless a concrete host integration requires a
  separate teardown handle.

Future subpaths may be added only after a fixture proves the feature boundary:

```txt
@async/framework/runtime/router
@async/framework/runtime/boundaries
@async/framework/runtime/server
@async/framework/runtime/partials
```

## Controller Contract

All starters return a controller with an idempotent `stop()` method:

```ts
export type RuntimeSliceController = {
  readonly stopped: boolean;
  stop(): void;
};
```

Rules:

- `stop()` removes listeners, subscriptions, scheduled scoped work, observers,
  and slice-owned registries.
- `stop()` is idempotent.
- A stopped controller rejects future mutation APIs that would schedule work.
- If startup fails after installing resources, the starter must roll back
  already-started resources before throwing.
- The composed root `start(...)` stops slices in reverse startup order.
- Starters may accept `options.signal?: AbortSignal`; aborting it calls
  `stop()`.

Richer controllers may expose slice-owned APIs:

```ts
export type SignalRuntimeController = RuntimeSliceController & {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  update(path: string, fn: (value: unknown) => unknown): void;
  subscribe(path: string, fn: (value: unknown) => void): () => void;
  snapshot(): Record<string, unknown>;
};

export type EventRuntimeController = RuntimeSliceController & {
  dispatch?(event: Event): Promise<unknown[]>;
};
```

The public controller should expose behavior, not internal registry instances,
unless a later spec accepts a stable inspection API.

## Plan Contract

Runtime slice plans are generated artifacts first. They should be JSON-serializable
where possible, deterministic, and compact after minification. Human-authored
plans are allowed for tests and advanced users, but the API is optimized for
compiler or generator output.

Every plan has a version:

```ts
export type RuntimePlan = {
  readonly version: 1;
  readonly elements?: readonly ElementLocator[];
  readonly signals?: SignalRuntimePlan;
  readonly events?: EventRuntimePlan;
};
```

`elements` is a locator table shared by slices:

```ts
export type ElementLocator =
  | string
  | {
      readonly selector: string;
      readonly optional?: boolean;
    };
```

Version 1 locators use scoped CSS selectors resolved from `root`. A build tool
should prefer stable generated attributes such as `[data-async-id="0"]` over
semantic selectors. Later versions may add structural DOM paths or host-provided
element tables, but v1 should stay simple and inspectable.

Locator rules:

- Locators are resolved once at startup unless a slice explicitly owns dynamic
  replacement.
- Required locators that do not resolve fail startup.
- Optional locators that do not resolve are ignored with a development
  diagnostic hook when one is configured.
- A slice must not scan every element in the root to discover protocol
  attributes. The plan is the discovery source.

## Signal Slice

The signals slice owns signal state and planned DOM bindings. It imports only
the signal primitives, scheduler primitives, locator resolver, and planned
binding helpers it needs.

Plan shape:

```ts
export type SignalRuntimePlan = {
  readonly version?: 1;
  readonly values?: readonly SignalInitialValue[];
  readonly bindings?: readonly SignalBindingRecord[];
};

export type SignalInitialValue = readonly [path: string, value: unknown];

export type SignalBindingRecord =
  | readonly [element: number, kind: "text", path: string]
  | readonly [element: number, kind: "value", path: string]
  | readonly [element: number, kind: "attr", name: string, path: string]
  | readonly [element: number, kind: "prop", name: string, path: string]
  | readonly [element: number, kind: "class", token: string, path: string]
  | readonly [element: number, kind: "classList", path: string];
```

Behavior:

- `values` initialize signal state before bindings run.
- Bindings apply their current value during startup.
- Bindings subscribe to the exact signal paths named in the plan.
- Text bindings write `textContent`.
- Value bindings write `value` when supported and fall back to the `value`
  attribute when not supported.
- Attribute bindings remove the attribute for `false`, `null`, or `undefined`
  unless a later DOM protocol spec defines a different attr family.
- Property bindings write the property directly.
- Class token bindings toggle one class token.
- Class list bindings replace only the dynamic class tokens they previously
  owned and preserve static classes.

Non-goals for the initial signal slice:

- No generic `signal:*` attribute scanning.
- No async signals.
- No inline binding registry.
- No component attach lifecycle.
- No route, cache, server, partial, or boundary integration.
- No automatic input-to-signal writer. Input writing belongs to the events
  slice because it installs event listeners.

## Event Slice

The events slice owns planned delegated event listeners and command execution.
It must not parse handler strings at event time.

Plan shape:

```ts
export type EventRuntimePlan = {
  readonly version?: 1;
  readonly events: readonly EventBindingRecord[];
  readonly handlers?: Record<string, HandlerDescriptor>;
};

export type EventBindingRecord = readonly [
  element: number,
  event: string,
  commands: readonly EventCommand[]
];

export type EventCommand =
  | readonly ["handler", id: string]
  | readonly ["preventDefault"]
  | readonly ["stopPropagation"]
  | readonly ["stopImmediatePropagation"]
  | readonly ["setSignal", path: string, valueSource: EventValueSource];

export type EventValueSource =
  | readonly ["event.target.value"]
  | readonly ["event.target.checked"]
  | readonly ["constant", value: unknown];

export type HandlerDescriptor =
  | ((context: EventRuntimeContext) => unknown | Promise<unknown>)
  | StrictHandlerDescriptor;

export type StrictHandlerDescriptor = {
  readonly mode?: "strict";
  readonly module?: string;
  readonly browserImport: string;
  readonly exportName: string;
  readonly version?: string;
  readonly integrity?: string;
};
```

Strict descriptors are generated/built-mode records. They intentionally mirror
the useful part of `framework-demo` chunk manifests: keep the canonical emitted
module path separate from the browser import URL, and include the version in the
browser URL, for example `handler.js?v=67678`.

Dynamic descriptors remain the no-build lane:

```ts
export type DynamicHandlerDescriptor = {
  readonly mode?: "dynamic";
  readonly url: string;
  readonly export?: string;
};
```

Dynamic descriptors use the existing lazy-registry behavior: base URL/type-path
resolution, hash export syntax, inferred export names, and fallback behavior.
Runtime slice entrypoints do not use dynamic descriptors by default because
that would pull convention and inference code into the optimized path.

Behavior:

- Startup resolves element locators and builds an element-to-event table.
- The slice installs one delegated listener per event type on `root`.
- Event matching walks from `event.target` to `root` and checks planned records.
- Built-in commands are direct operations, not registry lookups.
- `setSignal` requires a signal controller or compatible signal API in options.
- Handler descriptors with functions run directly.
- Strict handler descriptors lazy-load `browserImport` and resolve
  `exportName`. Do not infer paths or export names in the runtime slice.
- When a strict descriptor includes `version`, startup or first use must verify
  that `browserImport` contains that version as a query parameter before
  importing it.
- Lazy module and export promises are cached per controller.

Options:

```ts
export type EventRuntimeOptions = {
  readonly signals?: Pick<
    SignalRuntimeController,
    "get" | "set" | "update" | "snapshot" | "subscribe"
  >;
  readonly importModule?: (url: string) => Promise<Record<string, unknown>>;
  readonly scheduler?: RuntimeScheduler;
  readonly signal?: AbortSignal;
  readonly onError?: (error: unknown, context: EventRuntimeErrorContext) => void;
};
```

Non-goals for the initial event slice:

- No `on:*` attribute scanning.
- No handler ref string parser.
- No server command parser.
- No route navigation.
- No partial rendering.
- No visibility or intersection lifecycle.
- No generic lazy registry path inference.
- No dynamic lazy descriptor support unless a later ADR accepts that size
  tradeoff for runtime slices.

Server commands can be added later as a separate feature block or
`@async/framework/runtime/server` integration. The event slice may reject a plan
that contains unsupported command kinds.

## Composed Root Runtime

`@async/framework/runtime` provides a composed built-mode root:

```ts
const runtime = start(root, {
  version: 1,
  elements: ['[data-async-id="count"]', '[data-async-id="inc"]'],
  signals: {
    values: [["count", 0]],
    bindings: [[0, "text", "count"]]
  },
  events: {
    events: [[1, "click", [["handler", "increment"]]]],
    handlers: {
      increment: {
        module: "./chunks/handler-increment.js",
        browserImport: "/build/chunks/handler-increment.js?v=67678",
        exportName: "increment",
        version: "67678"
      }
    }
  }
});

runtime.stop();
```

Startup order for v1:

1. Resolve shared locators.
2. Start signals when `plan.signals` exists.
3. Start events when `plan.events` exists, passing the signal controller.

The composed root is a convenience entrypoint. It may import the initial
supported slices. For the smallest bundle, generators should import the narrow
subpaths directly:

```ts
import { startSignals } from "@async/framework/runtime/signals";
import { startEvents } from "@async/framework/runtime/events";
```

Root `start(...)` must still avoid importing no-build-only systems such as the
full app hub, generic loader, router, server proxy, cache, partials, components,
and boundary receiver until those are deliberately accepted as runtime slices.

## Package Export Contract

Package metadata should add browser/import/types entries for each runtime
subpath:

```json
{
  "exports": {
    "./runtime": {
      "types": "./runtime.d.ts",
      "browser": "./runtime.js",
      "import": "./runtime.js",
      "default": "./runtime.js"
    },
    "./runtime/signals": {
      "types": "./runtime/signals.d.ts",
      "browser": "./runtime/signals.js",
      "import": "./runtime/signals.js",
      "default": "./runtime/signals.js"
    },
    "./runtime/events": {
      "types": "./runtime/events.d.ts",
      "browser": "./runtime/events.js",
      "import": "./runtime/events.js",
      "default": "./runtime/events.js"
    }
  }
}
```

The package may generate these files as release artifacts. It must not require
publishing `src/` to make the subpaths work unless the packaging spec is
deliberately changed.

`sideEffects` must remain compatible with tree shaking. Runtime slice modules
must avoid top-level global mutation, custom-element registration, implicit DOM
startup, or eager dynamic imports.

## Size Budget Contract

Runtime slices must be measured by scenario fixture, not only by file size.

Initial required fixtures:

- signals-only counter display
- signals plus delegated click event
- input value writer through planned events
- lazy handler chunk
- stop/restart without duplicate listeners

Initial budget policy:

- Each fixture must record raw and gzip bytes for the emitted browser script
  closure.
- The first implementation may set a measured baseline instead of an aggressive
  hard cap.
- After the baseline lands, every new slice feature must either stay within the
  current budget or deliberately update the spec/changelog with evidence.
- A runtime-slice counter must be meaningfully smaller than `browser.min.js`.
  The acceptance target is less than half of the current full browser minified
  gzip size, with later ratchets expected as the slices stabilize.

The existing full browser bundle budget remains owned by the packaging and
release checks. Runtime-slice budgets are separate because they measure built
app closure size.

## Compatibility Rules

- Existing `Async` root API remains source-compatible.
- Existing no-build HTML protocol remains source-compatible.
- Existing browser and UMD CDN artifacts remain the friendly all-in-one lane.
- Runtime slice entrypoints are optimized built-mode APIs and may require a
  generated plan.
- A feature supported by the generic loader is not automatically supported by a
  runtime slice.
- Unsupported plan records fail clearly instead of silently falling back to the
  generic loader.

## Implementation Boundaries

The implementation should extract small shared primitives from existing modules
only when those primitives have no no-build-only dependencies.

Allowed shared primitives:

- scheduler queue/destroy behavior
- basic signal storage/subscription behavior
- DOM write helpers for planned bindings
- event command built-ins
- locator resolution
- lazy exact-module resolver
- strict descriptor validation

Do not make runtime slices import:

- `app.js`
- the generic `Loader(...)`
- router creation
- server proxy or server registry
- partial registry
- cache registry
- component registry
- boundary receiver
- generic lazy descriptor inference
- snapshot DOM scanning

If a shared primitive currently lives in a broad module that imports too much,
split the primitive into a lower-level module before importing it from a runtime
slice.

## Verification

Required verification before release:

- Unit tests for `startSignals`, binding updates, and `stop()`.
- Unit tests for `startEvents`, delegated matching, built-in commands, lazy
  handlers, signal writes, and `stop()`.
- Unit tests for strict handler descriptors, including exact `browserImport`,
  exact `exportName`, version-query validation, and no dynamic descriptor
  inference.
- A composed `start(...)` test proving startup order and reverse-order teardown.
- Export-map tests for `@async/framework/runtime`,
  `@async/framework/runtime/signals`, and `@async/framework/runtime/events`.
- Packed-install smoke tests from a temp project, not only checkout-local
  imports.
- Bundle-size scenario tests for runtime-slice fixtures.
- Regression tests proving the existing `Async` API and browser bundle still
  work.

## Open Decisions

- Whether locators should remain selector-only or add generated structural DOM
  paths in plan version 2.
- Whether runtime slice plans should be embedded as JSON script tags, imported
  modules, or both.
- Whether `startEvents` should expose a public `dispatch(event)` method in v1
  or keep it test-only.
- Whether async signals are a separate `runtime/async-signals` slice or part of
  a future `runtime/signals` v2.
- Whether router, boundary, server, and partial slices should compose through
  root `start(...)` or require explicit host code.
