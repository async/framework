import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";
import vm from "node:vm";
import * as bundle from "../browser.js";
import * as minBundle from "../browser.min.js";
import * as source from "../src/browser.js";
import manifest from "../package.json" with { type: "json" };

const execFileAsync = promisify(execFile);
const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

test("browser ESM bundles export the public browser runtime API", () => {
  assert.deepEqual(Object.keys(bundle).sort(), Object.keys(source).sort());
  assert.deepEqual(Object.keys(minBundle).sort(), Object.keys(source).sort());
  assert.equal(source.Loader, source.AsyncLoader);
  assert.equal(bundle.Loader, bundle.AsyncLoader);
  assert.equal(minBundle.Loader, minBundle.AsyncLoader);
  assert.equal(bundle.createServerRegistry, undefined);
});

test("ESM Async export stays the app hub", () => {
  for (const module of [source, bundle, minBundle]) {
    assert.equal(typeof module.Async.use, "function");
    assert.equal(typeof module.Async.start, "function");
    assert.equal(module.Async.createSignal, undefined);
    assert.equal(module.Async.Async, undefined);
  }
});

test("UMD helper exports do not conflict with app hub fields", () => {
  const conflicts = Object.keys(source)
    .filter((key) => key !== "Async" && Object.hasOwn(source.Async, key));

  assert.deepEqual(conflicts, []);
});

test("browser ESM bundles are standalone without relative imports", () => {
  for (const file of ["browser.js", "browser.min.js"]) {
    const contents = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

    assert.doesNotMatch(contents, /^\s*import\s/m);
    assert.doesNotMatch(contents, /from\s+["']\.\//);
    assert.match(contents, /\bexport\s*{/);
  }
});

test("browser minified bundles do not contain newlines", () => {
  for (const file of ["browser.min.js", "browser.umd.min.js"]) {
    const contents = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

    assert.equal(contents.includes("\n"), false);
  }
});

test("browser bundles do not include server-only registry code", () => {
  for (const file of ["browser.js", "browser.min.js", "browser.umd.js", "browser.umd.min.js"]) {
    const contents = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

    assert.doesNotMatch(contents, /createServerRegistry/);
    assert.doesNotMatch(contents, /createRequestContextStore/);
    assert.doesNotMatch(contents, /node:async_hooks/);
    assert.doesNotMatch(contents, /Server function "\\$\\{id\\}" must be a function/);
  }
});

test("browser UMD bundles expose the public browser runtime API", () => {
  for (const file of ["browser.umd.js", "browser.umd.min.js"]) {
    const contents = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const browserContext = {};
    vm.runInNewContext(contents, browserContext, { filename: file });

    assert.equal(browserContext.AsyncFramework, browserContext.Async);
    assert.equal(browserContext.Async.Async, browserContext.Async);
    for (const key of Object.keys(source)) {
      assert.ok(Object.hasOwn(browserContext.Async, key), `${file} missing Async.${key}`);
      if (key !== "Async") {
        assert.equal(typeof browserContext.Async[key], typeof source[key]);
      }
    }
    assert.equal(typeof browserContext.Async.use, "function");
    assert.equal(typeof browserContext.Async.start, "function");
    assert.equal(browserContext.Async.Loader, browserContext.Async.AsyncLoader);

    const cjsContext = {
      module: { exports: {} }
    };
    vm.runInNewContext(contents, cjsContext, { filename: file });

    assert.equal(cjsContext.module.exports.Async, cjsContext.module.exports);
    for (const key of Object.keys(source)) {
      assert.ok(Object.hasOwn(cjsContext.module.exports, key), `${file} missing module.exports.${key}`);
      if (key !== "Async") {
        assert.equal(typeof cjsContext.module.exports[key], typeof source[key]);
      }
    }
    assert.equal(cjsContext.module.exports.Loader, cjsContext.module.exports.AsyncLoader);
  }
});

test("root UMD bundle rejects namespace conflicts before assignment", () => {
  const contents = readFileSync(new URL("../browser.umd.js", import.meta.url), "utf8");
  const conflicting = contents.replace("const api = { ", "const api = { use: asyncSignal, ");

  assert.throws(
    () => vm.runInNewContext(conflicting, {}, { filename: "browser.umd.conflict.js" }),
    /UMD Async namespace export conflict: use/
  );
});

test("root package and explicit subpath exports resolve correctly", async () => {
  const rootPackage = await import("@async/framework");
  const browserPackage = await import("@async/framework/browser");
  const serverPackage = await import("@async/framework/server");

  assert.equal(typeof rootPackage.createServerRegistry, "function");
  assert.equal(typeof rootPackage.createRequestContextStore, "function");
  assert.equal(browserPackage.createServerRegistry, undefined);
  assert.equal(browserPackage.createRequestContextStore, undefined);
  assert.equal(typeof browserPackage.createServerProxy, "function");
  assert.equal(typeof serverPackage.createServerRegistry, "function");
  assert.equal(typeof serverPackage.createRequestContextStore, "function");
});

test("temporary project can import installed package subpaths", async () => {
  const root = await mkdtemp(join(tmpdir(), "async-framework-install-"));
  try {
    await mkdir(join(root, "node_modules", "@async"), { recursive: true });
    await symlink(repoRoot, join(root, "node_modules", "@async", "framework"), "dir");
    await writeFile(join(root, "check.mjs"), `
      import * as rootPackage from "@async/framework";
      import * as browserPackage from "@async/framework/browser";
      import * as serverPackage from "@async/framework/server";
      import manifest from "@async/framework/package.json" with { type: "json" };

      console.log(JSON.stringify({
        rootCreateApp: typeof rootPackage.createApp,
        rootServerRegistry: typeof rootPackage.createServerRegistry,
        browserCreateApp: typeof browserPackage.createApp,
        browserServerRegistry: typeof browserPackage.createServerRegistry,
        serverCreateApp: typeof serverPackage.createApp,
        serverRequestContextStore: typeof serverPackage.createRequestContextStore,
        version: manifest.version
      }));
    `, "utf8");
    await writeFile(join(root, "check-browser-condition.mjs"), `
      import * as rootPackage from "@async/framework";

      console.log(JSON.stringify({
        createApp: typeof rootPackage.createApp,
        serverRegistry: typeof rootPackage.createServerRegistry
      }));
    `, "utf8");

    const installed = JSON.parse((await execFileAsync(process.execPath, ["check.mjs"], { cwd: root })).stdout);
    const browserCondition = JSON.parse((await execFileAsync(process.execPath, [
      "--conditions=browser",
      "check-browser-condition.mjs"
    ], { cwd: root })).stdout);

    assert.deepEqual(installed, {
      rootCreateApp: "function",
      rootServerRegistry: "function",
      browserCreateApp: "function",
      browserServerRegistry: "undefined",
      serverCreateApp: "function",
      serverRequestContextStore: "function",
      version: manifest.version
    });
    assert.deepEqual(browserCondition, {
      createApp: "function",
      serverRegistry: "undefined"
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package metadata keeps legacy size analyzers on the browser entry", () => {
  assert.equal(manifest.main, "./src/index.js");
  assert.equal(manifest.module, "./browser.min.js");
  assert.equal(manifest.browser, "./browser.min.js");
  assert.equal(manifest.exports["."].browser, "./browser.min.js");
  assert.equal(manifest.sideEffects, false);
  assert.equal(manifest.devDependencies.terser, "5.48.0");
});

test("root browser.ts is a bundled TypeScript entrypoint", async () => {
  const contents = readFileSync(new URL("../browser.ts", import.meta.url), "utf8");
  const tsBundle = await import("../browser.ts");

  assert.deepEqual(Object.keys(tsBundle).sort(), Object.keys(source).sort());
  assert.doesNotMatch(contents, /^\s*import\s/m);
  assert.doesNotMatch(contents, /from\s+["']\.\//);
  assert.match(contents, /Bundled browser TypeScript source entry/);
  assert.match(contents, /^export\s+{/m);
});

test("browser and server declarations expose the right public APIs", () => {
  const browserDeclarations = readFileSync(new URL("../browser.d.ts", import.meta.url), "utf8");
  const serverDeclarations = readFileSync(new URL("../server.d.ts", import.meta.url), "utf8");

  for (const key of Object.keys(source)) {
    assert.match(browserDeclarations, new RegExp(`\\b${key}\\b`));
  }
  assert.doesNotMatch(browserDeclarations, /createServerRegistry/);
  assert.doesNotMatch(browserDeclarations, /createRequestContextStore/);
  assert.match(serverDeclarations, /createServerRegistry/);
  assert.match(serverDeclarations, /createRequestContextStore/);
  assert.match(browserDeclarations, /declare global/);
  assert.match(browserDeclarations, /export declare const Async: AppHub/);
  assert.match(browserDeclarations, /const Async: AsyncNamespace/);
  assert.match(browserDeclarations, /const AsyncFramework: AsyncNamespace/);
});
