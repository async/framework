import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  OPTIMIZER_ARTIFACT_VERSION,
  OPTIMIZER_PASSES,
  createOptimizerArtifactSet,
  hasOptimizerErrors
} from "../src/build-optimizer.js";
import invalidFixture from "./fixtures/build-optimizer/invalid-runtime-selection.json" with { type: "json" };
import runtimeFixture from "./fixtures/build-optimizer/runtime-selection.json" with { type: "json" };

const bannedRuntimeImports = [
  "app.js",
  "loader.js",
  "router.js",
  "server.js",
  "cache.js",
  "partials.js",
  "components.js",
  "boundary-receiver.js"
];

test("optimizer artifact set exposes every ADR 26 pass artifact and report", () => {
  const result = createOptimizerArtifactSet(runtimeFixture);

  assert.equal(result.version, OPTIMIZER_ARTIFACT_VERSION);
  assert.deepEqual(result.passes, [
    "source-inventory",
    "jsx-semantic-graph",
    "signal-source-classification",
    "signal-ownership-lifetime",
    "event-symbol-extraction",
    "suspense-reveal-lowering",
    "runtime-slice-selection",
    "handler-emission",
    "plan-bootstrap-emit"
  ]);
  assert.deepEqual(Object.keys(result.artifacts).sort(), [
    "buildEmit",
    "eventSymbols",
    "handlerEmission",
    "jsxSemanticGraph",
    "runtimeSelection",
    "signalOwnership",
    "signalSources",
    "sourceInventory",
    "streamBoundaries"
  ]);
  assert.equal(result.artifacts.buildEmit.report, result.report);
  assert.equal(hasOptimizerErrors(result.diagnostics), false);
});

test("optimizer helpers are inert and do not execute app module hooks", () => {
  let executed = false;
  const result = createOptimizerArtifactSet({
    ...runtimeFixture,
    sourceInventory: {
      ...runtimeFixture.sourceInventory,
      entries: [
        ...runtimeFixture.sourceInventory.entries,
        {
          id: "src/side-effect.jsx",
          target: "browser",
          imports: [],
          execute() {
            executed = true;
          }
        }
      ]
    }
  });

  assert.equal(executed, false);
  assert.equal(hasOptimizerErrors(result.diagnostics), false);
});

test("build optimizer helper does not import no-build runtime systems", () => {
  const source = readFileSync(new URL("../src/build-optimizer.js", import.meta.url), "utf8");
  for (const bannedImport of bannedRuntimeImports) {
    assert.doesNotMatch(source, new RegExp(`from ["'][^"']*${escapeRegExp(bannedImport)}["']`));
  }
  assert.deepEqual(OPTIMIZER_PASSES.length, 9);
});

test("artifact diagnostics reject unsupported build hosts and server-only browser imports", () => {
  const result = createOptimizerArtifactSet(invalidFixture);
  assert.equal(hasOptimizerErrors(result.diagnostics), true);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code).sort(),
    [
      "browser-imports-server-only-code",
      "unsupported-build-host",
      "unsupported-build-host",
      "unsupported-framework-import-shape"
    ]
  );
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
