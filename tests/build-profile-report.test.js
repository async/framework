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
  normalizeAsyncFrameworkLayer,
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
    computed: 1,
    asyncSignal: 1
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
  assert.equal(plugin.config({}, { mode: "development" }), null);
  assert.equal(resolved, "\0virtual:async-framework/generated-plan");
  assert.match(planModule, /export const report = /);
  assert.match(transformed.code, /from "@async\/framework\/runtime"/);
  assert.match(transformed.code, /from "virtual:async-framework\/generated-plan"/);
  assert.match(transformed.code, /export \{ plan, report \}/);
  assert.doesNotMatch(transformed.code, /@async\/framework["']/);
  assert.doesNotMatch(transformed.code, /Async\.start/);
  assert.equal(plugin.getAsyncFrameworkReport().profile, "build-required");
});

test("Vite plugin normalizes layer metadata without changing default config", () => {
  assert.equal(normalizeAsyncFrameworkLayer(1), 1);
  assert.equal(normalizeAsyncFrameworkLayer("1"), 1);
  assert.equal(normalizeAsyncFrameworkLayer(1.5), 1.5);
  assert.equal(normalizeAsyncFrameworkLayer("1.5"), 1.5);
  assert.throws(
    () => normalizeAsyncFrameworkLayer(2),
    /only supports/
  );

  const plugin = asyncFramework({ fixture, layer: "1" });

  assert.equal(plugin.asyncFramework.layer, 1);
  assert.equal(plugin.asyncFramework.report.layer, 1);
  assert.equal(plugin.getAsyncFrameworkReport().layer, 1);
  assert.equal(plugin.config({}, { mode: "development" }), null);
});

test("Vite plugin configures client asset builds only in client mode", () => {
  const plugin = asyncFramework({
    client: {
      entry: "src/client.ts",
      outDir: "public/static"
    }
  });

  assert.equal(plugin.config({}, { mode: "development" }), null);
  assert.deepEqual(plugin.config({}, { mode: "client" }), {
    build: {
      outDir: "public/static",
      copyPublicDir: false,
      rollupOptions: {
        input: "src/client.ts",
        output: {
          entryFileNames: "client.js"
        }
      }
    }
  });
  assert.deepEqual(plugin.config({
    build: {
      outDir: "public/assets",
      rollupOptions: {
        input: "app/main.js",
        output: {
          entryFileNames: "main.[hash].js"
        }
      }
    }
  }, { mode: "client" }), {
    build: {
      outDir: "public/assets",
      copyPublicDir: false,
      rollupOptions: {
        input: "app/main.js",
        output: {
          entryFileNames: "main.[hash].js"
        }
      }
    }
  });
});

test("Vite plugin composes Hono dev server when server options are enabled", async () => {
  const imported = [];
  const pluginOption = asyncFramework({
    server: {
      entry: "src/server.js"
    },
    _importModule: async (id) => {
      imported.push(id);
      return {
        default(options) {
          return {
            name: "fake-hono-dev-server",
            options
          };
        }
      };
    }
  });

  assert.equal(Array.isArray(pluginOption), true);
  const [plugin, honoPluginPromise] = pluginOption;
  assert.deepEqual(plugin.config({}, { mode: "development" }), {
    appType: "custom"
  });
  assert.equal(plugin.config({ appType: "spa" }, { mode: "development" }), null);

  const honoPlugin = await honoPluginPromise;
  assert.deepEqual(imported, ["@hono/vite-dev-server"]);
  assert.equal(honoPlugin.name, "fake-hono-dev-server");
  assert.deepEqual(honoPlugin.options, {
    entry: "src/server.js",
    injectClientScript: true,
    base: "/"
  });
});

test("Vite plugin rejects server target until production targets are explicit", () => {
  assert.throws(
    () => asyncFramework({ server: { target: "vercel" } }),
    /does not accept server\.target/
  );
});

test("Vite plugin reports missing Hono dev dependencies with an app install hint", async () => {
  const [, honoPluginPromise] = asyncFramework({
    server: true,
    _importModule: async () => {
      throw new Error("missing package");
    }
  });

  await assert.rejects(
    honoPluginPromise,
    /requires Hono dev dependencies/
  );
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
