import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  OPTIMIZER_ARTIFACT_VERSION,
  OPTIMIZER_PASSES,
  createOptimizerArtifactSet,
  hasOptimizerErrors
} from "../src/build-optimizer.js";
import childrenFixture from "./fixtures/build-optimizer/children.json" with { type: "json" };
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
    "event-normalization",
    "jsx-children-fragment-lowering",
    "signal-source-classification",
    "signal-ownership-lifetime",
    "event-symbol-extraction",
    "suspense-reveal-lowering",
    "runtime-slice-selection",
    "handler-emission",
    "plan-bootstrap-emit"
  ]);
  assert.ok(
    result.passes.indexOf("event-normalization") < result.passes.indexOf("signal-source-classification")
  );
  assert.ok(
    result.passes.indexOf("event-normalization") < result.passes.indexOf("runtime-slice-selection")
  );
  assert.deepEqual(Object.keys(result.artifacts).sort(), [
    "buildEmit",
    "childrenFragments",
    "eventNormalization",
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
  assert.deepEqual(result.artifacts.eventNormalization.events.map((event) => [
    event.sourceProp,
    event.protocolProp
  ]), [
    ["onClick", "on:click"]
  ]);
  assert.deepEqual(result.artifacts.signalSources.sources.map((source) => source.kind), [
    "writable",
    "computed",
    "asyncSignal"
  ]);
  assert.deepEqual(result.report.children.fragments, { empty: 0, static: 0, lazy: 0 });
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
  assert.deepEqual(OPTIMIZER_PASSES.length, 11);
});

test("JSX children lowering records static and lazy Children fragments", () => {
  const result = createOptimizerArtifactSet(childrenFixture);

  assert.equal(hasOptimizerErrors(result.diagnostics), false);
  assert.deepEqual(result.artifacts.childrenFragments.fragments, [
    {
      fragmentId: "Card:empty",
      componentId: "Card",
      mode: "empty",
      lowersTo: "undefined",
      runtimeRepresentation: "undefined"
    },
    {
      fragmentId: "Card:static",
      componentId: "Card",
      mode: "static",
      lowersTo: "Children",
      runtimeRepresentation: "html-fragment",
      childIds: ["copy:status", "node:p"],
      reasons: []
    },
    {
      fragmentId: "Card:lazy",
      componentId: "Card",
      mode: "lazy",
      lowersTo: "Children",
      runtimeRepresentation: "lazy-children-factory",
      childIds: ["Badge", "statusSignal", "click:details"],
      reasons: ["Badge", "statusSignal", "click:details"]
    }
  ]);
  assert.deepEqual(result.report.children.fragments, { empty: 1, static: 1, lazy: 1 });
});

test("JSX children lowering rejects explicit, duplicate, array, and unknown children", () => {
  const result = createOptimizerArtifactSet(childrenFixture.invalid);

  assert.equal(hasOptimizerErrors(result.diagnostics), true);
  assert.deepEqual(
    result.diagnostics.map((diagnostic) => diagnostic.code).sort(),
    [
      "author-written-children-prop",
      "duplicate-jsx-children-source",
      "runtime-jsx-children-array",
      "unknown-jsx-children-resourcefulness"
    ]
  );
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
