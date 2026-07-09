import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifySignalSources,
  hasOptimizerErrors,
  inferSignalOwnership
} from "../../src/build-optimizer.js";
import fixture from "../fixtures/build-optimizer/signals.json" with { type: "json" };

test("signal source classification splits writable, computed, and asyncSignal sources", () => {
  const result = classifySignalSources(fixture.valid);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(result.artifact.sources, [
    {
      kind: "writable",
      sourceId: "count",
      initialValue: 0
    },
    {
      kind: "computed",
      sourceId: "doubleCount",
      dependencies: [{ sourceId: "count" }]
    },
    {
      kind: "asyncSignal",
      sourceId: "user",
      dependencies: [{ sourceId: "userId" }],
      latest: true,
      pending: true,
      error: true,
      versioned: true,
      stream: "default"
    }
  ]);
});

test("maybe-promise signal sources fail instead of silently becoming async", () => {
  const result = classifySignalSources(fixture.maybePromise);

  assert.deepEqual(result.artifact.sources, []);
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code), [
    "maybe-promise-signal-source"
  ]);
});

test("signal ownership records app, shared module, and component lifetimes", () => {
  const result = inferSignalOwnership(fixture.valid);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(result.artifact.ownership.map((decision) => [decision.sourceId, decision.owner]), [
    ["count", "app"],
    ["doubleCount", "component"],
    ["user", "shared-module"]
  ]);
});

test("ambiguous or event-handler signal lifetimes are diagnostics", () => {
  const result = inferSignalOwnership(fixture.invalidOwnership);

  assert.deepEqual(result.artifact.ownership, []);
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code).sort(), [
    "ambiguous-signal-owner",
    "invalid-handler-signal-lifetime"
  ]);
});
