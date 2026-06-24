# Component System

Reference file for [Async Framework](../framework.md). This file owns scoped
fragment components, helper APIs, lifecycle hooks, visibility/intersection
behavior, child rendering, and cleanup.

## Purpose

Components provide reusable scoped fragments without introducing a virtual node
model or a component rerender loop. They should produce HTML protocol output and
scoped registry entries that the loader can scan and clean up.

## Responsibilities

- Define component functions through `component(...)`.
- Render component output to HTML fragments or templates.
- Provide scoped helpers for local signals, computed values, async signals,
  handlers, effects, child rendering, suspense templates, and lifecycle hooks.
- Schedule attach, visible, intersect, effect, and cleanup work through runtime
  systems.
- Release scoped handlers, signals, inline bindings, observers, and scheduler
  scopes when a fragment is destroyed.

## Public Contract

Component helpers include:

- `this.signal(name, initial)` and `this.signal(initial)`.
- `this.computed(name, fn)`.
- `this.asyncSignal(name, fn)`.
- `this.effect(fn)`.
- `this.handler(name, fn)` and `this.handler(fn)`.
- `this.render(Component, props, children?)`.
- `this.slot(Component, propsOrFn)`.
- `this.suspense(signalRef, views)`.
- `this.on(event, fn)` with `attach`, `visible`, `intersect`, and `destroy`
  behavior.
- `this.onAttach(fn)` and `this.onVisible(fn)` lifecycle helpers.
- `this.onMount(fn)` remains a compatibility alias for `this.onAttach(fn)` and
  warns when used.
- `this.intersect(element, options, fn)` for direct element observation.

Components return HTML-compatible values. Promise-returning components are not
part of the synchronous component contract.

Default children are framework-owned scoped fragments. The canonical no-build
form is `this.render(Component, props, children)`, and the child component
receives the normalized fragment as `props.children`. The child consumes the
fragment by interpolating `children` in an `html` template; it does not call a
children callback directly.

Registered no-build component hosts may pass default children with a direct
child `<template async:children>`. The loader captures that template before
mounting the component and passes it through the same children fragment
contract. Ordinary host inner HTML is never captured implicitly.

Children fragments are lazy when supplied as factories, caller-lexical through
closed-over values, single-consumption by default, escaped as text for strings,
and cleaned up with the consuming component fragment. Supplying both
`props.children` and the third `this.render(...)` argument is invalid.

Lifecycle fallback hooks are scoped to the component fragment that registered
them. A component mounted directly with `loader.mount(target, Component)`
receives the mount target. A child rendered through `this.render(Child)`
receives its own single element root when one exists. If the child returns text
or multiple root nodes, the fallback target is the nearest containing element.
`this.onVisible(...)` and `this.on("intersect", ...)` observe the same scoped
target.

## Subsystem Boundaries

- Components create scoped declarations; registries own their storage and
  lookup.
- Components render fragments; the loader inserts, scans, and swaps DOM.
- Lifecycle scheduling belongs to the scheduler.
- Visibility and intersection observation belongs to loader-owned DOM helpers.
- Async data loading belongs to async signals or partial/server systems, not to
  async component rendering.

## Protocol Contract

Components emit the same protocol as hand-authored HTML:

- Event handlers become registered IDs referenced by `on:*`.
- Local signals become scoped signal IDs referenced by `signal:*` or `class:*`.
- Suspense helpers emit boundary templates and do not own wrapper elements.
- Child rendering returns fragment output that remains scannable by the loader.
- Default children interpolate through the same template renderer so escaping,
  nested component rendering, handler registration, signal bindings, and cleanup
  stay in one scoped path.
- Captured `<template async:children>` content is inserted and scanned only when
  the component interpolates `children`.
- Slots mount a child component into an attached DOM target and may recompute
  props from signals without exposing loader mounting to application code.

## Resume Contract

Components must not be required to rerun to activate server-rendered DOM:

- Protocol attributes inside component output are the resume surface.
- Scoped cleanup metadata must be associated with mounted fragments when the
  component rendered in the browser.
- Future compiler layers may precompute component protocol artifacts for
  already-rendered DOM instead of calling component bodies on browser resume.
- Boundary swaps must dispose component scopes beneath the replaced boundary.

## Invariants

- Components are scoped fragments, not virtual nodes.
- Component output does not cause a component rerender loop.
- Default children do not create a parent rerender path or runtime JSX node
  array.
- Default children and slots are separate primitives: children are mount-time
  projection; slots are explicit attached child replacement.
- Slot updates are explicit child component replacement, not parent rerendering.
- Component-local state and handlers are unregistered on fragment cleanup.
- `on:visible` is a one-shot visibility lifecycle hook.
- `on:intersect` and `this.intersect(...)` are continuous observation paths
  with explicit cleanup.

## Failure Modes

- Non-function component definitions fail.
- Promise-returning components fail with a clear unsupported-component error.
- Lazy component descriptors that resolve asynchronously are not valid for
  synchronous render paths unless a future async component contract defines it.
- Invalid suspense inputs fail before emitting ambiguous boundary markup.
- Supplying children through both `props.children` and the third render
  argument fails before the child component renders.
- Consuming the same children fragment twice fails instead of duplicating
  handler IDs or cleanup records.
- Non-template direct `async:children` markers and multiple direct children
  templates under one `async:component` host fail before mount.
- Observer-less environments report unsupported intersection behavior through
  the defined fallback path.

## Acceptance Criteria

- A component can create scoped local signals and handlers, render them into
  protocol attributes, and update DOM after mounting.
- Attach, visible, intersect, and destroy hooks run in deterministic scheduler
  phases.
- Component cleanup removes scoped handlers, scoped signals, inline bindings,
  observers, and pending scoped scheduler work.
- `this.suspense(...)` emits loading, ready, and error templates for an async
  signal without creating a wrapper element.
- Multiple child components with identical hook bodies do not dedupe each
  other incorrectly.
- Static and lazy default children render through `this.render(...)`, preserve
  escaping, support nested component output, and clean up scoped child resources
  when the consuming fragment is destroyed.
- Registered `async:component` hosts can pass explicit template children,
  avoid treating ordinary host content as source children, and rescan inserted
  child protocol attributes after interpolation.

## Open Or Deferred Decisions

- Whether async components should exist as a separate partial-like contract.
- Compiler ownership of component-scope ID generation.
- Public component devtools and scope inspection.
- Whether component output should gain stricter template validation.
