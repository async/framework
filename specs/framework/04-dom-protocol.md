# DOM Protocol

Reference file for [Async Framework](../framework.md). This file owns HTML
attributes, scanning, binding, command dispatch, custom prefixes, and boundary
targeting.

## Purpose

Async HTML must be readable as a protocol. A document should declare where an
app is active, which state drives DOM updates, which commands handle events, and
which regions can be swapped or resumed.

## Responsibilities

- Scan roots and fragments for Async protocol attributes.
- Bind signals to text, values, attributes, properties, and classes.
- Bind DOM events to handler command chains.
- Run lifecycle pseudo-events.
- Track and clean DOM bindings by scope.
- Locate boundaries and replace their contents.
- Support alternate data-attribute prefixes for hosts that cannot use colon
  attributes.

## Public Contract

Default protocol attributes include:

- `async:container`
- `async:boundary`
- `async:component`
- `async:loading`, `async:ready`, `async:error`
- `async:snapshot`
- `signal:text`, `signal:value`, `signal:attr:*`, `signal:prop:*`,
  `signal:class`
- `class:*`
- `on:*`
- `intersect:*`

`Loader({ root, ... }).start()` scans a root. `loader.scan(fragment)` scans
newly inserted content. `loader.swap(boundary, html, options?)` validates and
targets a boundary synchronously, then schedules replacement or morph work in
the scheduler commit phase and rescans inserted element roots by default.
`strategy: "morph"` is an opt-in boundary update strategy for stable shell
markup: it preserves
matching nodes by `async:key`, `data-key`, `id`, or sibling order and tag name,
then cleans up removed or replaced nodes. `scan: "full"` scans the boundary
element and its subtree, while `scan: "none"` leaves inserted content inert
until a later explicit scan.
Config-first `loader.swap(...)` supports `type: "ifChanged"` to skip unchanged
serialized HTML, `type: "many"` to apply multiple boundary updates before
scanning, and `type: "bind"` to track signal reads made while rendering.
`type: "many"` supports `scan: "once"` as a batched auto-scan mode and
`ifChanged: true` to skip per-boundary replacement when each entry's serialized
HTML is unchanged. `type: "many"` updates may be plain HTML or per-entry objects
with `{ html, strategy, attach }`. `type: "bind"` accepts an explicit `deps`
array of signal paths so render-time reads do not expand refresh dependencies.
`strategy: "morph"` accepts `attach: "preserve"` (default) or `attach: "rebind"`
to control whether preserved `on:attach` nodes rerun attach handlers after morph.
`loader.defineRefreshPlan(...)` maps logical refresh scopes to boundary groups,
and `loader.refresh(scope)` applies a batched `many` swap with unchanged-aware
defaults. Protocol bindings inserted by a bound swap still update in place and
do not become refresh dependencies unless the render function reads the signal
itself or the path is listed in `deps`.

`Async.loader.scan(...)`, `Async.loader.swap(...)`, `Async.loader.refresh(...)`,
and `Async.loader.attach(...)` are promise-returning app-level facade methods.
They queue until a concrete runtime loader exists. `Async.loader.swap(...)` and
refresh calls that perform swaps resolve only after the scheduled commit,
inserted-DOM scan and binding, and post-commit flush complete.

## Subsystem Boundaries

- The DOM protocol reads registry IDs and signal paths; it does not own the
  registry declarations.
- The handler registry executes command chains.
- The signal registry reads and writes state.
- The component system may emit protocol attributes in rendered fragments.
- The boundary receiver and router call loader swaps for replacement.
- The app-level loader facade may buffer work before bootstrap, but it delegates
  replacement to the concrete loader and waits for commit completion when it
  returns a promise to app code.

## Protocol Contract

Attribute semantics:

- `signal:text` sets text content from a signal path.
- `signal:value` binds form value and writes user edits back to the signal.
- `signal:attr:*` updates attributes.
- `signal:prop:*` updates DOM properties.
- `class:name` toggles one class from a signal path.
- `signal:class` applies aggregate class values from strings, objects, arrays,
  or refs.
- `on:event` dispatches semicolon-separated command chains.
- `server.id(...)` commands call the active server namespace.
- `$value`, `$checked`, `$form`, `$dataset`, `$event`, and `$el` are event
  locals, with raw DOM locals forbidden for server transport.

Custom attribute prefixes must preserve the same semantics.

## Resume Contract

DOM resume means existing HTML becomes live by scanning:

- Already-rendered elements keep their DOM identity.
- Event listeners attach through protocol attributes.
- Signal bindings update in place.
- Replacement boundary swaps clean old scoped resources and rescan new content
  unless the caller explicitly disables scanning.
- Morph boundary swaps preserve matching nodes, clean removed or replaced
  scoped resources, and scan changed or inserted roots by default.
- Preserved `on:attach` nodes skip re-attach unless the swap uses
  `attach: "rebind"`. The loader warns in development when morph preserves an
  `on:attach` node but removes listener-bearing descendants.
- `async:component` attaches a registered component into an element during scan.
- A direct child `<template async:children>` under an `async:component` host is
  captured as explicit source children before the component replaces the host
  children. Ordinary host content is not captured implicitly.
- Loader facade queues preserve operation order before bootstrap and flush into
  normal scan, swap, and attach behavior after root attachment.
- Repeated scans are idempotent for already-bound event and signal attributes.

## Invariants

- Inline command attributes are not JavaScript.
- Binding updates do not require a virtual node or component rerender.
- Boundary replacement owns cleanup for removed children before inserting new
  content.
- Missing boundaries fail at swap time.
- The loader must not silently ignore malformed command or binding targets when
  they are needed to run behavior.

## Failure Modes

- Missing delegated handlers reject direct calls with
  `handler-not-registered`; event-driven calls use the diagnostics reporting
  contract.
- Missing boundaries throw `boundary-not-found` when a swap targets them.
- Missing boundaries in queued facade swaps reject that queued operation without
  blocking later queued operations.
- Invalid command chains fail before partially running unsupported commands.
- Server commands reject raw DOM locals before transport.
- `async:children` on a non-template direct child of an `async:component` host
  throws before attaching the component.
- Multiple direct child `<template async:children>` nodes under one
  `async:component` host throw before choosing a source.
- Destroyed loaders reject scanning and swapping.

## Acceptance Criteria

- A root scan binds signal text, value, attribute, property, and class updates.
- Input changes write back through `signal:value`.
- Command chains run sequentially and can include built-ins and server calls.
- A replacement boundary swap removes old scoped bindings, inserts new HTML,
  rescans newly inserted content by default, and leaves delegated handlers
  working.
- A morph boundary swap preserves stable shell nodes while binding inserted
  handlers and signal attributes and cleaning up nodes that leave the boundary.
- Data-attribute prefixes behave the same as the default colon attributes.

## Open Or Deferred Decisions

- Broader build-time diagnostics for malformed protocol attributes beyond the
  initial runtime command and registration codes.
- Whether scoped selector helpers should be added for boundary discovery.
- How much protocol metadata future compilers should inline into HTML.
- Whether custom element wrappers should become part of the stable DOM
  protocol or remain optional helpers.
