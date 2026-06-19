import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BUILD_PROFILE_NAME,
  VIRTUAL_PLAN_ID,
  createBuildProfileReport,
  emitGeneratedPlanModule
} from "../src/build-profile.js";
import {
  asyncFramework,
  validateViteRolldownHost
} from "../src/vite.js";
import fixture from "./fixtures/build-profile/counter-profile.json" with { type: "json" };

test("build profile report selects runtime slices without app hub fallback", () => {
  const profile = createBuildProfileReport(fixture);

  assert.equal(profile.profile, BUILD_PROFILE_NAME);
  assert.equal(profile.failed, false);
  assert.equal(profile.bootstrap.entrypoint, "@async/framework/runtime");
  assert.equal(profile.bootstrap.usesAsyncGlobal, false);
  assert.equal(profile.bootstrap.importsRootAsync, false);
  assert.deepEqual(profile.report.runtime.slices.map((slice) => slice.name), [
    "signals",
    "events",
    "async-signals",
    "stream"
  ]);
  assert.ok(profile.report.runtime.omitted.some((entry) => entry.system === "no-build-loader"));
  assert.deepEqual(profile.report.runtime.fallbacks, []);
  assert.equal(profile.report.generatedLocatorCount, 5);
  assert.deepEqual(profile.report.signals.sources, {
    writable: 1,
    derived: 1,
    async: 1
  });
  assert.deepEqual(profile.plan.signals.values, [["count", 0]]);
  assert.deepEqual(profile.plan.events.events, [[1, "click", [["handler", "increment"]]]]);
});

test("generated plan module is deterministic and inspectable", () => {
  const profile = createBuildProfileReport(fixture);
  const first = emitGeneratedPlanModule(profile);
  const second = emitGeneratedPlanModule(profile);

  assert.equal(first, second);
  assert.match(first, /export const plan = /);
  assert.match(first, /export const report = /);
  assert.doesNotMatch(first, /@async\/framework["']/);
  assert.doesNotMatch(first, /Async\.use/);
});

test("Vite plugin spike exposes virtual plan and bootstrap transform", () => {
  const plugin = asyncFramework({ fixture });
  const jsxSource = readFileSync(new URL("./fixtures/build-profile/Counter.jsx", import.meta.url), "utf8");
  const resolved = plugin.resolveId(VIRTUAL_PLAN_ID);
  const planModule = plugin.load(resolved);
  const transformed = plugin.transform(jsxSource, "/fixtures/Counter.jsx");

  assert.equal(plugin.name, "async-framework");
  assert.equal(resolved, "\0virtual:async-framework/generated-plan");
  assert.match(planModule, /export const report = /);
  assert.match(transformed.code, /from "@async\/framework\/runtime"/);
  assert.match(transformed.code, /from "virtual:async-framework\/generated-plan"/);
  assert.doesNotMatch(transformed.code, /@async\/framework["']/);
  assert.doesNotMatch(transformed.code, /Async\.start/);
  assert.equal(plugin.getAsyncFrameworkReport().profile, "build-required");
});

test("build profile plugin rejects unsupported hosts before output is trusted", () => {
  assert.throws(
    () => validateViteRolldownHost({ name: "vite", version: "7.2.0", engine: "rollup" }),
    /Vite 8\+/
  );
  assert.throws(
    () => validateViteRolldownHost({ name: "rollup", version: "4.0.0", engine: "rollup" }),
    /requires Vite 8\+/
  );
  assert.throws(
    () => asyncFramework({ fixture, host: { name: "vite", version: "8.0.0", engine: "rollup" } }),
    /Rolldown/
  );
});
