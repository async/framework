# Authoring Model

Reference file for [Async Framework](../framework.md). This file owns how
developers express Async applications before and after compiler layers exist.

## Purpose

Async should begin with HTML-first authoring and explicit registered behavior.
The same authoring protocol should also be a compiler target, so future source
forms can lower into Async without changing runtime semantics.

## Responsibilities

- Keep the baseline app model usable from plain HTML and JavaScript modules.
- Separate declarative HTML protocol from imperative registered behavior.
- Make registry IDs the bridge between markup, runtime declarations, server
  functions, partials, components, and future generated modules.
- Ensure future authoring systems compile into observable protocol artifacts.

## Public Contract

Baseline authoring uses:

- HTML attributes for containers, bindings, events, lifecycle, and boundaries.
- JavaScript modules that call `Async.use(...)`, `defineApp(...)`, or registry
  factories.
- Registry IDs that appear in markup and declarations.
- `html` templates and component functions for scoped fragments when authors
  need reusable view pieces.
- Declarative component hosts, signal and class bindings, command events,
  slots, partials, and boundaries for ordinary feature behavior.

Inline command strings are not JavaScript. They are protocol references to
registered commands and server calls.

## Subsystem Boundaries

- Markup expresses protocol references, not arbitrary code.
- Registries own executable functions and lazy descriptors.
- Components own scoped fragment authoring, not a virtual node model.
- Server functions own privileged server behavior.
- Future compilers own source transforms, static analysis, and module splitting.

## Protocol Contract

Authoring must produce protocol artifacts that can be inspected:

- Markup references stable IDs and paths.
- App declarations are grouped by registry type.
- Future compiler output must emit the same registry, snapshot, boundary, and
  lazy-descriptor shapes that no-build apps can understand.
- Generated protocol must remain meaningful without requiring source maps or
  original component source.

## Resume Contract

The authoring model must keep resume possible:

- Browser activation must be able to attach behavior from markup and
  declarations without rerunning component authoring code for existing DOM.
- Future compiler layers must extract the behavior needed for resumed events,
  boundary updates, and async work into lazy or registered artifacts.
- Authoring conveniences must not create hidden dependencies on closure
  serialization that the protocol cannot represent.

## Invariants

- HTML remains the lowest shared representation.
- Registry IDs are stable protocol names, not incidental function names.
- Inline commands never use `eval`, assignment, branching, arithmetic, or
  inline `await`.
- Future JSX/TSRX or other authoring forms are optional layers, not required
  for runtime protocol apps.
- Authoring sugar must lower to explicit runtime behavior.
- Global selector-driven feature code, document-level feature listeners, and
  `innerHTML` rendering are not the default app model. Imperative DOM work is
  isolated to scoped lifecycle handlers or named platform adapters.

## Failure Modes

- Unknown registry IDs fail when the owning subsystem resolves them.
- Invalid inline command syntax fails before running user behavior.
- Non-serializable server arguments fail before transport.
- Author-facing failures expose stable diagnostic codes and correction hints
  without serializing arbitrary application values.
- Compiler-generated artifacts that cannot be expressed through protocol shapes
  are invalid Async output.

## Acceptance Criteria

- A counter can be authored with HTML plus `Async.use({ signal, handler })`.
- A form can call a registered server command without embedding JavaScript in
  the HTML attribute.
- A component can create scoped local signals and handlers while still emitting
  protocol attributes.
- A registered root component can start through `async:component` without a
  global selector or imperative attach call.
- Future compiler output can be described as generated protocol, not as a
  separate runtime architecture.

## Open Or Deferred Decisions

- Which higher authoring language becomes the first official compiler target.
- How generated registry IDs are named, displayed, and debugged.
- Whether author-facing build tools should expose protocol artifacts directly.
- How strict future compiler diagnostics should be around unsupported dynamic
  authoring forms.
