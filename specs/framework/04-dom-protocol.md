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
newly inserted content. `loader.swap(boundary, html)` replaces a boundary and
rescans the inserted fragment.

`Async.loader.scan(...)`, `Async.loader.swap(...)`, and
`Async.loader.mount(...)` are promise-returning app-level facade methods. They
queue until a concrete runtime loader exists, then delegate to the same
synchronous loader operations.

## Subsystem Boundaries

- The DOM protocol reads registry IDs and signal paths; it does not own the
  registry declarations.
- The handler registry executes command chains.
- The signal registry reads and writes state.
- The component system may emit protocol attributes in rendered fragments.
- The boundary receiver and router call loader swaps for replacement.
- The app-level loader facade may buffer work before bootstrap, but it does not
  change boundary replacement semantics once a concrete loader exists.

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
- Boundary swaps clean old scoped resources and rescan new content.
- `async:component` mounts a registered component into an element during scan.
- A direct child `<template async:children>` under an `async:component` host is
  captured as explicit source children before the component replaces the host
  children. Ordinary host content is not captured implicitly.
- Loader facade queues preserve operation order before bootstrap and flush into
  normal scan, swap, and mount behavior after root attachment.
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

- Missing delegated handlers dispatch an Async error event or reject through the
  handler path.
- Missing boundaries throw when a swap targets them.
- Missing boundaries in queued facade swaps reject that queued operation without
  blocking later queued operations.
- Invalid command chains fail before partially running unsupported commands.
- Server commands reject raw DOM locals before transport.
- `async:children` on a non-template direct child of an `async:component` host
  throws before mounting the component.
- Multiple direct child `<template async:children>` nodes under one
  `async:component` host throw before choosing a source.
- Destroyed loaders reject scanning and swapping.

## Acceptance Criteria

- A root scan binds signal text, value, attribute, property, and class updates.
- Input changes write back through `signal:value`.
- Command chains run sequentially and can include built-ins and server calls.
- A boundary swap removes old scoped bindings, inserts new HTML, rescans it, and
  leaves delegated handlers working.
- Data-attribute prefixes behave the same as the default colon attributes.

## Open Or Deferred Decisions

- Public diagnostics for malformed protocol attributes.
- Whether scoped selector helpers should be added for boundary discovery.
- How much protocol metadata future compilers should inline into HTML.
- Whether custom element wrappers should become part of the stable DOM
  protocol or remain optional helpers.
