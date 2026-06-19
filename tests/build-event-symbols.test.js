import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractEventSymbols,
  hasOptimizerErrors,
  planHandlerEmission
} from "../src/build-optimizer.js";
import fixture from "./fixtures/build-optimizer/events.json" with { type: "json" };

test("JSX event props become event commands and handler symbols before chunking", () => {
  const result = extractEventSymbols(fixture.eventProps);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(result.artifact.events.map((event) => [event.propName, event.eventType, event.handlerId]), [
    ["onClick", "click", "increment"],
    ["onInput", "input", "writeName"],
    ["onPointerEnter", "pointer-enter", "warmProfile"]
  ]);
  assert.deepEqual(result.artifact.events[0].commands, [
    ["preventDefault"],
    ["handler", "increment"]
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
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code), [
    "no-build-event-syntax-in-jsx"
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
