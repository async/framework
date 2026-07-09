// Guardrail for the hot-path registry (hot-paths.json). It keeps the
// "hot path changed → performance contracts re-run" wiring honest:
//
//  1. every registered source and contract file exists;
//  2. every contract file declares the sources it guards in a
//     `// @hot-paths:` header that matches the registry;
//  3. every performance test file is registered (no orphan contracts);
//  4. every registered source appears in the pipeline `test.performance`
//     task inputs, so the pipeline re-runs this suite exactly when a hot
//     path changes;
//  5. the `test:performance` script exists for humans.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const registry = JSON.parse(readFileSync(resolve(repoRoot, "tests/performance/hot-paths.json"), "utf8"));
const entries = registry.hotPaths;

test("hot-path registry entries point at real sources and contracts", () => {
  assert.ok(entries.length > 0, "the hot-path registry must not be empty");
  for (const entry of entries) {
    assert.ok(existsSync(resolve(repoRoot, entry.source)), `hot-path source missing: ${entry.source}`);
    assert.ok(entry.reason?.length > 0, `hot-path entry needs a reason: ${entry.source}`);
    assert.ok(entry.contracts?.length > 0, `hot path has no contracts: ${entry.source}`);
    for (const contract of entry.contracts) {
      assert.ok(existsSync(resolve(repoRoot, contract)), `contract test missing: ${contract} (for ${entry.source})`);
    }
  }
});

test("contract files declare the hot paths they guard", () => {
  for (const entry of entries) {
    for (const contract of entry.contracts) {
      const header = readFileSync(resolve(repoRoot, contract), "utf8")
        .split("\n")
        .find((line) => line.startsWith("// @hot-paths:")) ?? "";
      const declared = header
        .replace("// @hot-paths:", "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      assert.ok(
        declared.includes(entry.source),
        `${contract} must declare "// @hot-paths: ... ${entry.source} ..." (declares: ${declared.join(", ") || "nothing"})`
      );
    }
  }
});

test("every performance test file is registered as a contract", () => {
  const registered = new Set(entries.flatMap((entry) => entry.contracts));
  const files = readdirSync(resolve(repoRoot, "tests/performance"))
    .filter((file) => file.endsWith(".test.js"))
    .filter((file) => file !== "hot-path-coverage.test.js")
    .map((file) => `tests/performance/${file}`);
  for (const file of files) {
    assert.ok(registered.has(file), `orphan performance test not registered in hot-paths.json: ${file}`);
  }
});

test("the pipeline test.performance task re-runs when any hot path changes", () => {
  const pipeline = readFileSync(resolve(repoRoot, "pipeline.ts"), "utf8");
  const taskStart = pipeline.indexOf('"test.performance"');
  assert.ok(taskStart !== -1, 'pipeline.ts must define a "test.performance" task');
  const taskSlice = pipeline.slice(taskStart, pipeline.indexOf("})", taskStart));
  assert.ok(taskSlice.includes("tests/performance/**"), "test.performance inputs must include tests/performance/**");
  for (const entry of entries) {
    assert.ok(
      taskSlice.includes(`"${entry.source}"`),
      `pipeline test.performance inputs must include "${entry.source}" so changes to it re-run this suite`
    );
  }
});

test("a test:performance script exists", () => {
  const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  assert.match(pkg.scripts["test:performance"] ?? "", /tests\/performance/);
});
