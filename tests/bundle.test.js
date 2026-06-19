import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";
import vm from "node:vm";
import * as bundle from "../dist/browser.js";
import * as minBundle from "../dist/browser.min.js";
import * as source from "../src/browser.js";
import * as serverSource from "../src/index.js";
import manifest from "../package.json" with { type: "json" };
import publishManifest from "../dist/package.json" with { type: "json" };

const execFileAsync = promisify(execFile);
const repoRoot = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const distRoot = join(repoRoot, "dist");

function distFileUrl(file) {
  return new URL(`../dist/${file}`, import.meta.url);
}

function resolvePackageTarget(target, conditions) {
  if (typeof target === "string") {
    return target;
  }
  for (const [condition, value] of Object.entries(target)) {
    if (conditions.includes(condition) || condition === "default") {
      return resolvePackageTarget(value, conditions);
    }
  }
  throw new Error(`No package export target matched conditions: ${conditions.join(", ")}`);
}

function valueDeclarationExports(sourceText) {
  return [...sourceText.matchAll(/^export declare (?:async )?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm)]
    .map((match) => match[1])
    .sort();
}

function assertDeclarationRuntimeParity(label, declarationText, runtimeModule) {
  assert.deepEqual(
    Object.keys(runtimeModule).sort(),
    valueDeclarationExports(declarationText),
    `${label} declaration value exports must match runtime exports`
  );
}

async function assertPackedExportParity(packageRoot, exportKey, runtimeConditions, typeConditions) {
  const packageManifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  const exportTarget = packageManifest.exports[exportKey];
  const runtimeTarget = resolvePackageTarget(exportTarget, runtimeConditions);
  const declarationTarget = resolvePackageTarget(exportTarget, typeConditions);
  const runtimeModule = await import(pathToFileURL(join(packageRoot, runtimeTarget)).href);
  const declarationText = readFileSync(join(packageRoot, declarationTarget), "utf8");

  assertDeclarationRuntimeParity(
    `${exportKey} (${runtimeConditions.join("+")})`,
    declarationText,
    runtimeModule
  );

  return {
    declarationTarget,
    runtimeTarget,
    valueExports: valueDeclarationExports(declarationText)
  };
}

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
    const contents = readFileSync(distFileUrl(file), "utf8");

    assert.doesNotMatch(contents, /^\s*import\s/m);
    assert.doesNotMatch(contents, /from\s+["']\.\//);
    assert.match(contents, /\bexport\s*{/);
  }
});

test("browser minified bundles do not contain newlines", () => {
  for (const file of ["browser.min.js", "browser.umd.min.js"]) {
    const contents = readFileSync(distFileUrl(file), "utf8");

    assert.equal(contents.includes("\n"), false);
  }
});

test("browser bundles do not include server-only registry code", () => {
  for (const file of [
    "browser.js",
    "browser.min.js",
    "browser.umd.js",
    "browser.umd.min.js"
  ]) {
    const contents = readFileSync(distFileUrl(file), "utf8");

    assert.doesNotMatch(contents, /createServerRegistry/);
    assert.doesNotMatch(contents, /createRequestContextStore/);
    assert.doesNotMatch(contents, /node:async_hooks/);
    assert.doesNotMatch(contents, /Server function "\\$\\{id\\}" must be a function/);
  }
});

test("published runtime sources and browser bundles do not use implicit global fetch", () => {
  const files = [
    "src/server.js",
    "src/router.js",
    "src/app.js",
    "browser.js",
    "browser.min.js",
    "browser.umd.js",
    "browser.umd.min.js",
    "server.js",
    "framework.ts"
  ];

  for (const file of files) {
    const url = file.startsWith("src/") ? new URL(`../${file}`, import.meta.url) : distFileUrl(file);
    const contents = readFileSync(url, "utf8");

    assert.doesNotMatch(contents, /globalThis\.fetch/, `${file} should not access globalThis.fetch`);
    assert.doesNotMatch(contents, /globalThis\[\s*["']fetch["']\s*\]/, `${file} should not access globalThis["fetch"]`);
  }
});

test("browser UMD bundles expose the public browser runtime API", () => {
  for (const file of ["browser.umd.js", "browser.umd.min.js"]) {
    const contents = readFileSync(distFileUrl(file), "utf8");
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
  const contents = readFileSync(distFileUrl("browser.umd.js"), "utf8");
  const conflicting = contents.replace("const api = { ", "const api = { use: asyncSignal, ");

  assert.throws(
    () => vm.runInNewContext(conflicting, {}, { filename: "browser.umd.conflict.js" }),
    /UMD Async namespace export conflict: use/
  );
});

test("dist server and browser entrypoints expose split runtime APIs", async () => {
  const rootPackage = await import("../dist/server.js");
  const browserPackage = await import("../dist/browser.js");

  assert.equal(typeof rootPackage.createServerRegistry, "function");
  assert.equal(typeof rootPackage.createRequestContextStore, "function");
  assert.equal(browserPackage.createServerRegistry, undefined);
  assert.equal(browserPackage.createRequestContextStore, undefined);
  assert.equal(typeof browserPackage.createServerProxy, "function");
});

test("temporary project can import generated dist package subpaths", async () => {
  const root = await mkdtemp(join(tmpdir(), "async-framework-install-"));
  try {
    await mkdir(join(root, "node_modules", "@async"), { recursive: true });
    await symlink(distRoot, join(root, "node_modules", "@async", "framework"), "dir");
    await writeFile(join(root, "check.mjs"), `
      import * as rootPackage from "@async/framework";
      import * as browserPackage from "@async/framework/browser";
      import * as serverPackage from "@async/framework/server";
      import * as runtimePackage from "@async/framework/runtime";
      import * as runtimeSignalsPackage from "@async/framework/runtime/signals";
      import * as runtimeEventsPackage from "@async/framework/runtime/events";
      import manifest from "@async/framework/package.json" with { type: "json" };

      console.log(JSON.stringify({
        rootCreateApp: typeof rootPackage.createApp,
        rootServerRegistry: typeof rootPackage.createServerRegistry,
        browserCreateApp: typeof browserPackage.createApp,
        browserServerRegistry: typeof browserPackage.createServerRegistry,
        serverCreateApp: typeof serverPackage.createApp,
        serverRequestContextStore: typeof serverPackage.createRequestContextStore,
        runtimeStart: typeof runtimePackage.start,
        runtimeSignalsStart: typeof runtimeSignalsPackage.startSignals,
        runtimeEventsStart: typeof runtimeEventsPackage.startEvents,
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
      runtimeStart: "function",
      runtimeSignalsStart: "function",
      runtimeEventsStart: "function",
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

test("packed package can be installed and resolves browser/server entrypoints", async () => {
  const root = await mkdtemp(join(tmpdir(), "async-framework-pack-install-"));
  try {
    const packOutput = JSON.parse((await execFileAsync("npm", [
      "pack",
      distRoot,
      "--json",
      "--ignore-scripts"
    ], { cwd: root })).stdout);
    const packedFiles = packOutput[0].files.map((file) => file.path);
    assert.ok(packedFiles.includes("browser.js"));
    assert.ok(packedFiles.includes("package.json"));
    assert.equal(packedFiles.some((file) => file.startsWith("dist/")), false);
    const tarball = join(root, packOutput[0].filename);
    const project = join(root, "project");
    await mkdir(project);
    await writeFile(join(project, "package.json"), `{"type":"module"}`, "utf8");
    await execFileAsync("npm", [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      tarball
    ], { cwd: project });
    await writeFile(join(project, "check.mjs"), `
      import * as rootPackage from "@async/framework";
      import * as browserPackage from "@async/framework/browser";
      import * as serverPackage from "@async/framework/server";
      import * as runtimePackage from "@async/framework/runtime";
      import * as runtimeSignalsPackage from "@async/framework/runtime/signals";
      import * as runtimeEventsPackage from "@async/framework/runtime/events";
      import manifest from "@async/framework/package.json" with { type: "json" };

      console.log(JSON.stringify({
        rootServerRegistry: typeof rootPackage.createServerRegistry,
        rootRequestContextStore: typeof rootPackage.createRequestContextStore,
        browserServerRegistry: typeof browserPackage.createServerRegistry,
        browserRequestContextStore: typeof browserPackage.createRequestContextStore,
        browserServerProxy: typeof browserPackage.createServerProxy,
        serverRequestContextStore: typeof serverPackage.createRequestContextStore,
        runtimeStart: typeof runtimePackage.start,
        runtimeSignalsStart: typeof runtimeSignalsPackage.startSignals,
        runtimeEventsStart: typeof runtimeEventsPackage.startEvents,
        version: manifest.version
      }));
    `, "utf8");
    await writeFile(join(project, "check-browser-condition.mjs"), `
      import * as rootPackage from "@async/framework";
      console.log(JSON.stringify({
        serverRegistry: typeof rootPackage.createServerRegistry,
        requestContextStore: typeof rootPackage.createRequestContextStore
      }));
    `, "utf8");
    await writeFile(join(project, "check-unexported-artifact.mjs"), `
      try {
        await import("@async/framework/browser.min.js");
        console.log("resolved");
      } catch (error) {
        console.log(error.code);
      }
    `, "utf8");

    const installed = JSON.parse((await execFileAsync(process.execPath, ["check.mjs"], { cwd: project })).stdout);
    const browserCondition = JSON.parse((await execFileAsync(process.execPath, [
      "--conditions=browser",
      "check-browser-condition.mjs"
    ], { cwd: project })).stdout);
    const unexportedArtifact = (await execFileAsync(process.execPath, ["check-unexported-artifact.mjs"], { cwd: project })).stdout.trim();

    assert.deepEqual(installed, {
      rootServerRegistry: "function",
      rootRequestContextStore: "function",
      browserServerRegistry: "undefined",
      browserRequestContextStore: "undefined",
      browserServerProxy: "function",
      serverRequestContextStore: "function",
      runtimeStart: "function",
      runtimeSignalsStart: "function",
      runtimeEventsStart: "function",
      version: manifest.version
    });
    assert.deepEqual(browserCondition, {
      serverRegistry: "undefined",
      requestContextStore: "undefined"
    });
    assert.equal(unexportedArtifact, "ERR_PACKAGE_PATH_NOT_EXPORTED");

    const packageRoot = join(project, "node_modules", "@async", "framework");
    const rootNode = await assertPackedExportParity(
      packageRoot,
      ".",
      ["node", "import", "default"],
      ["node", "types", "import", "default"]
    );
    const rootBrowser = await assertPackedExportParity(
      packageRoot,
      ".",
      ["browser", "import", "default"],
      ["browser", "types", "import", "default"]
    );
    const explicitServer = await assertPackedExportParity(
      packageRoot,
      "./server",
      ["node", "import", "default"],
      ["node", "types", "import", "default"]
    );
    const explicitBrowser = await assertPackedExportParity(
      packageRoot,
      "./browser",
      ["browser", "import", "default"],
      ["types", "browser", "import", "default"]
    );
    const runtime = await assertPackedExportParity(
      packageRoot,
      "./runtime",
      ["import", "default"],
      ["types", "import", "default"]
    );
    const runtimeSignals = await assertPackedExportParity(
      packageRoot,
      "./runtime/signals",
      ["import", "default"],
      ["types", "import", "default"]
    );
    const runtimeEvents = await assertPackedExportParity(
      packageRoot,
      "./runtime/events",
      ["import", "default"],
      ["types", "import", "default"]
    );

    assert.deepEqual(
      {
        rootNode: [rootNode.declarationTarget, rootNode.runtimeTarget],
        rootBrowser: [rootBrowser.declarationTarget, rootBrowser.runtimeTarget],
        explicitServer: [explicitServer.declarationTarget, explicitServer.runtimeTarget],
        explicitBrowser: [explicitBrowser.declarationTarget, explicitBrowser.runtimeTarget],
        runtime: [runtime.declarationTarget, runtime.runtimeTarget],
        runtimeSignals: [runtimeSignals.declarationTarget, runtimeSignals.runtimeTarget],
        runtimeEvents: [runtimeEvents.declarationTarget, runtimeEvents.runtimeTarget]
      },
      {
        rootNode: ["./framework.d.ts", "./server.js"],
        rootBrowser: ["./browser.d.ts", "./browser.min.js"],
        explicitServer: ["./framework.d.ts", "./server.js"],
        explicitBrowser: ["./browser.d.ts", "./browser.js"],
        runtime: ["./runtime.d.ts", "./runtime.js"],
        runtimeSignals: ["./runtime/signals.d.ts", "./runtime/signals.js"],
        runtimeEvents: ["./runtime/events.d.ts", "./runtime/events.js"]
      }
    );

    await writeFile(join(project, "check-root-static.mjs"), `
      import { ${rootNode.valueExports.join(", ")} } from "@async/framework";
      console.log("ok");
    `, "utf8");
    await writeFile(join(project, "check-root-browser-static.mjs"), `
      import { ${rootBrowser.valueExports.join(", ")} } from "@async/framework";
      console.log("ok");
    `, "utf8");
    await writeFile(join(project, "check-server-static.mjs"), `
      import { ${explicitServer.valueExports.join(", ")} } from "@async/framework/server";
      console.log("ok");
    `, "utf8");
    await writeFile(join(project, "check-browser-static.mjs"), `
      import { ${explicitBrowser.valueExports.join(", ")} } from "@async/framework/browser";
      console.log("ok");
    `, "utf8");
    await writeFile(join(project, "check-runtime-static.mjs"), `
      import { ${runtime.valueExports.join(", ")} } from "@async/framework/runtime";
      import { ${runtimeSignals.valueExports.join(", ")} } from "@async/framework/runtime/signals";
      import { ${runtimeEvents.valueExports.join(", ")} } from "@async/framework/runtime/events";
      console.log("ok");
    `, "utf8");

    await execFileAsync(process.execPath, ["check-root-static.mjs"], { cwd: project });
    await execFileAsync(process.execPath, ["--conditions=browser", "check-root-browser-static.mjs"], { cwd: project });
    await execFileAsync(process.execPath, ["check-server-static.mjs"], { cwd: project });
    await execFileAsync(process.execPath, ["check-browser-static.mjs"], { cwd: project });
    await execFileAsync(process.execPath, ["check-runtime-static.mjs"], { cwd: project });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("source package metadata owns the minimal public export spec", () => {
  for (const field of [
    "main",
    "module",
    "browser",
    "types",
    "files"
  ]) {
    assert.equal(field in manifest, false, `source package.json should not define ${field}`);
  }
  assert.equal(manifest.private, true);
  assert.equal(manifest.sideEffects, false);
  assert.equal(manifest.unpkg, "./browser.umd.min.js");
  assert.equal(manifest.jsdelivr, "./browser.umd.min.js");
  assert.deepEqual(Object.keys(manifest.exports), [
    ".",
    "./browser",
    "./server",
    "./runtime",
    "./runtime/signals",
    "./runtime/events",
    "./package.json"
  ]);
  assert.equal(manifest.devDependencies.terser, "5.48.0");
});

test("publish staging metadata keeps package artifacts at the tarball root", () => {
  assert.deepEqual(Object.keys(publishManifest.exports), [
    ".",
    "./browser",
    "./server",
    "./runtime",
    "./runtime/signals",
    "./runtime/events",
    "./package.json"
  ]);
  assert.equal("main" in publishManifest, false);
  assert.equal("module" in publishManifest, false);
  assert.equal("browser" in publishManifest, false);
  assert.equal("types" in publishManifest, false);
  assert.equal(publishManifest.unpkg, "./browser.umd.min.js");
  assert.equal(publishManifest.jsdelivr, "./browser.umd.min.js");
  assert.equal(resolvePackageTarget(publishManifest.exports["."], ["browser", "import", "default"]), "./browser.min.js");
  assert.equal(resolvePackageTarget(publishManifest.exports["."], ["browser", "types", "import", "default"]), "./browser.d.ts");
  assert.equal(resolvePackageTarget(publishManifest.exports["."], ["node", "import", "default"]), "./server.js");
  assert.equal(resolvePackageTarget(publishManifest.exports["."], ["node", "types", "import", "default"]), "./framework.d.ts");
  assert.equal(publishManifest.exports["./browser"].import, "./browser.js");
  assert.equal(publishManifest.exports["./server"].import, "./server.js");
  assert.equal(publishManifest.exports["./runtime"].import, "./runtime.js");
  assert.equal(publishManifest.exports["./runtime/signals"].import, "./runtime/signals.js");
  assert.equal(publishManifest.exports["./runtime/events"].import, "./runtime/events.js");
  assert.equal(publishManifest.exports["./browser.min.js"], undefined);
  assert.equal(publishManifest.exports["./browser.umd.js"], undefined);
  assert.equal(publishManifest.exports["./browser.umd.min.js"], undefined);
  assert.equal(publishManifest.files.includes("dist"), false);
  assert.equal(JSON.stringify(publishManifest).includes("./dist"), false);
  assert.equal(publishManifest.sideEffects, false);
  assert.equal("private" in publishManifest, false);
  assert.equal("packageManager" in publishManifest, false);
  assert.equal("scripts" in publishManifest, false);
  assert.equal("devDependencies" in publishManifest, false);
});

test("package file list only publishes generated framework artifacts", () => {
  assert.equal(publishManifest.files.includes("src"), false);
  assert.equal(publishManifest.files.includes("tests"), false);
  assert.equal(publishManifest.files.includes("examples"), false);
  assert.ok(publishManifest.files.includes("browser.js"));
  assert.ok(publishManifest.files.includes("browser.min.js"));
  assert.ok(publishManifest.files.includes("browser.umd.js"));
  assert.ok(publishManifest.files.includes("browser.umd.min.js"));
  assert.ok(publishManifest.files.includes("browser.ts"));
  assert.ok(publishManifest.files.includes("browser.d.ts"));
  assert.ok(publishManifest.files.includes("server.js"));
  assert.ok(publishManifest.files.includes("framework.ts"));
  assert.ok(publishManifest.files.includes("framework.d.ts"));
  assert.ok(publishManifest.files.includes("runtime.js"));
  assert.ok(publishManifest.files.includes("runtime.d.ts"));
  assert.ok(publishManifest.files.includes("runtime/signals.js"));
  assert.ok(publishManifest.files.includes("runtime/signals.d.ts"));
  assert.ok(publishManifest.files.includes("runtime/events.js"));
  assert.ok(publishManifest.files.includes("runtime/events.d.ts"));
  assert.ok(publishManifest.files.includes("runtime/shared.js"));
});

test("dist browser.ts is a bundled TypeScript entrypoint", async () => {
  const contents = readFileSync(distFileUrl("browser.ts"), "utf8");
  const tsBundle = await import("../dist/browser.ts");

  assert.deepEqual(Object.keys(tsBundle).sort(), Object.keys(source).sort());
  assert.doesNotMatch(contents, /^\s*import\s/m);
  assert.doesNotMatch(contents, /from\s+["']\.\//);
  assert.match(contents, /Bundled browser TypeScript source entry/);
  assert.match(contents, /^export\s+{/m);
});

test("browser and server declarations expose the right public APIs", () => {
  const browserDeclarations = readFileSync(distFileUrl("browser.d.ts"), "utf8");
  const serverDeclarations = readFileSync(distFileUrl("framework.d.ts"), "utf8");

  assertDeclarationRuntimeParity("browser", browserDeclarations, source);
  assertDeclarationRuntimeParity("server", serverDeclarations, serverSource);
  assert.doesNotMatch(browserDeclarations, /createServerRegistry/);
  assert.doesNotMatch(browserDeclarations, /createRequestContextStore/);
  assert.match(serverDeclarations, /createServerRegistry/);
  assert.match(serverDeclarations, /createRequestContextStore/);
  assert.match(browserDeclarations, /declare global/);
  assert.match(browserDeclarations, /export declare const Async: AppHub/);
  assert.match(browserDeclarations, /const Async: AsyncNamespace/);
  assert.match(browserDeclarations, /const AsyncFramework: AsyncNamespace/);
});
