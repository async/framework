import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractEventSymbols,
  hasOptimizerErrors,
  normalizeEventProtocol,
  planHandlerEmission
} from "../src/build-optimizer.js";
import fixture from "./fixtures/build-optimizer/events.json" with { type: "json" };

test("JSX event props become event commands and handler symbols before chunking", () => {
  const result = extractEventSymbols(fixture.eventProps);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(result.artifact.events.map((event) => [
    event.sourceProp,
    event.sourceSyntax,
    event.protocolProp,
    event.eventType,
    event.handlerId
  ]), [
    ["onClick", "jsx-event-prop", "on:click", "click", "increment"],
    ["onInput", "jsx-event-prop", "on:input", "input", "writeName"],
    ["onPointerEnter", "jsx-event-prop", "on:pointer-enter", "pointer-enter", "warmProfile"]
  ]);
  assert.deepEqual(result.artifact.events[0].commands, [
    ["preventDefault"],
    ["handler", "increment"]
  ]);
});

test("event normalization preserves source spelling and canonical protocol output", () => {
  const result = normalizeEventProtocol(fixture.eventProps);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(result.artifact.events.map((event) => [
    event.sourceProp,
    event.sourceSyntax,
    event.protocolProp,
    event.eventType
  ]), [
    ["onClick", "jsx-event-prop", "on:click", "click"],
    ["onInput", "jsx-event-prop", "on:input", "input"],
    ["onPointerEnter", "jsx-event-prop", "on:pointer-enter", "pointer-enter"]
  ]);
});

test("runtime and compatibility profiles accept protocol event props", () => {
  const runtime = normalizeEventProtocol(fixture.runtimeEventProps);
  const compat = normalizeEventProtocol(fixture.compatEventProps);

  assert.equal(hasOptimizerErrors(runtime.diagnostics), false);
  assert.deepEqual(runtime.artifact.events.map((event) => [event.sourceProp, event.protocolProp]), [
    ["on:click", "on:click"]
  ]);
  assert.equal(hasOptimizerErrors(compat.diagnostics), false);
  assert.deepEqual(compat.artifact.events.map((event) => [event.sourceProp, event.protocolProp]), [
    ["onClick", "on:click"],
    ["on:input", "on:input"]
  ]);
});

test("handler emission preserves direct-import and inline modes without forcing dynamic imports", () => {
  const events = extractEventSymbols(fixture.eventProps).artifact;
  const result = planHandlerEmission(events.handlers);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(result.artifact.handlers, [
    {
      mode: "direct-import",
      symbolId: "increment",
      module: "./counter.js"
    },
    {
      mode: "inline",
      symbolId: "writeName"
    },
    {
      mode: "lazy-chunk",
      symbolId: "warmProfile",
      chunk: "profile-warm.js",
      preload: true
    }
  ]);
});

test("no-build event syntax in JSX is rejected without explicit compatibility mode", () => {
  const result = extractEventSymbols(fixture.invalidNoBuildSyntax);

  assert.deepEqual(result.artifact.events, []);
  assert.deepEqual(result.diagnostics.map((diagnostic) => [
    diagnostic.code,
    diagnostic.sourceProp,
    diagnostic.protocolProp,
    diagnostic.selectedProfile
  ]), [
    ["no-build-event-syntax-in-jsx", "on:click", "on:click", "buildtime"]
  ]);
});

test("runtime profile rejects JSX-native event props unless compatibility is selected", () => {
  const result = normalizeEventProtocol(fixture.invalidRuntimeSyntax);

  assert.deepEqual(result.artifact.events, []);
  assert.deepEqual(result.diagnostics.map((diagnostic) => [
    diagnostic.code,
    diagnostic.sourceProp,
    diagnostic.protocolProp,
    diagnostic.selectedProfile
  ]), [
    ["jsx-event-syntax-in-runtime-profile", "onClick", "on:click", "runtime"]
  ]);
});

test("duplicate canonical event props are diagnostics with no overwrite", () => {
  const result = normalizeEventProtocol(fixture.duplicateCanonicalEvents);

  assert.deepEqual(result.artifact.events.map((event) => [event.eventId, event.protocolProp, event.handlerId]), [
    ["click:jsx", "on:click", "increment"]
  ]);
  assert.deepEqual(result.diagnostics.map((diagnostic) => [
    diagnostic.code,
    diagnostic.sourceProp,
    diagnostic.protocolProp,
    diagnostic.duplicateOf
  ]), [
    ["duplicate-canonical-event", "on:click", "on:click", "click:jsx"]
  ]);
});

test("lazy handler emission reports when synchronous event APIs would be lost", () => {
  const events = extractEventSymbols(fixture.invalidLazySemantics).artifact;
  const result = planHandlerEmission(events.handlers);

  assert.deepEqual(result.artifact.handlers, []);
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code), [
    "handler-emission-loses-event-semantics"
  ]);
});
