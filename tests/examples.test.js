import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { Window } from "happy-dom";
import { createBuildProfileReport } from "../src/build-profile.js";
import { delay } from "../src/index.js";
import { asyncFramework } from "../src/vite.js";
import streamingProfile from "../examples/vite-jsx-streaming/src/streaming-profile.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = resolve(root, "examples");
const staticExamples = ["counter", "product", "components", "streaming", "server-call", "router", "partials", "cache", "ssr"];
const viteExamples = ["vite-hono", "vite-jsx-streaming"];
const topLevelExamples = [...staticExamples, ...viteExamples, "size"];

test("examples index links every top-level example directory", () => {
  const readme = readFileSync(resolve(examplesRoot, "README.md"), "utf8");
  for (const name of topLevelExamples) {
    assert.match(readme, new RegExp(`\\./${escapeRegExp(name)}/README\\.md`), `${name} missing from examples index`);
  }
});

test("top-level public examples have README files", () => {
  for (const name of topLevelExamples) {
    assert.equal(existsSync(resolve(examplesRoot, name, "README.md")), true, `${name} README missing`);
  }
});

test("size scenario examples have README files", () => {
  const sizeRoot = resolve(examplesRoot, "size");
  const scenarios = readdirSync(sizeRoot)
    .filter((name) => statSync(resolve(sizeRoot, name)).isDirectory())
    .sort();
  for (const name of scenarios) {
    assert.equal(existsSync(resolve(sizeRoot, name, "README.md")), true, `${name} README missing`);
  }
});

test("Vite examples include package, config, and source entrypoints", () => {
  for (const name of viteExamples) {
    const dir = resolve(examplesRoot, name);
    assert.equal(existsSync(resolve(dir, "README.md")), true, `${name} README missing`);
    assert.equal(existsSync(resolve(dir, "package.json")), true, `${name} package missing`);
    assert.equal(existsSync(resolve(dir, "vite.config.js")), true, `${name} config missing`);
    assert.equal(existsSync(resolve(dir, "src")), true, `${name} source directory missing`);
  }
});

test("Vite Hono example uses default server and client plugin setup", () => {
  const config = readFileSync(resolve(examplesRoot, "vite-hono", "vite.config.js"), "utf8");
  const server = readFileSync(resolve(examplesRoot, "vite-hono", "src", "server.js"), "utf8");
  const client = readFileSync(resolve(examplesRoot, "vite-hono", "src", "client.js"), "utf8");

  assert.match(config, /asyncFramework\(\{/);
  assert.match(config, /layer:\s*1/);
  assert.match(config, /server:\s*\{/);
  assert.match(config, /entry:\s*"src\/server\.js"/);
  assert.match(config, /client:\s*\{/);
  assert.match(config, /outDir:\s*"public\/static"/);
  assert.match(server, /export default app/);
  assert.match(server, /new Hono\(\)/);
  assert.match(server, /import\.meta\.env\?\.DEV/);
  assert.match(client, /Async\.start\(\{ root: document, router: false \}\)/);
});

test("Vite JSX streaming example selects stream runtime through optimizer profile", () => {
  const profile = createBuildProfileReport(streamingProfile);
  const sourcePath = resolve(examplesRoot, "vite-jsx-streaming", "src", "Dashboard.jsx");
  const jsxSource = readFileSync(sourcePath, "utf8");
  const plugin = asyncFramework({
    fixture: streamingProfile,
    layer: 1.5
  });
  const transformed = plugin.transform(jsxSource, sourcePath);

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
  assert.equal(profile.report.stream.suspenseBoundaryCount, 2);
  assert.equal(profile.report.stream.reveal.byOrder.forwards, 1);
  assert.match(transformed.code, /startAsyncFramework/);
  assert.match(transformed.code, /virtual:async-framework\/generated-plan/);
  assert.doesNotMatch(transformed.code, /@async\/framework\/jsx/);
});

test("Vite JSX streaming fixture stays aligned with the authored source and HTML", () => {
  const exampleRoot = resolve(examplesRoot, "vite-jsx-streaming");
  const html = readFileSync(resolve(exampleRoot, "index.html"), "utf8");
  const jsxSource = readFileSync(resolve(exampleRoot, "src", "Dashboard.jsx"), "utf8");

  // The fixture is the source of truth for the emitted plan until
  // source-derived profile generation lands; keep it aligned with the files
  // it claims to describe.
  for (const locator of streamingProfile.semanticGraph.locators) {
    const match = locator.match(/^\[data-async-id='([^']+)'\]$/);
    assert.ok(match, `unsupported locator shape: ${locator}`);
    assert.ok(
      html.includes(`data-async-id="${match[1]}"`),
      `fixture locator ${locator} missing from index.html`
    );
    assert.ok(
      jsxSource.includes(`data-async-id="${match[1]}"`),
      `fixture locator ${locator} missing from Dashboard.jsx`
    );
  }

  for (const frameworkImport of streamingProfile.sourceInventory.frameworkImports) {
    assert.ok(
      jsxSource.includes(`from "${frameworkImport.module}"`),
      `fixture framework import ${frameworkImport.module} missing from Dashboard.jsx`
    );
  }
});

for (const name of staticExamples) {
  test(`example ${name} has runnable static HTML and JS entrypoints`, async () => {
    const dir = resolve(root, "examples", name);
    const htmlPath = resolve(dir, "index.html");
    const jsPath = resolve(dir, "main.js");

    assert.equal(existsSync(htmlPath), true);
    assert.equal(existsSync(jsPath), true);

    const html = readFileSync(htmlPath, "utf8");
    const js = readFileSync(jsPath, "utf8");
    assert.match(html, /<script type="module" src="\.\/main\.js"><\/script>/);
    assert.match(js, /\.\.\/\.\.\/src\/index\.js/);

    const window = new Window();
    window.document.write(html);
    globalThis.window = window;
    globalThis.document = window.document;

    await import(`${pathToFileURL(jsPath).href}?example=${name}`);
    await delay(name === "product" ? 175 : 0);

    delete globalThis.window;
    delete globalThis.document;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
