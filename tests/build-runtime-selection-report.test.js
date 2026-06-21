import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RUNTIME_ENTRYPOINTS,
  createOptimizerArtifactSet,
  hasOptimizerErrors
} from "../src/build-optimizer.js";
import fixture from "./fixtures/build-optimizer/runtime-selection.json" with { type: "json" };

test("runtime selection report names selected slices, omissions, and feature counts", () => {
  const result = createOptimizerArtifactSet(fixture);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.equal(result.report.runtime.entrypoint, RUNTIME_ENTRYPOINTS.runtime);
  assert.deepEqual(result.report.runtime.slices.map((slice) => slice.name), [
    "signals",
    "events",
    "async-signals",
    "stream"
  ]);
  assert.ok(result.report.runtime.omitted.some((entry) => entry.system === "no-build-loader"));
  assert.ok(result.report.runtime.omitted.some((entry) => entry.system === "server"));
  assert.deepEqual(result.report.runtime.fallbacks, []);
  assert.deepEqual(result.report.signals.sources, {
    writable: 1,
    computed: 1,
    asyncSignal: 1
  });
  assert.deepEqual(result.report.signals.ownership, {
    app: 1,
    "shared-module": 1,
    component: 1,
    "owner-relative": 0
  });
  assert.equal(result.report.signals.asyncStatus.versioned, 1);
  assert.equal(result.report.events.eventCount, 1);
  assert.equal(result.report.events.handlerCount, 1);
  assert.deepEqual(result.report.handlers.emission, {
    inline: 0,
    "direct-import": 1,
    "eager-chunk": 0,
    "lazy-chunk": 0
  });
  assert.equal(result.report.stream.suspenseBoundaryCount, 2);
  assert.deepEqual(result.report.stream.reveal.byOrder, {
    "as-ready": 0,
    forwards: 1,
    backwards: 0,
    together: 0
  });
  assert.deepEqual(result.report.stream.reveal.byTail, {
    visible: 0,
    collapsed: 1,
    hidden: 0
  });
  assert.equal(result.report.serverOnlyModuleExclusions, 2);
  assert.equal(result.report.generatedLocatorCount, 5);
});

test("runtime selection omits async and stream helpers when artifacts do not require them", () => {
  const result = createOptimizerArtifactSet({
    sourceInventory: fixture.sourceInventory,
    semanticGraph: {
      ...fixture.semanticGraph,
      signals: [
        {
          sourceId: "count",
          sourceShape: "value",
          initialValue: 0,
          owner: "app"
        }
      ],
      eventProps: [],
      suspense: [],
      revealPolicies: []
    }
  });

  assert.equal(result.report.runtime.entrypoint, RUNTIME_ENTRYPOINTS.signals);
  assert.deepEqual(result.report.runtime.slices.map((slice) => slice.name), ["signals"]);
  assert.ok(result.report.runtime.omitted.some((entry) => entry.system === "async-signal-status"));
  assert.ok(result.report.runtime.omitted.some((entry) => entry.system === "stream-boundary-coordination"));
});
