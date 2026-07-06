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
  detectViteHost,
  importsAsyncJsx,
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
  assert.deepEqual(profile.report.runtime.slices.map((slice) => slice.status), [
    "available",
    "available",
    "planned",
    "planned"
  ]);
  assert.deepEqual(
    profile.diagnostics
      .filter((diagnostic) => diagnostic.code === "runtime-slice-planned")
      .map((diagnostic) => [diagnostic.severity, diagnostic.value]),
    [["warning", "async-signals"], ["warning", "stream"]]
  );
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
    injectClientScript: true
  });
});

test("Vite plugin forwards server.base only when the app sets it", async () => {
  const [, honoPluginPromise] = asyncFramework({
    server: {
      base: "/admin"
    },
    _importModule: async () => ({
      default(options) {
        return { name: "fake-hono-dev-server", options };
      }
    })
  });

  const honoPlugin = await honoPluginPromise;
  assert.deepEqual(honoPlugin.options, {
    entry: "src/server.js",
    injectClientScript: true,
    base: "/admin"
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

test("configResolved validates the host from plugin-context metadata", () => {
  const plugin = asyncFramework({ fixture });

  // Vite exposes viteVersion (and rolldownVersion under Rolldown) on plugin
  // context meta; a resolved config object carries no host fields.
  assert.throws(
    () => plugin.configResolved.call({ meta: { viteVersion: "7.2.0" } }, { command: "serve" }),
    /Vite 8\+/
  );
  plugin.configResolved.call({ meta: { viteVersion: "8.0.16", rolldownVersion: "1.2.3" } }, {});
  plugin.configResolved.call({ meta: { viteVersion: "8.0.16" } }, {});
  // Without metadata the check stays permissive instead of guessing.
  plugin.configResolved.call({ meta: {} }, { command: "serve", mode: "development", base: "/" });
  plugin.configResolved({ command: "serve", mode: "development", base: "/" });
});

test("detectViteHost reads plugin-context metadata shapes", () => {
  assert.equal(detectViteHost(undefined), undefined);
  assert.equal(detectViteHost({}), undefined);
  assert.deepEqual(detectViteHost({ viteVersion: "8.0.16", rolldownVersion: "1.2.3" }), {
    name: "vite",
    version: "8.0.16",
    engine: "rolldown"
  });
  assert.deepEqual(detectViteHost({ viteVersion: "8.1.0" }), {
    name: "vite",
    version: "8.1.0",
    engine: "rolldown"
  });
  assert.deepEqual(detectViteHost({ viteVersion: "7.1.4" }), {
    name: "vite",
    version: "7.1.4",
    engine: "rollup"
  });
  assert.deepEqual(detectViteHost({ viteVersion: "7.1.4", rolldownVersion: "1.0.0" }), {
    name: "vite",
    version: "7.1.4",
    engine: "rolldown"
  });
});

test("bootstrap transform requires a real @async/framework/jsx import", () => {
  const plugin = asyncFramework({ fixture });

  assert.equal(importsAsyncJsx('import { component } from "@async/framework/jsx";'), true);
  assert.equal(importsAsyncJsx("import { signal } from '@async/framework/jsx/buildtime'"), true);
  assert.equal(importsAsyncJsx('export { component } from "@async/framework/jsx";'), true);
  assert.equal(importsAsyncJsx('import "@async/framework/jsx";'), true);
  assert.equal(importsAsyncJsx('const mod = await import("@async/framework/jsx/runtime");'), true);
  assert.equal(importsAsyncJsx('import {\n  component,\n  signal\n} from "@async/framework/jsx/buildtime";'), true);
  // Comment, pragma, and bare string mentions must not trigger replacement.
  assert.equal(importsAsyncJsx("// migrated from @async/framework/jsx last year"), false);
  assert.equal(importsAsyncJsx("/** @jsxImportSource @async/framework/jsx/runtime */"), false);
  assert.equal(importsAsyncJsx('const specifier = "@async/framework/jsx";'), false);
  assert.equal(importsAsyncJsx('// import { component } from "@async/framework/jsx";'), false);

  const commentOnly = "// migrated from @async/framework/jsx last year\nexport default function App() { return <div>real app</div>; }";
  assert.equal(plugin.transform(commentOnly, "/app/src/App.jsx"), null);

  const nonJsxFile = 'import { component } from "@async/framework/jsx";';
  assert.equal(plugin.transform(nonJsxFile, "/app/src/module.js"), null);
});

test("bootstrap transform logs replacements and warns on bootstrap collapse", () => {
  const plugin = asyncFramework({ fixture });
  const infos = [];
  const warnings = [];
  const context = {
    info: (message) => infos.push(String(message)),
    warn: (message) => warnings.push(String(message))
  };

  plugin.buildStart.call(context);
  const first = plugin.transform.call(context, 'import { component } from "@async/framework/jsx";\nexport const A = component(() => <a />);', "/app/A.jsx");
  assert.match(first.code, /startAsyncFramework/);
  assert.deepEqual(first.map, { mappings: "" });
  assert.equal(infos.length, 1);
  assert.match(infos[0], /Replacing "\/app\/A\.jsx"/);
  assert.equal(warnings.length, 0);

  // Re-transforming the same module does not repeat the log.
  plugin.transform.call(context, 'import { component } from "@async/framework/jsx";\nexport const A = component(() => <a />);', "/app/A.jsx");
  assert.equal(infos.length, 1);

  const second = plugin.transform.call(context, 'import { component } from "@async/framework/jsx";\nexport const B = component(() => <b />);', "/app/B.jsx");
  assert.equal(second.code, first.code);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /same virtual bootstrap/);

  // A new build resets the replacement tracking.
  plugin.buildStart.call(context);
  plugin.transform.call(context, 'import { component } from "@async/framework/jsx";', "/app/A.jsx");
  assert.equal(infos.length, 3);
  assert.equal(warnings.length, 1);
});
