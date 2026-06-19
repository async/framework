import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  checkScenarioSizeReceipt,
  createScenarioSizeReceipt
} from "../scripts/scenario-size.js";
import baseline from "./fixtures/scenario-size-baseline.json" with { type: "json" };

test("scenario-size receipt reports raw and gzip bytes for current fixtures", async () => {
  const receipt = await createScenarioSizeReceipt();
  assert.equal(receipt.version, 1);
  assert.equal(receipt.package, "@async/framework");
  assert.deepEqual(receipt.scenarios.map((scenario) => scenario.id), [
    "boundary-receiver",
    "events-counter",
    "router-basic",
    "runtime-events-counter",
    "runtime-input-writer",
    "runtime-lazy-handler",
    "runtime-signals-counter",
    "server-call-button",
    "signals-counter",
    "stream-backpatch"
  ]);
  for (const scenario of receipt.scenarios) {
    assert.ok(scenario.closure.rawBytes > 0);
    assert.ok(scenario.closure.gzipBytes > 0);
    assert.ok(scenario.scripts.length >= 2);
  }
});

test("scenario-size check compares current values to deterministic baselines", async () => {
  const receipt = await createScenarioSizeReceipt();
  assert.doesNotThrow(() => checkScenarioSizeReceipt(receipt, baseline));
});

test("scenario-size receipt handles multiple emitted scripts per scenario", async () => {
  const root = await mkdtemp(join(tmpdir(), "async-framework-scenario-size-"));
  const examplesRoot = join(root, "examples", "size");
  const scenarioRoot = join(examplesRoot, "multi-script");
  await mkdir(scenarioRoot, { recursive: true });
  await writeFile(join(scenarioRoot, "scenario.json"), JSON.stringify({
    id: "multi-script",
    entry: "entry.js",
    scripts: ["entry.js", "chunk.js"]
  }), "utf8");
  await writeFile(join(scenarioRoot, "entry.js"), "import './chunk.js';\nconsole.log('entry');\n", "utf8");
  await writeFile(join(scenarioRoot, "chunk.js"), "console.log('chunk');\n", "utf8");

  const receipt = await createScenarioSizeReceipt({ root, examplesRoot });
  assert.equal(receipt.scenarios[0].scripts.length, 2);
  assert.equal(
    receipt.scenarios[0].closure.rawBytes,
    receipt.scenarios[0].scripts.reduce((sum, script) => sum + script.rawBytes, 0)
  );
});

test("scenario-size receipt fails on missing scenario output", async () => {
  const root = await mkdtemp(join(tmpdir(), "async-framework-missing-scenario-"));
  const examplesRoot = join(root, "examples", "size");
  const scenarioRoot = join(examplesRoot, "missing-script");
  await mkdir(scenarioRoot, { recursive: true });
  await writeFile(join(scenarioRoot, "scenario.json"), JSON.stringify({
    id: "missing-script",
    entry: "main.js",
    scripts: ["main.js"]
  }), "utf8");

  await assert.rejects(
    () => createScenarioSizeReceipt({ root, examplesRoot }),
    /ENOENT/
  );
});
