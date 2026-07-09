import assert from "node:assert/strict";
import { test } from "node:test";
import { asyncFramework } from "../../src/vite.js";

function configOf(plugins, viteConfig = {}, env = { mode: "development" }) {
  // asyncFramework() returns one plugin, or an array when a dev server is configured.
  const plugin = [].concat(plugins).find((candidate) => candidate?.name === "async-framework");
  assert.ok(plugin, "asyncFramework() must expose the async-framework plugin");
  return plugin.config(viteConfig, env);
}

test("the vite plugin excludes framework entrypoints from dependency optimization", () => {
  // Vite's dep optimizer caches prebundles and does not watch file:/link:
  // dependency contents — local framework rebuilds went stale until
  // node_modules/.vite was deleted by hand. The published entrypoints are
  // flat ESM bundles, so prebundling buys nothing; exclude them.
  const partial = configOf(asyncFramework({ layer: 1 }));
  const exclude = partial?.optimizeDeps?.exclude ?? [];

  for (const entry of ["@async/framework", "@async/framework/browser", "@async/framework/router"]) {
    assert.ok(exclude.includes(entry), `optimizeDeps.exclude must cover ${entry}`);
  }
});

test("optimizeFrameworkDeps: true restores default dependency optimization", () => {
  const partial = configOf(asyncFramework({ layer: 1, optimizeFrameworkDeps: true }));
  assert.equal(partial?.optimizeDeps, undefined);
});
