import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasOptimizerErrors,
  lowerSuspenseReveal
} from "../../src/build-optimizer.js";
import fixture from "../fixtures/build-optimizer/suspense-reveal.json" with { type: "json" };

test("Suspense and Reveal lower into deterministic stream boundary records", () => {
  const result = lowerSuspenseReveal(fixture);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(
    result.artifact.suspenseBoundaries.map((boundary) => boundary.boundaryId),
    ["profile", "timeline"]
  );
  assert.deepEqual(result.artifact.revealGroups[0], {
    groupId: "home:reveal",
    order: "forwards",
    tail: "collapsed",
    boundaryIds: ["profile", "timeline"],
    arrivalOrder: ["timeline", "profile"],
    commitOrder: ["profile", "timeline"]
  });
  assert.deepEqual(result.artifact.revealGroups[1].commitOrder, ["timeline", "profile"]);
});

test("invalid reveal order and malformed nesting are diagnostics", () => {
  const result = lowerSuspenseReveal(fixture.invalidPolicy);

  assert.deepEqual(result.artifact.revealGroups, []);
  assert.deepEqual(result.diagnostics.map((diagnostic) => diagnostic.code).sort(), [
    "invalid-reveal-policy",
    "malformed-reveal-nesting"
  ]);
});
