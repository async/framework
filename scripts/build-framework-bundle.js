#!/usr/bin/env node
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { minify } from "terser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const srcRoot = join(root, "src");
const distRoot = join(root, "dist");
const browserEntry = "src/browser.js";
const streamEntry = "src/stream.js";
const flowEntry = "src/flow-entry.js";
const routerEntry = "src/router-entry.js";
const serverEntry = "src/index.js";
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageExportSpec = packageManifest.exports;
const browserExport = getPackageExport(packageExportSpec, "./browser");
const streamExport = getPackageExport(packageExportSpec, "./stream");
const flowExport = getPackageExport(packageExportSpec, "./flow");
const routerExport = getPackageExport(packageExportSpec, "./router");
const serverExport = getPackageExport(packageExportSpec, "./server");
const jsxExport = getPackageExport(packageExportSpec, "./jsx");
const jsxRuntimeFactoryExport = getPackageExport(packageExportSpec, "./jsx/jsx-runtime");
const jsxDevRuntimeFactoryExport = getPackageExport(packageExportSpec, "./jsx/jsx-dev-runtime");
const jsxRuntimeProfileExport = getPackageExport(packageExportSpec, "./jsx/runtime");
const jsxRuntimeProfileJsxRuntimeExport = getPackageExport(packageExportSpec, "./jsx/runtime/jsx-runtime");
const jsxRuntimeProfileJsxDevRuntimeExport = getPackageExport(packageExportSpec, "./jsx/runtime/jsx-dev-runtime");
const jsxBuildtimeProfileExport = getPackageExport(packageExportSpec, "./jsx/buildtime");
const jsxBuildtimeProfileJsxRuntimeExport = getPackageExport(packageExportSpec, "./jsx/buildtime/jsx-runtime");
const jsxBuildtimeProfileJsxDevRuntimeExport = getPackageExport(packageExportSpec, "./jsx/buildtime/jsx-dev-runtime");
const viteExport = getPackageExport(packageExportSpec, "./vite");
const runtimeExport = getPackageExport(packageExportSpec, "./runtime");
const runtimeSignalsExport = getPackageExport(packageExportSpec, "./runtime/signals");
const runtimeEventsExport = getPackageExport(packageExportSpec, "./runtime/events");
const rootExport = getPackageExport(packageExportSpec, ".");
const browserDts = packagePathToFile(resolveConditionalTarget(browserExport, ["types"]));
const browserEsm = packagePathToFile(resolveConditionalTarget(browserExport, ["import", "default"]));
const browserEsmMin = packagePathToFile(resolveConditionalTarget(rootExport, ["browser", "default"]));
const browserUmdMin = packagePathToFile(resolveConditionalTarget(browserExport, ["unpkg"]) ?? packageManifest.unpkg);
const browserUmd = unminifiedArtifact(browserUmdMin);
const browserTs = typedSourceArtifact(browserEsm);
const streamDts = packagePathToFile(resolveConditionalTarget(streamExport, ["types"]));
const streamEsm = packagePathToFile(resolveConditionalTarget(streamExport, ["import", "default"]));
const streamEsmMin = minifiedArtifact(streamEsm);
const streamUmdMin = packagePathToFile(resolveConditionalTarget(streamExport, ["unpkg"]));
const streamUmd = unminifiedArtifact(streamUmdMin);
const streamTs = typedSourceArtifact(streamEsm);
const flowDts = packagePathToFile(resolveConditionalTarget(flowExport, ["types"]));
const flowEsm = packagePathToFile(resolveConditionalTarget(flowExport, ["import", "default"]));
const flowEsmMin = minifiedArtifact(flowEsm);
const flowUmdMin = packagePathToFile(resolveConditionalTarget(flowExport, ["unpkg"]));
const flowUmd = unminifiedArtifact(flowUmdMin);
const flowTs = typedSourceArtifact(flowEsm);
const routerDts = packagePathToFile(resolveConditionalTarget(routerExport, ["types"]));
const routerEsm = packagePathToFile(resolveConditionalTarget(routerExport, ["import", "default"]));
const routerEsmMin = minifiedArtifact(routerEsm);
const routerUmdMin = packagePathToFile(resolveConditionalTarget(routerExport, ["unpkg"]));
const routerUmd = unminifiedArtifact(routerUmdMin);
const routerTs = typedSourceArtifact(routerEsm);
const frameworkDts = packagePathToFile(resolveConditionalTarget(serverExport, ["types"]));
const frameworkTs = typedSourceArtifact(frameworkDts);
const packageJsonArtifact = packagePathToFile(resolveConditionalTarget(packageExportSpec, ["./package.json"]));
const serverEsm = packagePathToFile(resolveConditionalTarget(serverExport, ["import", "node", "default"]));
const jsxEsm = packagePathToFile(resolveConditionalTarget(jsxExport, ["import", "default"]));
const jsxDts = packagePathToFile(resolveConditionalTarget(jsxExport, ["types"]));
const jsxRuntimeFactoryEsm = packagePathToFile(resolveConditionalTarget(jsxRuntimeFactoryExport, ["import", "default"]));
const jsxRuntimeFactoryDts = packagePathToFile(resolveConditionalTarget(jsxRuntimeFactoryExport, ["types"]));
const jsxDevRuntimeFactoryEsm = packagePathToFile(resolveConditionalTarget(jsxDevRuntimeFactoryExport, ["import", "default"]));
const jsxDevRuntimeFactoryDts = packagePathToFile(resolveConditionalTarget(jsxDevRuntimeFactoryExport, ["types"]));
const jsxRuntimeProfileEsm = packagePathToFile(resolveConditionalTarget(jsxRuntimeProfileExport, ["import", "default"]));
const jsxRuntimeProfileDts = packagePathToFile(resolveConditionalTarget(jsxRuntimeProfileExport, ["types"]));
const jsxRuntimeProfileJsxRuntimeEsm = packagePathToFile(resolveConditionalTarget(jsxRuntimeProfileJsxRuntimeExport, ["import", "default"]));
const jsxRuntimeProfileJsxRuntimeDts = packagePathToFile(resolveConditionalTarget(jsxRuntimeProfileJsxRuntimeExport, ["types"]));
const jsxRuntimeProfileJsxDevRuntimeEsm = packagePathToFile(resolveConditionalTarget(jsxRuntimeProfileJsxDevRuntimeExport, ["import", "default"]));
const jsxRuntimeProfileJsxDevRuntimeDts = packagePathToFile(resolveConditionalTarget(jsxRuntimeProfileJsxDevRuntimeExport, ["types"]));
const jsxBuildtimeProfileEsm = packagePathToFile(resolveConditionalTarget(jsxBuildtimeProfileExport, ["import", "default"]));
const jsxBuildtimeProfileDts = packagePathToFile(resolveConditionalTarget(jsxBuildtimeProfileExport, ["types"]));
const jsxBuildtimeProfileJsxRuntimeEsm = packagePathToFile(resolveConditionalTarget(jsxBuildtimeProfileJsxRuntimeExport, ["import", "default"]));
const jsxBuildtimeProfileJsxRuntimeDts = packagePathToFile(resolveConditionalTarget(jsxBuildtimeProfileJsxRuntimeExport, ["types"]));
const jsxBuildtimeProfileJsxDevRuntimeEsm = packagePathToFile(resolveConditionalTarget(jsxBuildtimeProfileJsxDevRuntimeExport, ["import", "default"]));
const jsxBuildtimeProfileJsxDevRuntimeDts = packagePathToFile(resolveConditionalTarget(jsxBuildtimeProfileJsxDevRuntimeExport, ["types"]));
const jsxProfileTypesDts = "jsx/types.d.ts";
const viteEsm = packagePathToFile(resolveConditionalTarget(viteExport, ["import", "default"]));
const viteDts = packagePathToFile(resolveConditionalTarget(viteExport, ["types"]));
const runtimeEsm = packagePathToFile(resolveConditionalTarget(runtimeExport, ["import", "default"]));
const runtimeDts = packagePathToFile(resolveConditionalTarget(runtimeExport, ["types"]));
const runtimeSignalsEsm = packagePathToFile(resolveConditionalTarget(runtimeSignalsExport, ["import", "default"]));
const runtimeSignalsDts = packagePathToFile(resolveConditionalTarget(runtimeSignalsExport, ["types"]));
const runtimeEventsEsm = packagePathToFile(resolveConditionalTarget(runtimeEventsExport, ["import", "default"]));
const runtimeEventsDts = packagePathToFile(resolveConditionalTarget(runtimeEventsExport, ["types"]));
const generatedArtifacts = {
  browserDts,
  browserEsm,
  browserEsmMin,
  browserUmd,
  browserUmdMin,
  browserTs,
  streamDts,
  streamEsm,
  streamEsmMin,
  streamUmd,
  streamUmdMin,
  streamTs,
  flowDts,
  flowEsm,
  flowEsmMin,
  flowUmd,
  flowUmdMin,
  flowTs,
  routerDts,
  routerEsm,
  routerEsmMin,
  routerUmd,
  routerUmdMin,
  routerTs,
  frameworkDts,
  frameworkTs,
  packageJson: packageJsonArtifact,
  serverEsm,
  jsxDts,
  jsxRuntimeFactoryDts,
  jsxDevRuntimeFactoryDts,
  jsxRuntimeProfileDts,
  jsxRuntimeProfileJsxRuntimeDts,
  jsxRuntimeProfileJsxDevRuntimeDts,
  jsxBuildtimeProfileDts,
  jsxBuildtimeProfileJsxRuntimeDts,
  jsxBuildtimeProfileJsxDevRuntimeDts,
  jsxProfileTypesDts,
  viteDts,
  runtimeDts,
  runtimeSignalsDts,
  runtimeEventsDts
};
const copiedArtifacts = {
  agentGuide: { source: "docs/start/app-authoring.md", file: "AGENTS.md" },
  changelog: { source: "CHANGELOG.md", file: "CHANGELOG.md" },
  readme: { source: "README.md", file: "README.md" },
  license: { source: "LICENSE", file: "LICENSE" }
};
const runtimeCopiedArtifacts = {
  jsxEsm: { source: "src/jsx.js", file: jsxEsm },
  jsxRuntimeProfileEsm: { source: "src/jsx/runtime.js", file: jsxRuntimeProfileEsm },
  jsxRuntimeProfileJsxRuntimeEsm: { source: "src/jsx/runtime/jsx-runtime.js", file: jsxRuntimeProfileJsxRuntimeEsm },
  jsxRuntimeProfileJsxDevRuntimeEsm: { source: "src/jsx/runtime/jsx-dev-runtime.js", file: jsxRuntimeProfileJsxDevRuntimeEsm },
  jsxBuildtimeProfileEsm: { source: "src/jsx/buildtime.js", file: jsxBuildtimeProfileEsm },
  jsxBuildtimeProfileJsxRuntimeEsm: { source: "src/jsx/buildtime/jsx-runtime.js", file: jsxBuildtimeProfileJsxRuntimeEsm },
  jsxBuildtimeProfileJsxDevRuntimeEsm: { source: "src/jsx/buildtime/jsx-dev-runtime.js", file: jsxBuildtimeProfileJsxDevRuntimeEsm },
  jsxRuntimeFactoryEsm: { source: "src/jsx/jsx-runtime.js", file: jsxRuntimeFactoryEsm },
  jsxDevRuntimeFactoryEsm: { source: "src/jsx/jsx-dev-runtime.js", file: jsxDevRuntimeFactoryEsm },
  viteEsm: { source: "src/vite.js", file: viteEsm },
  buildProfileEsm: { source: "src/build-profile.js", file: "build-profile.js" },
  buildOptimizerEsm: { source: "src/build-optimizer.js", file: "build-optimizer.js" },
  runtimeEsm: { source: "src/runtime.js", file: runtimeEsm },
  runtimeSignalsEsm: { source: "src/runtime/signals.js", file: runtimeSignalsEsm },
  runtimeEventsEsm: { source: "src/runtime/events.js", file: runtimeEventsEsm },
  runtimeSharedEsm: { source: "src/runtime/shared.js", file: "runtime/shared.js" }
};
const publishArtifactFiles = {
  ...Object.fromEntries(
    Object.entries(copiedArtifacts).map(([id, { file }]) => [id, file])
  ),
  ...generatedArtifacts,
  ...Object.fromEntries(
    Object.entries(runtimeCopiedArtifacts).map(([id, { file }]) => [id, file])
  )
};
const outFiles = Object.fromEntries(
  Object.entries(generatedArtifacts).map(([id, file]) => [id, join(distRoot, file)])
);
const legacyRootOutFiles = Object.entries(generatedArtifacts)
  .filter(([id]) => id !== "packageJson" && !id.startsWith("runtime"))
  .map(([, file]) => join(root, file));
const publishFiles = unique(Object.values(publishArtifactFiles));
const copiedPublishFiles = Object.fromEntries(
  [...Object.entries(copiedArtifacts), ...Object.entries(runtimeCopiedArtifacts)]
    .map(([id, { source, file }]) => [
      id,
      [join(root, source), join(distRoot, file)]
    ])
);
const check = process.argv.includes("--check");
const clean = process.argv.includes("--clean");

if (clean) {
  await rm(distRoot, { recursive: true, force: true });
  for (const file of legacyRootOutFiles) {
    await rm(file, { force: true });
  }
  process.exit(0);
}

const browserBundle = await buildBundle(browserEntry);
if (browserBundle.externalImports.length > 0) {
  throw new Error("Browser bundle must not include external imports.");
}
const streamBundle = await buildBundle(streamEntry);
if (streamBundle.externalImports.length > 0) {
  throw new Error("Stream bundle must not include external imports.");
}
const flowBundle = await buildBundle(flowEntry);
if (flowBundle.externalImports.length > 0) {
  throw new Error("Flow bundle must not include external imports.");
}
const routerBundle = await buildBundle(routerEntry);
if (routerBundle.externalImports.length > 0) {
  throw new Error("Router bundle must not include external imports.");
}
const serverBundle = await buildBundle(serverEntry);

const umdNamespaceReservedKeys = await readUmdNamespaceReservedKeys(browserEntry);
assertNoUmdNamespaceConflicts(browserBundle.publicBindings, umdNamespaceReservedKeys);

const browserEsmOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled ESM entry for CDN imports.",
  "",
  browserBundle.bundleBody,
  "",
  `export { ${browserBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const browserEsmMinOutput = await minifyJavaScript(browserEsmOutput, { module: true });
const browserUmdOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled UMD entry for script-tag and CommonJS-style consumers.",
  "(function (root, factory) {",
  "  const namespace = factory();",
  "  if (typeof define === \"function\" && define.amd) {",
  "    define([], function () { return namespace; });",
  "  } else if (typeof module === \"object\" && module.exports) {",
  "    module.exports = namespace;",
  "  } else {",
  "    root.AsyncFramework = namespace;",
  "    root.Async = namespace;",
  "  }",
  "})(typeof globalThis !== \"undefined\" ? globalThis : typeof self !== \"undefined\" ? self : this, function () {",
  "  \"use strict\";",
  indent(browserBundle.bundleBody.trim()),
  `  const api = { ${browserBundle.publicBindings.join(", ")} };`,
  "  assertNoUmdNamespaceConflicts(api, Async);",
  "  Object.assign(Async, api);",
  "  Async.Async = Async;",
  "  return Async;",
  "",
  "  function assertNoUmdNamespaceConflicts(api, target) {",
  "    const conflicts = Object.keys(api).filter((key) => key !== \"Async\" && Object.prototype.hasOwnProperty.call(target, key));",
  "    if (conflicts.length > 0) {",
  "      throw new Error(`UMD Async namespace export conflict: ${conflicts.join(\", \")}.`);",
  "    }",
  "  }",
  "});",
  ""
].join("\n");
const browserUmdMinOutput = await minifyJavaScript(browserUmdOutput, { module: false });
const browserTsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// @ts-nocheck",
  "// Bundled browser TypeScript source entry for TS-aware runtimes and higher-layer tooling.",
  "",
  browserBundle.bundleBody,
  "",
  `export { ${browserBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const streamEsmOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled stream ESM entry for opt-in streaming imports.",
  "",
  streamBundle.bundleBody,
  "",
  `export { ${streamBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const streamEsmMinOutput = await minifyJavaScript(streamEsmOutput, { module: true });
const streamUmdOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled stream UMD entry for opt-in script-tag and CommonJS-style consumers.",
  "(function (root, factory) {",
  "  const namespace = factory();",
  "  if (typeof define === \"function\" && define.amd) {",
  "    define([], function () { return namespace; });",
  "  } else if (typeof module === \"object\" && module.exports) {",
  "    module.exports = namespace;",
  "  } else {",
  "    root.AsyncFrameworkStream = namespace;",
  "    if (root.Async && typeof root.Async === \"object\") {",
  "      Object.assign(root.Async, namespace);",
  "    }",
  "  }",
  "})(typeof globalThis !== \"undefined\" ? globalThis : typeof self !== \"undefined\" ? self : this, function () {",
  "  \"use strict\";",
  indent(streamBundle.bundleBody.trim()),
  `  return { ${streamBundle.publicBindings.join(", ")} };`,
  "});",
  ""
].join("\n");
const streamUmdMinOutput = await minifyJavaScript(streamUmdOutput, { module: false });
const streamTsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// @ts-nocheck",
  "// Bundled stream TypeScript source entry for TS-aware runtimes and higher-layer tooling.",
  "",
  streamBundle.bundleBody,
  "",
  `export { ${streamBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const flowEsmOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled Flow ESM entry for opt-in Flow imports.",
  "",
  flowBundle.bundleBody,
  "",
  `export { ${flowBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const flowEsmMinOutput = await minifyJavaScript(flowEsmOutput, { module: true });
const flowUmdOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled Flow UMD entry for opt-in script-tag and CommonJS-style consumers.",
  "(function (root, factory) {",
  "  const namespace = factory();",
  "  if (typeof define === \"function\" && define.amd) {",
  "    define([], function () { return namespace; });",
  "  } else if (typeof module === \"object\" && module.exports) {",
  "    module.exports = namespace;",
  "  } else {",
  "    root.AsyncFrameworkFlow = namespace;",
  "  }",
  "})(typeof globalThis !== \"undefined\" ? globalThis : typeof self !== \"undefined\" ? self : this, function () {",
  "  \"use strict\";",
  indent(flowBundle.bundleBody.trim()),
  `  return { ${flowBundle.publicBindings.join(", ")} };`,
  "});",
  ""
].join("\n");
const flowUmdMinOutput = await minifyJavaScript(flowUmdOutput, { module: false });
const flowTsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// @ts-nocheck",
  "// Bundled Flow TypeScript source entry for TS-aware runtimes and higher-layer tooling.",
  "",
  flowBundle.bundleBody,
  "",
  `export { ${flowBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const routerEsmOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled router ESM entry for opt-in router imports.",
  "",
  routerBundle.bundleBody,
  "",
  `export { ${routerBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const routerEsmMinOutput = await minifyJavaScript(routerEsmOutput, { module: true });
const routerUmdOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled router UMD entry for opt-in script-tag and CommonJS-style consumers.",
  "(function (root, factory) {",
  "  const namespace = factory();",
  "  if (typeof define === \"function\" && define.amd) {",
  "    define([], function () { return namespace; });",
  "  } else if (typeof module === \"object\" && module.exports) {",
  "    module.exports = namespace;",
  "  } else {",
  "    root.AsyncFrameworkRouter = namespace;",
  "  }",
  "})(typeof globalThis !== \"undefined\" ? globalThis : typeof self !== \"undefined\" ? self : this, function () {",
  "  \"use strict\";",
  indent(routerBundle.bundleBody.trim()),
  `  return { ${routerBundle.publicBindings.join(", ")} };`,
  "});",
  ""
].join("\n");
const routerUmdMinOutput = await minifyJavaScript(routerUmdOutput, { module: false });
const routerTsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// @ts-nocheck",
  "// Bundled router TypeScript source entry for TS-aware runtimes and higher-layer tooling.",
  "",
  routerBundle.bundleBody,
  "",
  `export { ${routerBundle.publicBindings.join(", ")} };`,
  ""
].join("\n");
const serverEsmOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Bundled server-capable ESM entry for Node.js consumers.",
  serverBundle.externalImports.length > 0 ? "" : null,
  ...serverBundle.externalImports,
  "",
  serverBundle.bundleBody,
  "",
  `export { ${serverBundle.publicBindings.join(", ")} };`,
  ""
].filter((line) => line !== null).join("\n");
const frameworkTsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// @ts-nocheck",
  "// Bundled server-capable TypeScript source entry for TS-aware runtimes and higher-layer tooling.",
  serverBundle.externalImports.length > 0 ? "" : null,
  ...serverBundle.externalImports,
  "",
  serverBundle.bundleBody,
  "",
  `export { ${serverBundle.publicBindings.join(", ")} };`,
  ""
].filter((line) => line !== null).join("\n");
const fullBrowserDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Browser type declarations for @async/framework/browser.",
  "",
  "export type RuntimeTarget = \"browser\" | \"server\";",
  "export type RouterMode = \"csr\" | \"spa\" | \"signals\" | \"ssr\" | \"mpa\";",
  "export type RouterUrlMode = \"path\" | \"hash\";",
  "export type RouteRenderMode = \"partial\" | \"none\";",
  "export type LoaderSwapScan = \"auto\" | \"full\" | \"none\";",
  "export type LoaderSwapManyScan = LoaderSwapScan | \"once\";",
  "export type LoaderSwapStrategy = \"replace\" | \"morph\";",
  "export type AsyncSignalStatus = \"idle\" | \"loading\" | \"ready\" | \"error\";",
  "export type MaybePromise<T> = T | Promise<T>;",
  "export type Cleanup = () => void;",
  "export declare const asyncErrorCodes: {",
  "  readonly runtimeError: \"runtime-error\";",
  "  readonly handlerNotRegistered: \"handler-not-registered\";",
  "  readonly invalidHandlerCommand: \"invalid-handler-command\";",
  "  readonly serverCommandUnavailable: \"server-command-unavailable\";",
  "  readonly handlerFailed: \"handler-failed\";",
  "  readonly componentNotRegistered: \"component-not-registered\";",
  "  readonly asyncComponentUnsupported: \"async-component-unsupported\";",
  "  readonly partialNotRegistered: \"partial-not-registered\";",
  "  readonly boundaryNotFound: \"boundary-not-found\";",
  "  readonly routeNotMatched: \"route-not-matched\";",
  "  readonly navigationFailed: \"navigation-failed\";",
  "  readonly entrypointRequired: \"entrypoint-required\";",
  "  readonly invalidServerTransportResponse: \"invalid-server-transport-response\";",
  "  readonly unsupportedServerJsonValue: \"unsupported-server-json-value\";",
  "};",
  "export type AsyncErrorCode = typeof asyncErrorCodes[keyof typeof asyncErrorCodes];",
  "export type AsyncDiagnosticContextValue = string | number | boolean | null;",
  "export interface AsyncDiagnostic {",
  "  readonly severity: \"error\";",
  "  readonly code: AsyncErrorCode;",
  "  readonly message: string;",
  "  readonly hint?: string;",
  "  readonly context?: Readonly<Record<string, AsyncDiagnosticContextValue>>;",
  "}",
  "export interface AsyncErrorReport {",
  "  readonly error: unknown;",
  "  readonly diagnostic: AsyncDiagnostic;",
  "}",
  "export type AsyncErrorHandler = (report: AsyncErrorReport) => void;",
  "export interface AsyncErrorOptions {",
  "  code: AsyncErrorCode;",
  "  message: string;",
  "  hint?: string;",
  "  context?: Record<string, unknown>;",
  "  cause?: unknown;",
  "}",
  "export interface ToAsyncDiagnosticOptions {",
  "  error: unknown;",
  "  code?: AsyncErrorCode;",
  "  hint?: string;",
  "  context?: Record<string, unknown>;",
  "}",
  "export declare class AsyncError extends Error {",
  "  readonly code: AsyncErrorCode;",
  "  readonly hint?: string;",
  "  readonly context?: Readonly<Record<string, AsyncDiagnosticContextValue>>;",
  "  constructor(options: AsyncErrorOptions);",
  "}",
  "export type RegistryType =",
  "  | \"signal\"",
  "  | \"handler\"",
  "  | \"flow\"",
  "  | \"server\"",
  "  | \"partial\"",
  "  | \"route\"",
  "  | \"component\"",
  "  | \"asyncSignal\"",
  "  | \"cache.browser\"",
  "  | \"cache.server\"",
  "  | \"cache.browser.entries\"",
  "  | \"cache.server.entries\";",
  "",
  "export interface AttributeConfig {",
  "  async?: string | string[];",
  "  class?: string | string[];",
  "  signal?: string | string[];",
  "  intersect?: string | string[];",
  "  on?: string | string[];",
  "}",
  "",
  "export interface NormalizedAttributeConfig {",
  "  async: string[];",
  "  class: string[];",
  "  signal: string[];",
  "  intersect: string[];",
  "  on: string[];",
  "}",
  "",
  "export type TemplatePrimitive = string | number | boolean | null | undefined;",
  "export type TemplateLike = TemplateResult | Children | TemplatePrimitive | Node | TemplateLike[];",
  "export type ChildrenInput = TemplateLike | ((this: ComponentContext) => TemplateLike);",
  "export interface LazyDescriptor {",
  "  url: string;",
  "  [key: string]: unknown;",
  "}",
  "export interface RegistryAssetsConfig {",
  "  baseUrl?: string;",
  "  paths?: Partial<Record<\"component\" | \"handler\" | \"asyncSignal\" | \"partial\" | \"route\", string>>;",
  "}",
  "export interface LazyRegistry {",
  "  registryAssets: Required<Pick<RegistryAssetsConfig, \"baseUrl\">> & { paths: Record<string, string> };",
  "  resolveUrl(type: \"component\" | \"handler\" | \"asyncSignal\" | \"partial\" | \"route\", id: string, descriptor: LazyDescriptor): { moduleUrl: string; exportNames: string[]; url: string };",
  "  resolve<T = unknown>(type: \"component\" | \"handler\" | \"asyncSignal\" | \"partial\" | \"route\", id: string, descriptor: LazyDescriptor): Promise<T>;",
  "  inspect(): { registryAssets: unknown; modules: string[]; exports: string[] };",
  "}",
  "",
  "export interface TemplateResult {",
  "  readonly strings: TemplateStringsArray;",
  "  readonly values: readonly unknown[];",
  "}",
  "",
  "export interface Children {",
  "  readonly __asyncChildrenBrand: true;",
  "}",
  "",
  "export type SchedulerStrategy = \"microtask\" | \"manual\";",
  "export type SchedulerPhase = \"binding\" | \"lifecycle\" | \"effect\" | \"async\" | \"post\" | string;",
  "export interface SchedulerJob {",
  "  id: number;",
  "  phase: SchedulerPhase;",
  "  scope?: unknown;",
  "  boundary?: string;",
  "  key?: string;",
  "  canceled: boolean;",
  "  cancel(): void;",
  "}",
  "export interface SchedulerOptions {",
  "  strategy?: SchedulerStrategy;",
  "  phases?: SchedulerPhase[];",
  "  maxDepth?: number;",
  "  onError?(error: unknown, job: SchedulerJob): void;",
  "}",
  "export interface SchedulerInspection {",
  "  strategy: SchedulerStrategy;",
  "  phases: SchedulerPhase[];",
  "  pending: Record<string, number>;",
  "  scopesDestroyed: number;",
  "  flushing: boolean;",
  "  scheduled: boolean;",
  "}",
  "export interface Scheduler {",
  "  strategy: SchedulerStrategy;",
  "  phases: SchedulerPhase[];",
  "  batch<T>(fn: () => T): T;",
  "  enqueue(phase: SchedulerPhase, job: () => MaybePromise<unknown>, options?: { scope?: unknown; boundary?: string; key?: string }): Cleanup;",
  "  flush(): Promise<void>;",
  "  flushScope(scope: unknown): Promise<void>;",
  "  afterFlush(job: () => MaybePromise<unknown>, options?: { scope?: unknown; boundary?: string; key?: string }): Cleanup;",
  "  cancelScope(scope: unknown): this;",
  "  markScopeDestroyed(scope: unknown): this;",
  "  isScopeDestroyed(scope: unknown): boolean;",
  "  destroy(): void;",
  "  inspect(): SchedulerInspection;",
  "}",
  "",
  "export interface RequestContextStore {",
  "  run<T>(context: Record<string, unknown> | undefined, fn: () => T): T;",
  "  get(): Record<string, unknown> | undefined;",
  "  snapshot(): Record<string, unknown>;",
  "}",
  "",
  "export interface Signal<T = unknown> {",
  "  readonly kind: \"signal\";",
  "  value: T;",
  "  set(value: T): T;",
  "  update(fn: (value: T) => T): T;",
  "  subscribe(fn: (value: T) => void): Cleanup;",
  "  snapshot(): T;",
  "}",
  "",
  "export interface ComputedSignal<T = unknown> extends Omit<Signal<T>, \"kind\"> {",
  "  readonly kind: \"computed\";",
  "}",
  "",
  "export interface EffectDefinition {",
  "  readonly kind: \"effect\";",
  "  readonly fn: () => unknown;",
  "}",
  "",
  "export interface AsyncSignalSnapshot<T = unknown> {",
  "  value: T | undefined;",
  "  loading: boolean;",
  "  error: unknown;",
  "  status: AsyncSignalStatus;",
  "  version: number;",
  "}",
  "",
  "export interface AsyncSignal<T = unknown> extends Omit<Signal<T | undefined>, \"kind\" | \"snapshot\"> {",
  "  readonly kind: \"async-signal\";",
  "  readonly id: string;",
  "  readonly loading: boolean;",
  "  readonly error: unknown;",
  "  readonly status: AsyncSignalStatus;",
  "  readonly version: number;",
  "  refresh(): Promise<T | undefined>;",
  "  cancel(reason?: unknown): void;",
  "  snapshot(): AsyncSignalSnapshot<T>;",
  "}",
  "",
  "export interface SignalRef<T = unknown> {",
  "  readonly kind: \"signal-ref\";",
  "  readonly id: string;",
  "  value: T;",
  "  readonly loading: boolean;",
  "  readonly error: unknown;",
  "  readonly status: AsyncSignalStatus;",
  "  readonly version: number;",
  "  get(): T;",
  "  set(value: T): T;",
  "  update(fn: (value: T) => T): T;",
  "  subscribe(fn: (value: T, info?: SignalSubscriptionInfo) => void): Cleanup;",
  "  refresh(): Promise<T | undefined>;",
  "  cancel(reason?: unknown): void;",
  "  toString(): string;",
  "}",
  "",
  "export interface SignalSubscriptionInfo {",
  "  id: string;",
  "  path: string;",
  "  signal: unknown;",
  "}",
  "",
  "export type SignalLike<T = unknown> = Signal<T> | AsyncSignal<T> | ComputedSignal<T>;",
  "export type SignalMap = Record<string, SignalLike | unknown>;",
  "",
  "export interface AsyncSignalContext {",
  "  signals: SignalRegistry;",
  "  id: string;",
  "  version: number;",
  "  abort: AbortSignal & { cancel?(reason?: unknown): void };",
  "  server?: ServerNamespace;",
  "  router?: Router;",
  "  loader?: LoaderInstance;",
  "  cache?: CacheRegistry;",
  "  scheduler?: Scheduler;",
  "  refresh(): Promise<unknown>;",
  "}",
  "",
  "export type AsyncSignalFunction<T = unknown> = (this: AsyncSignalContext) => MaybePromise<T>;",
  "",
  "export interface RegistryInspection<T = unknown> {",
  "  registry: RegistryStore;",
  "  keys(): string[];",
  "  entries(): Array<[string, T]>;",
  "  inspect(): Array<[string, T]>;",
  "}",
  "",
  "export interface SignalRegistry extends RegistryInspection {",
  "  register<T = unknown>(id: string, signalLike: SignalLike<T> | T): SignalRef<T>;",
  "  registerMany(map?: SignalMap): this;",
  "  unregister(id: string): boolean;",
  "  ensure<T = unknown>(id: string, initial: T): SignalRef<T>;",
  "  has(id: string): boolean;",
  "  get<T = unknown>(path: string): T;",
  "  set<T = unknown>(path: string, value: T): T;",
  "  update<T = unknown>(path: string, fn: (value: T) => T): T;",
  "  ref<T = unknown>(id: string): SignalRef<T>;",
  "  subscribe<T = unknown>(path: string, fn: (value: T, info: SignalSubscriptionInfo) => void): Cleanup;",
  "  snapshot(): Record<string, unknown>;",
  "  asyncSignal<T = unknown>(id: string, fn: AsyncSignalFunction<T>): SignalRef<T>;",
  "  effect(fn: () => unknown): Cleanup;",
  "  destroy(): void;",
  "}",
  "",
  "export interface HandlerContext {",
  "  signals: SignalRegistry;",
  "  handlers: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  loader?: LoaderInstance;",
  "  router?: Router;",
  "  cache?: CacheRegistry;",
  "  scheduler?: Scheduler;",
  "  event?: Event;",
  "  element?: Element;",
  "  el?: Element;",
  "  root?: Document | Element;",
  "  input?: unknown;",
  "  stop(): void;",
  "  [key: string]: unknown;",
  "}",
  "",
  "export type HandlerFunction = (this: HandlerContext, context: HandlerContext) => MaybePromise<unknown>;",
  "",
  "export interface FlowRuntimeRef<T = unknown> {",
  "  readonly kind: string;",
  "  value: T;",
  "  get(): T;",
  "  set?(value: T): T;",
  "  update?(fn: (value: T) => T): T;",
  "  subscribe(fn: (value: T) => void): Cleanup;",
  "  snapshot(): T;",
  "}",
  "export interface FlowInstance {",
  "  store: Record<string, unknown>;",
  "  refs: Record<string, FlowRuntimeRef>;",
  "  handlers: Record<string, (input?: unknown) => MaybePromise<unknown>>;",
  "  get<T = unknown>(name: string): T;",
  "  set<T = unknown>(name: string, value: T): T;",
  "  update<T = unknown>(name: string, fn: (current: T) => T): T;",
  "  run(name: string, input?: unknown): MaybePromise<unknown>;",
  "  snapshot(): Record<string, unknown>;",
  "  restore(snapshot: Record<string, unknown>): void;",
  "  destroy(): void;",
  "}",
  "export type FlowStep = (store: Record<string, unknown>, input?: unknown) => MaybePromise<unknown>;",
  "export type FlowPredicate = (store: Record<string, unknown>, input?: unknown) => boolean;",
  "export type FlowSignalDeclaration<T = unknown> = T | { readonly kind: string; [key: string]: unknown } | FlowStep;",
  "export interface FlowConfig {",
  "  store?: Record<string, FlowSignalDeclaration>;",
  "  on?: Record<string, FlowStep>;",
  "}",
  "export interface FlowDefinition {",
  "  readonly kind: \"flow\";",
  "  readonly definition: unknown;",
  "}",
  "",
  "export interface HandlerRegistry extends RegistryInspection<HandlerFunction> {",
  "  register(id: string, fn: HandlerFunction | LazyDescriptor): string;",
  "  registerMany(map?: Record<string, HandlerFunction | LazyDescriptor>): this;",
  "  unregister(id: string): boolean;",
  "  resolve(id: string): HandlerFunction | undefined;",
  "  run(ref: string, context?: Partial<HandlerContext>): Promise<unknown[]>;",
  "}",
  "",
  "export interface ServerEnvelope<T = unknown> {",
  "  value?: T;",
  "  signals?: Record<string, unknown>;",
  "  boundary?: string;",
  "  html?: TemplateLike;",
  "  redirect?: string;",
  "  error?: unknown;",
  "  status?: number;",
  "  cache?: { browser?: Record<string, unknown>; server?: Record<string, unknown> };",
  "}",
  "",
  "export type ServerResult<T = unknown> = T | ServerEnvelope<T>;",
  "",
  "export interface ServerContext {",
  "  id: string;",
  "  args: unknown[];",
  "  input?: unknown;",
  "  signals?: SignalRegistry | { get(path: string): unknown; snapshot?(): Record<string, unknown> };",
  "  request?: Request;",
  "  headers?: Headers;",
  "  cookies?: unknown;",
  "  locals?: unknown;",
  "  abort?: AbortSignal;",
  "  cache?: CacheRegistry;",
  "  scheduler?: Scheduler;",
  "  server: ServerNamespace;",
  "  [key: string]: unknown;",
  "}",
  "",
  "export type ServerFunction<T = unknown> = (this: ServerContext, ...args: unknown[]) => MaybePromise<ServerResult<T>>;",
  "export type ServerProxyTransport = (url: string, init: RequestInit) => MaybePromise<Response>;",
  "",
  "export interface ServerNamespace {",
  "  run<T = unknown>(id: string, args?: unknown[], context?: Partial<ServerContext>): Promise<T>;",
  "  register?(id: string, fn: ServerFunction): string;",
  "  registerMany?(map?: Record<string, ServerFunction>): this;",
  "  unregister?(id: string): boolean;",
  "  resolve?(id: string): ServerFunction | undefined;",
  "  _setContext?(context?: Record<string, unknown>): this;",
  "  _withContext?(context?: Record<string, unknown>): ServerNamespace;",
  "  [key: string]: unknown;",
  "}",
  "",
  "export interface ServerProxyOptions {",
  "  endpoint?: string;",
  "  transport: ServerProxyTransport;",
  "  signals?: SignalRegistry;",
  "  loader?: LoaderInstance;",
  "  router?: Router;",
  "  cache?: CacheRegistry;",
  "  scheduler?: Scheduler;",
  "  headers?: Record<string, string>;",
  "}",
  "",
  "export interface CacheDefinition {",
  "  readonly kind: \"cache-definition\";",
  "  store: string;",
  "  ttl?: number;",
  "}",
  "",
  "export interface CacheRegistry extends RegistryInspection<CacheDefinition> {",
  "  register(id: string, definition?: CacheDefinition | CacheDefinitionOptions): string;",
  "  registerMany(map?: Record<string, CacheDefinition | CacheDefinitionOptions>): this;",
  "  unregister(id: string): boolean;",
  "  resolve(id: string): CacheDefinition | undefined;",
  "  get<T = unknown>(key: string): T | undefined;",
  "  set<T = unknown>(key: string, value: T, options?: CacheSetOptions): T;",
  "  getOrSet<T = unknown>(key: string, fn: () => MaybePromise<T>, options?: CacheSetOptions): Promise<T>;",
  "  delete(key: string): boolean;",
  "  clear(prefix?: string): this;",
  "  snapshot(): Record<string, unknown>;",
  "  restore(snapshot?: Record<string, unknown>): this;",
  "  entryKeys(): string[];",
  "  entryEntries(): Array<[string, unknown]>;",
  "}",
  "",
  "export interface CacheDefinitionOptions {",
  "  store?: string;",
  "  ttl?: number;",
  "}",
  "",
  "export interface CacheSetOptions {",
  "  ttl?: number;",
  "  cache?: string;",
  "}",
  "",
  "export interface PartialContext {",
  "  id: string;",
  "  props: Record<string, unknown>;",
  "  params?: Record<string, string>;",
  "  route?: RouteDefinition;",
  "  signals?: SignalRegistry;",
  "  handlers?: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  cache?: CacheRegistry;",
  "  browserCache?: CacheRegistry;",
  "  partials: PartialRegistry;",
  "  abort?: AbortSignal;",
  "  scheduler?: Scheduler;",
  "  request?: Request;",
  "  locals?: unknown;",
  "  [key: string]: unknown;",
  "}",
  "",
  "export type PartialFunction = (this: PartialContext, props: Record<string, unknown>) => MaybePromise<TemplateLike | ServerEnvelope>;",
  "",
  "export interface PartialRegistry extends RegistryInspection<PartialFunction> {",
  "  register(id: string, fn: PartialFunction | LazyDescriptor): string;",
  "  registerMany(map?: Record<string, PartialFunction | LazyDescriptor>): this;",
  "  unregister(id: string): boolean;",
  "  resolve(id: string): PartialFunction | undefined;",
  "  render(id: string, props?: Record<string, unknown>, context?: Partial<PartialContext>): Promise<ServerEnvelope>;",
  "}",
  "",
  "export interface RouteDefinition {",
  "  partial?: string;",
  "  load?: string;",
  "  render?: RouteRenderMode;",
  "  meta?: Record<string, unknown>;",
  "  [key: string]: unknown;",
  "}",
  "",
  "export interface RouteMatch {",
  "  pattern: string;",
  "  params: Record<string, string>;",
  "  route: RouteDefinition;",
  "}",
  "",
  "export interface RouterNavigationOptions {",
  "  replace?: boolean;",
  "  initial?: boolean;",
  "  source?: string;",
  "  history?: boolean;",
  "  force?: boolean;",
  "}",
  "",
  "export interface RouteRegistry {",
  "  registry: RegistryStore;",
  "  register(pattern: string, definition: RouteDefinition | string): RouteMatch;",
  "  registerMany(map?: Record<string, RouteDefinition | string>): this;",
  "  unregister(pattern: string): boolean;",
  "  match(url: string | URL): RouteMatch | null;",
  "  entries(): Array<{ pattern: string; route: RouteDefinition }>;",
  "  keys(): string[];",
  "  inspect(): Array<[string, RouteDefinition]>;",
  "}",
  "",
  "export interface RouterOptions {",
  "  mode?: RouterMode;",
  "  urlMode?: RouterUrlMode;",
  "  root?: Document | Element;",
  "  boundary?: string;",
  "  loader?: LoaderInstance;",
  "  handlers?: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  cache?: CacheRegistry;",
  "  attributes?: AttributeConfig;",
  "  scheduler?: Scheduler;",
  "  onError?: AsyncErrorHandler;",
  "}",
  "",
  "export interface Router {",
  "  mode: RouterMode;",
  "  urlMode: RouterUrlMode;",
  "  root: Document | Element;",
  "  boundary: string;",
  "  routes: RouteRegistry;",
  "  loader: LoaderInstance;",
  "  signals: SignalRegistry;",
  "  handlers: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  cache?: CacheRegistry;",
  "  partials?: PartialRegistry;",
  "  scheduler: Scheduler;",
  "  attributes: NormalizedAttributeConfig;",
  "  onError?: AsyncErrorHandler;",
  "  start(): this;",
  "  match(url: string | URL): RouteMatch | null;",
  "  prefetch(url: string | URL): Promise<unknown>;",
  "  navigate(url: string | URL, options?: RouterNavigationOptions): Promise<unknown>;",
  "  destroy(): void;",
  "}",
  "",
  "export interface AsyncRouterFacadeInspection {",
  "  ready: boolean;",
  "  pending: number;",
  "  mode?: RouterMode;",
  "  urlMode?: RouterUrlMode;",
  "}",
  "",
  "export interface AsyncRouterFacade {",
  "  loader: AsyncLoaderFacade;",
  "  readonly current?: Router;",
  "  ready(): Promise<Router>;",
  "  match(url: string | URL): RouteMatch | null;",
  "  navigate(url: string | URL, options?: RouterNavigationOptions): Promise<unknown>;",
  "  prefetch(url: string | URL): Promise<unknown>;",
  "  inspect(): AsyncRouterFacadeInspection;",
  "}",
  "",
  "export type LifecycleEventName = \"attach\" | \"visible\" | \"intersect\" | \"destroy\";",
  "",
  "export interface IntersectionFallbackEntry {",
  "  target: Element;",
  "  isIntersecting: boolean;",
  "  intersectionRatio: number;",
  "  time: number;",
  "  rootBounds: DOMRectReadOnly | null;",
  "  boundingClientRect: DOMRect | DOMRectReadOnly | null;",
  "  intersectionRect: DOMRect | DOMRectReadOnly | null;",
  "}",
  "",
  "export interface IntersectionEvent {",
  "  target: Element;",
  "  element: Element;",
  "  el: Element;",
  "  root: Document | Element | DocumentFragment;",
  "  entry: IntersectionObserverEntry | IntersectionFallbackEntry;",
  "  entries: Array<IntersectionObserverEntry | IntersectionFallbackEntry>;",
  "  observer: IntersectionObserver | null;",
  "  isIntersecting: boolean;",
  "  intersectionRatio: number;",
  "  unsupported: boolean;",
  "}",
  "",
  "export interface IntersectionOptions {",
  "  root?: Element | Document | null;",
  "  rootMargin?: string;",
  "  threshold?: number | number[];",
  "  once?: boolean;",
  "  schedule?: \"lifecycle\" | \"sync\";",
  "  key?: string;",
  "}",
  "",
  "export type LoaderSwapStrategy = \"replace\" | \"morph\";",
  "export type LoaderSwapAttach = \"preserve\" | \"rebind\";",
  "export interface LoaderSwapOptions {",
  "  scan?: LoaderSwapScan;",
  "  strategy?: LoaderSwapStrategy;",
  "  attach?: LoaderSwapAttach;",
  "}",
  "export interface LoaderSwapManyOptions {",
  "  scan?: LoaderSwapManyScan;",
  "  strategy?: LoaderSwapStrategy;",
  "  ifChanged?: boolean;",
  "  attach?: LoaderSwapAttach;",
  "}",
  "export interface LoaderSwapManyEntry {",
  "  html: TemplateLike | LoaderSwapRenderFunction;",
  "  strategy?: LoaderSwapStrategy;",
  "  attach?: LoaderSwapAttach;",
  "}",
  "export type LoaderSwapManyUpdateValue = TemplateLike | LoaderSwapRenderFunction | LoaderSwapManyEntry;",
  "export interface LoaderSwapBindOptions extends LoaderSwapOptions {",
  "  deps?: string[];",
  "}",
  "export interface LoaderSwapRenderContext {",
  "  boundary: Element;",
  "  boundaryId: string;",
  "  loader: LoaderInstance;",
  "  signals: SignalRegistry;",
  "  handlers: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  router?: Router;",
  "  cache?: CacheRegistry;",
  "  scheduler: Scheduler;",
  "}",
  "export type LoaderSwapRenderFunction = (this: LoaderInstance, context: LoaderSwapRenderContext) => TemplateLike;",
  "export type LoaderBoundaryRenderFunction = LoaderSwapRenderFunction;",
  "export type LoaderSwapManyUpdates = Record<string, LoaderSwapManyUpdateValue> | Map<string, LoaderSwapManyUpdateValue> | Iterable<readonly [string, LoaderSwapManyUpdateValue]>;",
  "export interface LoaderSwapReplaceConfig extends LoaderSwapOptions {",
  "  type?: \"replace\";",
  "  boundary?: string;",
  "  boundaryId?: string;",
  "  html: TemplateLike;",
  "}",
  "export interface LoaderSwapIfChangedConfig extends LoaderSwapOptions {",
  "  type: \"ifChanged\";",
  "  boundary?: string;",
  "  boundaryId?: string;",
  "  html?: TemplateLike | LoaderSwapRenderFunction;",
  "  render?: LoaderSwapRenderFunction;",
  "}",
  "export interface LoaderSwapManyConfig extends LoaderSwapManyOptions {",
  "  type?: \"many\";",
  "  updates: LoaderSwapManyUpdates;",
  "}",
  "export interface LoaderSwapBindConfig extends LoaderSwapBindOptions {",
  "  type: \"bind\";",
  "  boundary?: string;",
  "  boundaryId?: string;",
  "  render: LoaderBoundaryRenderFunction;",
  "}",
  "export type LoaderRefreshScopePlan = string[] | {",
  "  boundaries: string[];",
  "  render?: (this: LoaderInstance, context: LoaderSwapRenderContext) => LoaderSwapManyUpdates;",
  "  ifChanged?: boolean;",
  "  scan?: LoaderSwapManyScan;",
  "};",
  "export type LoaderRefreshPlan = Record<string, LoaderRefreshScopePlan>;",
  "export interface LoaderRefreshOptions {",
  "  ifChanged?: boolean;",
  "  scan?: LoaderSwapManyScan;",
  "  strategy?: LoaderSwapStrategy;",
  "}",
  "export type LoaderSwapConfig = LoaderSwapReplaceConfig | LoaderSwapIfChangedConfig | LoaderSwapManyConfig | LoaderSwapBindConfig;",
  "",
  "export type IntersectionCallback = (this: ComponentContext, event: IntersectionEvent) => unknown;",
  "",
  "export interface ComponentContext {",
  "  scope: string;",
  "  signals: SignalRegistry;",
  "  handlers: HandlerRegistry;",
  "  loader: LoaderInstance;",
  "  server?: ServerNamespace;",
  "  router?: Router;",
  "  cache?: CacheRegistry;",
  "  scheduler?: Scheduler;",
  "  signal<T = unknown>(initial: T): SignalRef<T>;",
  "  signal<T = unknown>(name: string, initial: T): SignalRef<T>;",
  "  computed<T = unknown>(name: string, fn: (this: ComponentContext) => T): SignalRef<T>;",
  "  asyncSignal<T = unknown>(name: string, fn: AsyncSignalFunction<T>): SignalRef<T>;",
  "  effect(fn: (this: ComponentContext) => unknown): Cleanup;",
  "  handler(fn: HandlerFunction): string;",
  "  handler(name: string, fn: HandlerFunction): string;",
  "  render<TProps extends object = Record<string, unknown>>(Child: ComponentFunction<TProps>, props?: Omit<TProps, \"children\">, children?: ChildrenInput): TemplateLike;",
  "  suspense(signalRef: Pick<SignalRef, \"id\">, views: SuspenseViews | SuspenseReadyView): TemplateLike;",
  "  on(eventName: \"intersect\", fn: IntersectionCallback): void;",
  "  on(eventName: \"intersect\", options: IntersectionOptions | undefined | null, fn: IntersectionCallback): void;",
  "  on(eventName: Exclude<LifecycleEventName, \"intersect\">, fn: (this: ComponentContext, target?: Element) => unknown): void;",
  "  onAttach(fn: (this: ComponentContext, target?: Element) => unknown): void;",
  "  onVisible(fn: (this: ComponentContext, target?: Element) => unknown): void;",
  "  intersect(target: Element, fn: IntersectionCallback): Cleanup;",
  "  intersect(target: Element, options: IntersectionOptions | undefined | null, fn: IntersectionCallback): Cleanup;",
  "}",
  "",
  "export type ComponentFunction<TProps extends object = Record<string, unknown>> = (this: ComponentContext, props: TProps) => TemplateLike;",
  "export type SuspenseReadyView = (this: ComponentContext, signalRef: Pick<SignalRef, \"id\">) => TemplateLike;",
  "export interface SuspenseViews {",
  "  loading?: SuspenseReadyView;",
  "  ready?: SuspenseReadyView;",
  "  error?: SuspenseReadyView;",
  "}",
  "",
  "export interface ComponentRegistry extends RegistryInspection<ComponentFunction> {",
  "  register(id: string, Component: ComponentFunction | LazyDescriptor): string;",
  "  registerMany(map?: Record<string, ComponentFunction | LazyDescriptor>): this;",
  "  unregister(id: string): boolean;",
  "  resolve(id: string): ComponentFunction | undefined;",
  "}",
  "",
  "export interface LoaderOptions {",
  "  root?: Document | Element | DocumentFragment;",
  "  signals?: SignalRegistry;",
  "  handlers?: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  router?: Router;",
  "  cache?: CacheRegistry;",
  "  scheduler?: Scheduler;",
  "  attributes?: AttributeConfig;",
  "  onError?: AsyncErrorHandler;",
  "}",
  "",
  "export interface LoaderInstance {",
  "  root: Document | Element | DocumentFragment;",
  "  signals: SignalRegistry;",
  "  handlers: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  router?: Router;",
  "  cache?: CacheRegistry;",
  "  scheduler: Scheduler;",
  "  attributes: NormalizedAttributeConfig;",
  "  onError?: AsyncErrorHandler;",
  "  start(): this;",
  "  scan(rootOrFragment?: Document | Element | DocumentFragment): this;",
  "  swap(config: LoaderSwapManyConfig): Element[];",
  "  swap(config: LoaderSwapBindConfig): Cleanup;",
  "  swap(config: LoaderSwapIfChangedConfig): Element;",
  "  swap(config: LoaderSwapReplaceConfig): Element;",
  "  swap(boundaryId: string, fragmentOrTemplate: TemplateLike, options?: LoaderSwapOptions): Element;",
  "  defineRefreshPlan(plan: LoaderRefreshPlan): this;",
  "  refresh(scope: string, updates?: LoaderSwapManyUpdates, options?: LoaderRefreshOptions): Element[];",
  "  attach<TProps extends object = Record<string, unknown>>(target: Element, Component: ComponentFunction<TProps>, props?: TProps): unknown;",
  "  destroy(): void;",
  "}",
  "",
  "export type AsyncLoaderOptions = LoaderOptions;",
  "export type AsyncLoaderInstance = LoaderInstance;",
  "export interface AsyncLoaderFacadeInspection {",
  "  ready: boolean;",
  "  pending: number;",
  "  root?: Document | Element | DocumentFragment;",
  "}",
  "",
  "export interface AsyncLoaderFacade {",
  "  readonly current?: LoaderInstance;",
  "  ready(): Promise<LoaderInstance>;",
  "  scan(rootOrFragment?: Document | Element | DocumentFragment): Promise<LoaderInstance>;",
  "  swap(config: LoaderSwapManyConfig): Promise<Element[]>;",
  "  swap(config: LoaderSwapBindConfig): Promise<Cleanup>;",
  "  swap(config: LoaderSwapIfChangedConfig): Promise<Element>;",
  "  swap(config: LoaderSwapReplaceConfig): Promise<Element>;",
  "  swap(boundaryId: string, fragmentOrTemplate: TemplateLike, options?: LoaderSwapOptions): Promise<Element>;",
  "  defineRefreshPlan(plan: LoaderRefreshPlan): Promise<LoaderInstance>;",
  "  refresh(scope: string, updates?: LoaderSwapManyUpdates, options?: LoaderRefreshOptions): Promise<Element[]>;",
  "  attach<TProps extends object = Record<string, unknown>>(target: Element, Component: ComponentFunction<TProps>, props?: TProps): Promise<unknown>;",
  "  inspect(): AsyncLoaderFacadeInspection;",
  "}",
  "",
  "",
  "export type AttributePatchValue = string | number | boolean | null | undefined;",
  "export type BuiltAttributePatchTriples = readonly AttributePatchValue[];",
  "export type NoBuildAttributePatchTuple = readonly [targetName: string, attrName: string, value: AttributePatchValue];",
  "export type NoBuildAttributePatchTuples = readonly NoBuildAttributePatchTuple[];",
  "export interface StreamReplacement {",
  "  target: string;",
  "  html?: TemplateLike;",
  "  template?: string;",
  "  mode?: \"pending\" | \"boundary\";",
  "}",
  "export interface StreamRevealMetadata {",
  "  group: string;",
  "  index: number;",
  "  count: number;",
  "  order?: \"as-ready\" | \"forwards\" | \"backwards\" | \"together\";",
  "  tail?: \"collapsed\" | \"hidden\";",
  "}",
  "export interface BoundaryPatch {",
  "  boundary: string;",
  "  seq: number;",
  "  html?: TemplateLike;",
  "  replace?: StreamReplacement | readonly StreamReplacement[];",
  "  attrs?: BuiltAttributePatchTriples | NoBuildAttributePatchTuples;",
  "  reveal?: StreamRevealMetadata;",
  "  signals?: Record<string, unknown>;",
  "  cache?: { browser?: Record<string, unknown> };",
  "  redirect?: string;",
  "  error?: unknown;",
  "  parentScope?: string;",
  "  scope?: string;",
  "  meta?: Record<string, unknown>;",
  "}",
  "",
  "export interface BoundaryPatchCounts {",
  "  applied: number;",
  "  ignored?: number;",
  "}",
  "",
  "export type BoundaryApplyResult =",
  "  | { status: \"applied\"; boundary: string; seq: number; attrs?: BoundaryPatchCounts; replace?: BoundaryPatchCounts }",
  "  | { status: \"buffered\"; boundary: string; seq: number; reveal: Required<Pick<StreamRevealMetadata, \"group\" | \"index\" | \"count\">> & Pick<StreamRevealMetadata, \"order\" | \"tail\"> }",
  "  | { status: \"ignored-stale\"; boundary: string; seq: number; lastSeq: number }",
  "  | { status: \"ignored-destroyed\"; boundary: string; seq: number; parentScope?: string }",
  "  | { status: \"redirected\"; boundary: string; seq: number; redirect: string; attrs?: BoundaryPatchCounts; replace?: BoundaryPatchCounts }",
  "  | { status: \"errored\"; boundary: string; seq: number; error: Error };",
  "",
  "export interface BoundaryReceiverInspection {",
  "  destroyed: boolean;",
  "  boundaries: Record<string, { lastSeq: number; applied: number; ignored: number; errored?: number; lastStatus?: BoundaryApplyResult[\"status\"] }>;",
  "  reveal: Record<string, { count: number; order: string; tail?: string; pending: number[]; committed: number[] }>;",
  "  recent: Array<{ boundary: string; seq: number; status: BoundaryApplyResult[\"status\"]; lastSeq?: number; parentScope?: string; redirect?: string; attrs?: BoundaryPatchCounts; replace?: BoundaryPatchCounts; reveal?: StreamRevealMetadata }>;",
  "}",
  "",
  "export interface BoundaryReceiverOptions {",
  "  loader: LoaderInstance;",
  "  signals?: SignalRegistry;",
  "  cache?: CacheRegistry;",
  "  scheduler?: Scheduler;",
  "  router?: Router;",
  "  attributes?: AttributeConfig;",
  "  onApply?(result: BoundaryApplyResult, patch: BoundaryPatch): void;",
  "  onIgnore?(result: BoundaryApplyResult, patch: BoundaryPatch): void;",
  "  onError?(error: Error, result: BoundaryApplyResult, patch: BoundaryPatch): void;",
  "  throwOnError?: boolean;",
  "  recentLimit?: number;",
  "  isScopeDestroyed?(scope: string): boolean;",
  "}",
  "",
  "export interface BoundaryReceiver {",
  "  apply(patch: BoundaryPatch): Promise<BoundaryApplyResult>;",
  "  inspect(): BoundaryReceiverInspection;",
  "  reset(boundary?: string): this;",
  "  destroy(): void;",
  "}",
  "",
  "export interface AsyncStreamApplyOptions extends Partial<BoundaryReceiverOptions> {",
  "  receiver?: BoundaryReceiver;",
  "  runtime?: AppRuntime;",
  "  root?: Document | Element | DocumentFragment;",
  "}",
  "",
  "export interface AsyncStreamNamespace {",
  "  applyScript(script: Element, options?: AsyncStreamApplyOptions): Promise<BoundaryApplyResult>;",
  "  applyCurrentScript(script?: Element, options?: AsyncStreamApplyOptions): Promise<BoundaryApplyResult>;",
  "  applyCurrentScript(options?: AsyncStreamApplyOptions): Promise<BoundaryApplyResult>;",
  "}",
  "",
  "export interface RegistryStore {",
  "  target: RuntimeTarget;",
  "  register(type: RegistryType, id: string, value: unknown): string;",
  "  registerMany(type: RegistryType, map?: Record<string, unknown>): this;",
  "  set(type: RegistryType, id: string, value: unknown): unknown;",
  "  unregister(type: RegistryType, id: string): boolean;",
  "  delete(type: RegistryType, id: string): boolean;",
  "  keys(type: RegistryType, options?: Record<string, unknown>): string[];",
  "  entries(type: RegistryType, options?: Record<string, unknown>): Array<[string, unknown]>;",
  "  has(type: RegistryType, id: string, options?: Record<string, unknown>): boolean;",
  "  get(type: RegistryType, id: string, options?: Record<string, unknown>): unknown;",
  "  snapshot(options?: { target?: RuntimeTarget }): RegistrySnapshot;",
  "  rawSnapshot(): AppDefinition;",
  "  view(options?: { target?: RuntimeTarget }): RegistryStore;",
  "}",
  "",
  "export interface DeclarationRegistryStore extends RegistryStore {",
  "  resolve(kind: string, id: string, options?: Record<string, unknown>): unknown;",
  "  inspectDeclarations(): DeclarationBusInspection;",
  "}",
  "",
  "export type DuplicatePolicy = \"warn\" | \"strict\" | \"ignore\";",
  "export type MaterializationPolicy = \"on-register\" | \"on-start\" | \"on-demand\";",
  "export interface DuplicatePolicyConfig {",
  "  modules?: DuplicatePolicy;",
  "  declarations?: DuplicatePolicy;",
  "  resolvers?: DuplicatePolicy;",
  "}",
  "export interface AsyncUseConfig {",
  "  duplicates?: DuplicatePolicyConfig;",
  "}",
  "export interface SystemIdentity {",
  "  readonly id: string;",
  "  readonly key: symbol;",
  "}",
  "export interface AsyncSystem {",
  "  for(id: string): SystemIdentity;",
  "}",
  "export type DeclarationOwner = SystemIdentity | string | symbol;",
  "export interface DeclarationRecord<T = unknown> {",
  "  kind: string;",
  "  id: string;",
  "  value: T;",
  "  owner?: SystemIdentity;",
  "  policy?: MaterializationPolicy;",
  "}",
  "export interface DeclarationMaterializationContext {",
  "  app?: AppHub;",
  "  registry?: RegistryStore;",
  "  runtime?: AppRuntime;",
  "  declarations?: DeclarationBus;",
  "  module?: InstalledAsyncModule;",
  "}",
  "export interface DeclarationConvention<T = unknown> {",
  "  owner?: DeclarationOwner;",
  "  capability?: DeclarationOwner;",
  "  policy?: MaterializationPolicy;",
  "  materialize?(declaration: DeclarationRecord<T>, context: DeclarationMaterializationContext): unknown;",
  "}",
  "export interface AsyncModuleInstallContext {",
  "  app?: AppHub;",
  "  registry?: RegistryStore;",
  "  declarations: DeclarationBus;",
  "  module: InstalledAsyncModule;",
  "}",
  "export interface AsyncModuleDefinition {",
  "  id?: string;",
  "  owner?: DeclarationOwner;",
  "  system?: DeclarationOwner;",
  "  install?(context: AsyncModuleInstallContext): void;",
  "}",
  "export interface InstalledAsyncModule {",
  "  id: string;",
  "  owner: SystemIdentity;",
  "}",
  "export interface AsyncUseDefinition extends AppDefinition {",
  "  configure?: AsyncUseConfig;",
  "  declaration?: Record<string, Record<string, unknown>>;",
  "  declarations?: Record<string, Record<string, unknown>>;",
  "  convention?: Record<string, DeclarationConvention>;",
  "  conventions?: Record<string, DeclarationConvention>;",
  "  module?: Record<string, AsyncModuleDefinition> | AsyncModuleDefinition | AsyncModuleDefinition[];",
  "  modules?: Record<string, AsyncModuleDefinition> | AsyncModuleDefinition | AsyncModuleDefinition[];",
  "}",
  "export interface DeclarationBusInspection {",
  "  duplicates: Required<DuplicatePolicyConfig>;",
  "  declarations: Record<string, Array<{ id: string; owner?: string; policy?: MaterializationPolicy; materialized: string[] }>>;",
  "  conventions: Record<string, { owner: string; policy: MaterializationPolicy }>;",
  "  modules: Array<{ id: string; owner: string }>;",
  "  collisions: Array<{ scope: string; key: string; policy: DuplicatePolicy; message: string }>;",
  "}",
  "export interface DeclarationBus {",
  "  configure(config?: AsyncUseConfig): this;",
  "  register(kind: string, id: string, value: unknown, context?: Record<string, unknown>): DeclarationRecord | undefined;",
  "  registerMany(kind: string, entries?: Record<string, unknown>, context?: Record<string, unknown>): this;",
  "  registerConventions(map?: Record<string, DeclarationConvention>, context?: Record<string, unknown>): this;",
  "  registerConvention(kind: string, convention?: DeclarationConvention, context?: Record<string, unknown>): DeclarationConvention | undefined;",
  "  installModules(map?: Record<string, AsyncModuleDefinition> | AsyncModuleDefinition | AsyncModuleDefinition[], context?: Record<string, unknown>): this;",
  "  installModule(moduleDefinition?: AsyncModuleDefinition, context?: Record<string, unknown>, fallbackId?: string): InstalledAsyncModule | undefined;",
  "  start(context?: Record<string, unknown>): this;",
  "  resolve(kind: string, id: string, context?: Record<string, unknown>): unknown;",
  "  has(kind: string, id: string): boolean;",
  "  get(kind: string, id: string): unknown;",
  "  keys(kind: string): string[];",
  "  entries(kind: string): Array<[string, unknown]>;",
  "  conventions(): Array<[string, { owner: string; policy: MaterializationPolicy }]>;",
  "  modules(): Array<{ id: string; owner: string }>;",
  "  collisions(): Array<{ scope: string; key: string; policy: DuplicatePolicy; message: string }>;",
  "  inspect(): DeclarationBusInspection;",
  "}",
  "",
  "export interface RegistrySnapshot {",
  "  signal: Record<string, unknown>;",
  "  handler: Record<string, { id?: string } | LazyDescriptor>;",
  "  server: Record<string, { id?: string } | LazyDescriptor>;",
  "  partial: Record<string, { id?: string } | LazyDescriptor>;",
  "  route: Record<string, RouteDefinition>;",
  "  component: Record<string, { id?: string } | LazyDescriptor>;",
  "  asyncSignal: Record<string, { id?: string } | LazyDescriptor>;",
  "  flow: Record<string, FlowDefinition | LazyDescriptor>;",
  "  cache: { browser: Record<string, CacheDefinition>; server: Record<string, CacheDefinition> };",
  "  entries: { browser: Record<string, unknown>; server: Record<string, unknown> };",
  "}",
  "",
  "export interface AppDefinition {",
  "  signal?: SignalMap;",
  "  handler?: Record<string, HandlerFunction | LazyDescriptor>;",
  "  server?: Record<string, ServerFunction>;",
  "  partial?: Record<string, PartialFunction | LazyDescriptor>;",
  "  route?: Record<string, RouteDefinition | string>;",
  "  component?: Record<string, ComponentFunction | LazyDescriptor>;",
  "  asyncSignal?: Record<string, AsyncSignalFunction | LazyDescriptor>;",
  "  flow?: Record<string, FlowDefinition>;",
  "  cache?: {",
  "    browser?: Record<string, CacheDefinition | CacheDefinitionOptions>;",
  "    server?: Record<string, CacheDefinition | CacheDefinitionOptions>;",
  "  };",
  "  entries?: { browser?: Record<string, unknown>; server?: Record<string, unknown> };",
  "  configure?: AsyncUseConfig;",
  "  declaration?: Record<string, Record<string, unknown>>;",
  "  declarations?: Record<string, Record<string, unknown>>;",
  "  convention?: Record<string, DeclarationConvention>;",
  "  conventions?: Record<string, DeclarationConvention>;",
  "  module?: Record<string, AsyncModuleDefinition> | AsyncModuleDefinition | AsyncModuleDefinition[];",
  "  modules?: Record<string, AsyncModuleDefinition> | AsyncModuleDefinition | AsyncModuleDefinition[];",
  "}",
  "",
  "export interface RegistryRuntimeSnapshot extends AppDefinition {",
  "  signals?: Record<string, unknown>;",
  "}",
  "",
  "export interface RootInspection {",
  "  count: number;",
  "  roots: Array<{ root: Document | Element | DocumentFragment; loader: LoaderInstance; primary: boolean }>;",
  "}",
  "",
  "export interface RuntimeInspection {",
  "  active: boolean;",
  "  started: boolean;",
  "  destroyed: boolean;",
  "  target?: RuntimeTarget;",
  "  roots: RootInspection;",
  "  loader: AsyncLoaderFacadeInspection;",
  "  router: boolean;",
  "}",
  "",
  "export interface AppHub {",
  "  registry: DeclarationRegistryStore;",
  "  declarations: DeclarationBus;",
  "  system: AsyncSystem;",
  "  loader: AsyncLoaderFacade;",
  "  router: AsyncRouterFacade;",
  "  configure(config?: AsyncUseConfig): this;",
  "  use(type: \"signal\", entries: SignalMap): this;",
  "  use(type: \"handler\", entries: Record<string, HandlerFunction | LazyDescriptor>): this;",
  "  use(type: \"server\", entries: Record<string, ServerFunction>): this;",
  "  use(type: \"partial\", entries: Record<string, PartialFunction | LazyDescriptor>): this;",
  "  use(type: \"route\", entries: Record<string, RouteDefinition | string>): this;",
  "  use(type: \"component\", entries: Record<string, ComponentFunction | LazyDescriptor>): this;",
  "  use(type: \"asyncSignal\", entries: Record<string, AsyncSignalFunction | LazyDescriptor>): this;",
  "  use(type: \"flow\", entries: Record<string, FlowDefinition>): this;",
  "  use(moduleObject: AsyncUseDefinition): this;",
  "  snapshot(): AppDefinition;",
  "  start(options?: CreateAppOptions): AppRuntime;",
  "  attachRoot(root: Document | Element | DocumentFragment): AppRuntime;",
  "  detachRoot(root?: Document | Element | DocumentFragment): this;",
  "  applySnapshot(snapshot: RegistryRuntimeSnapshot, options?: { strict?: boolean }): this;",
  "  inspectRoots(): RootInspection;",
  "  inspectRuntime(): RuntimeInspection;",
  "}",
  "",
  "export interface CreateAppOptions extends LoaderOptions {",
  "  target?: RuntimeTarget;",
  "  mode?: RouterMode;",
  "  boundary?: string;",
  "  snapshot?: RegistryRuntimeSnapshot;",
  "  registryAssets?: RegistryAssetsConfig;",
  "  importModule?: (url: string) => MaybePromise<Record<string, unknown>>;",
  "  lazyRegistry?: LazyRegistry;",
  "  strictSnapshots?: boolean;",
  "  registry?: RegistryStore;",
  "  loader?: LoaderInstance;",
  "  router?: Router | false;",
  "  routerOptions?: RouterOptions;",
  "  components?: ComponentRegistry;",
  "  request?: Request;",
  "  locals?: unknown;",
  "  requestContext?: RequestContextStore;",
  "  scheduler?: Scheduler;",
  "  duplicates?: DuplicatePolicyConfig;",
  "}",
  "",
  "export interface DefineAppOptions {",
  "  duplicates?: DuplicatePolicyConfig;",
  "  features?: unknown;",
  "}",
  "",
  "export interface RenderResult {",
  "  html: string;",
  "  status: number;",
  "  signals: Record<string, unknown>;",
  "  cache: { browser: Record<string, unknown> };",
  "}",
  "",
  "export interface AppRuntime {",
  "  app: AppHub;",
  "  registry: DeclarationRegistryStore;",
  "  target: RuntimeTarget;",
  "  signals: SignalRegistry;",
  "  handlers: HandlerRegistry;",
  "  server: ServerNamespace & { cache: CacheRegistry };",
  "  partials: PartialRegistry;",
  "  routes: RouteRegistry;",
  "  components: ComponentRegistry;",
  "  browser: { cache: CacheRegistry };",
  "  loader?: LoaderInstance;",
  "  router?: Router;",
  "  scheduler: Scheduler;",
  "  attributes: NormalizedAttributeConfig;",
  "  onError?: AsyncErrorHandler;",
  "  start(): this;",
  "  use(type: Parameters<AppHub[\"use\"]>[0], entries?: unknown): this;",
  "  attachRoot(root: Document | Element | DocumentFragment): this;",
  "  detachRoot(root?: Document | Element | DocumentFragment): this;",
  "  applySnapshot(snapshot: RegistryRuntimeSnapshot, options?: { strict?: boolean }): this;",
  "  inspectRoots(): RootInspection;",
  "  render(url: string | URL): Promise<RenderResult>;",
  "  destroy(): void;",
  "}",
  "",
  "export interface AsyncNamespace extends AppHub {",
  "  Async: AsyncNamespace;",
  "  asyncSystem: AsyncSystem;",
  "  createDeclarationBus: typeof createDeclarationBus;",
  "  asyncSignal: typeof asyncSignal;",
  "  flow: typeof flow;",
  "  flowSignal: typeof flowSignal;",
  "  flowComputed: typeof flowComputed;",
  "  flowAsyncSignal: typeof flowAsyncSignal;",
  "  flowStatus: typeof flowStatus;",
  "  defineFrameworkFlow: typeof defineFrameworkFlow;",
  "  isFrameworkFlowDefinition: typeof isFrameworkFlowDefinition;",
  "  set: typeof set;",
  "  update: typeof update;",
  "  when: typeof when;",
  "  onError: typeof onError;",
  "  dispatch: typeof dispatch;",
  "  after: typeof after;",
  "  branch: typeof branch;",
  "  guard: typeof guard;",
  "  transition: typeof transition;",
  "  can: typeof can;",
  "  matches: typeof matches;",
  "  bool: typeof bool;",
  "  every: typeof every;",
  "  some: typeof some;",
  "  not: typeof not;",
  "  inspect: typeof inspect;",
  "  compose: typeof compose;",
  "  parallel: typeof parallel;",
  "  remember: typeof remember;",
  "  createApp: typeof createApp;",
  "  defineApp: typeof defineApp;",
  "  readSnapshot: typeof readSnapshot;",
  "  attachRoot: AppHub[\"attachRoot\"];",
  "  detachRoot: AppHub[\"detachRoot\"];",
  "  applySnapshot: AppHub[\"applySnapshot\"];",
  "  inspectRoots: AppHub[\"inspectRoots\"];",
  "  inspectRuntime: AppHub[\"inspectRuntime\"];",
  "  attributeName: typeof attributeName;",
  "  defineAttributeConfig: typeof defineAttributeConfig;",
  "  createCacheRegistry: typeof createCacheRegistry;",
  "  defineCache: typeof defineCache;",
  "  component: typeof component;",
  "  createComponentRegistry: typeof createComponentRegistry;",
  "  defineComponent: typeof defineComponent;",
  "  defineAsyncContainerElement: typeof defineAsyncContainerElement;",
  "  defineAsyncSuspenseElement: typeof defineAsyncSuspenseElement;",
  "  defineRegistrySnapshot: typeof defineRegistrySnapshot;",
  "  createLazyRegistry: typeof createLazyRegistry;",
  "  delay: typeof delay;",
  "  AsyncError: typeof AsyncError;",
  "  asyncErrorCodes: typeof asyncErrorCodes;",
  "  isAsyncError: typeof isAsyncError;",
  "  toAsyncDiagnostic: typeof toAsyncDiagnostic;",
  "  createHandlerRegistry: typeof createHandlerRegistry;",
  "  html: typeof html;",
  "  Loader: typeof Loader;",
  "  AsyncLoader: typeof Loader;",
  "  createRegistryStore: typeof createRegistryStore;",
  "  createRouter: typeof createRouter;",
  "  createScheduler: typeof createScheduler;",
  "  defineRoute: typeof defineRoute;",
  "  route: typeof route;",
  "  applyServerResult: typeof applyServerResult;",
  "  createServerProxy: typeof createServerProxy;",
  "  resolveServerCommandArguments: typeof resolveServerCommandArguments;",
  "  unwrapServerResult: typeof unwrapServerResult;",
  "  computed: typeof computed;",
  "  createSignal: typeof createSignal;",
  "  createSignalRegistry: typeof createSignalRegistry;",
  "  effect: typeof effect;",
  "  signal: typeof signal;",
  "}",
  "",
  "export declare function asyncSignal<T = unknown>(loaderOrId: string | FlowStep, fnOrOptions?: AsyncSignalFunction<T> | Record<string, unknown>): AsyncSignal<T> | FlowSignalDeclaration<T>;",
  "export declare function isAsyncError(value: unknown): value is AsyncError;",
  "export declare function toAsyncDiagnostic(options: ToAsyncDiagnosticOptions): AsyncDiagnostic;",
  "export declare const Async: AppHub;",
  "export declare const asyncSystem: AsyncSystem;",
  "export declare function createDeclarationBus(options?: AsyncUseConfig): DeclarationBus;",
  "export declare function defineFrameworkFlow(config?: FlowConfig): FlowDefinition;",
  "export declare const flow: typeof defineFrameworkFlow;",
  "export declare function flowSignal<T = unknown>(initial: T): FlowSignalDeclaration<T>;",
  "export declare function flowComputed<T = unknown>(compute: FlowStep): FlowSignalDeclaration<T>;",
  "export declare function flowAsyncSignal<T = unknown>(loader: FlowStep, options?: Record<string, unknown>): FlowSignalDeclaration<T>;",
  "export declare function isFrameworkFlowDefinition(value: unknown): value is FlowDefinition;",
  "export declare function set(nameOrUpdates: string | Record<string, unknown>, value?: unknown): FlowStep;",
  "export declare function update(name: string, fn: (current: unknown, store: Record<string, unknown>, input?: unknown) => unknown): FlowStep;",
  "export declare function when(predicate: FlowPredicate, options?: { availability?: boolean; reason?: string; label?: string }): FlowStep;",
  "export declare function onError(handle: (error: unknown, store: Record<string, unknown>, input?: unknown) => unknown, handler: FlowStep): FlowStep;",
  "export declare function flowStatus<T = unknown>(initial: T, allowed?: readonly T[]): FlowSignalDeclaration<T>;",
  "export declare function dispatch(targetOrEventName: string | object, eventNameOrPayload?: unknown, payload?: unknown): FlowStep;",
  "export declare function after(ms: number, eventNameOrTask: string | ((input?: unknown) => unknown), input?: unknown): FlowStep;",
  "export declare function branch(cases: Array<[FlowPredicate, FlowStep] | { when?: FlowPredicate; then: FlowStep; default?: boolean } | FlowStep>): FlowStep;",
  "export declare function guard(predicate: FlowPredicate, handler: FlowStep, options?: { reason?: string; label?: string }): FlowStep;",
  "export declare function transition(statusTarget: string | object, rules: Record<string, unknown> | Array<Record<string, unknown>>): FlowStep;",
  "export declare function can(statusNameOrFlowOrEventName: string | object, eventName?: string, input?: unknown): FlowSignalDeclaration<boolean>;",
  "export declare function matches(statusNameOrRef: string | object, value: unknown): FlowSignalDeclaration<boolean>;",
  "export declare function bool(condition: FlowPredicate | object): FlowSignalDeclaration<boolean>;",
  "export declare function every(...conditions: Array<FlowPredicate | object>): FlowSignalDeclaration<boolean>;",
  "export declare function some(...conditions: Array<FlowPredicate | object>): FlowSignalDeclaration<boolean>;",
  "export declare function not(condition: FlowPredicate | object): FlowSignalDeclaration<boolean>;",
  "export declare function inspect(target: unknown): Record<string, unknown>;",
  "export declare function compose(stepOrSteps: FlowStep | FlowStep[]): FlowStep;",
  "export declare function parallel(branches: Record<string, FlowStep> | FlowStep[]): FlowStep;",
  "export declare function remember(mappingOrMappings: unknown, stepOrSteps?: FlowStep | FlowStep[]): FlowStep;",
  "export declare function createApp(appOrDefinition?: AppHub | AsyncUseDefinition, options?: CreateAppOptions): AppRuntime;",
  "export declare function defineApp(initial?: AsyncUseDefinition, options?: DefineAppOptions): AppHub;",
  "export declare function readSnapshot(root?: Document | Element, options?: { attributes?: AttributeConfig }): RegistryRuntimeSnapshot;",
  "export declare function attributeName(attributes: AttributeConfig | undefined, type: keyof NormalizedAttributeConfig, name: string): string;",
  "export declare function defineAttributeConfig(config?: AttributeConfig): NormalizedAttributeConfig;",
  "export declare function createCacheRegistry(initialMap?: Record<string, CacheDefinition | CacheDefinitionOptions>, options?: { now?: () => number; registry?: RegistryStore; type?: \"cache.browser\" | \"cache.server\" }): CacheRegistry;",
  "export declare function defineCache(options?: CacheDefinitionOptions): CacheDefinition;",
  "export declare function component<TProps extends object = Record<string, unknown>>(fn: ComponentFunction<TProps>): ComponentFunction<TProps>;",
  "export declare function childrenFragment(source: ChildrenInput): Children;",
  "export declare function createComponentRegistry(initialMap?: Record<string, ComponentFunction>, options?: { registry?: RegistryStore; type?: \"component\" }): ComponentRegistry;",
  "export declare function defineComponent<TProps extends object = Record<string, unknown>>(fn: ComponentFunction<TProps>): ComponentFunction<TProps>;",
  "export declare function defineAsyncContainerElement(options?: { tagName?: string; app?: AppHub; Async?: AppHub; customElements?: CustomElementRegistry; HTMLElement?: typeof HTMLElement; window?: Window }): CustomElementConstructor;",
  "export declare function defineAsyncSuspenseElement(options?: { tagName?: string; customElements?: CustomElementRegistry; HTMLElement?: typeof HTMLElement; window?: Window }): CustomElementConstructor;",
  "export declare function defineRegistrySnapshot<T extends RegistryRuntimeSnapshot>(snapshot?: T): T;",
  "export declare function createLazyRegistry(options?: { registryAssets?: RegistryAssetsConfig; assets?: RegistryAssetsConfig; importModule?: (url: string) => MaybePromise<Record<string, unknown>> }): LazyRegistry;",
  "export declare function delay(ms: number, signal?: AbortSignal): Promise<void>;",
  "export declare function createHandlerRegistry(initialMap?: Record<string, HandlerFunction>, options?: { registry?: RegistryStore; type?: \"handler\" }): HandlerRegistry;",
  "export declare function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult;",
  "export declare function isChildrenFragment(value: unknown): value is Children;",
  "export declare function Loader(options?: LoaderOptions): LoaderInstance;",
  "export declare const AsyncLoader: typeof Loader;",
  "export declare function createRegistryStore(initial?: AppDefinition, options?: { target?: RuntimeTarget; backing?: unknown }): RegistryStore;",
  "export declare function createRouter(options?: RouterOptions): Router;",
  "export declare function createScheduler(options?: SchedulerOptions): Scheduler;",
  "export declare function defineRoute(definition: string | RouteDefinition, options?: Partial<RouteDefinition>): RouteDefinition;",
  "export declare const route: typeof defineRoute;",
  "export declare function applyServerResult(result: unknown, context?: Record<string, unknown>): Promise<unknown>;",
  "export declare function createServerProxy(options: ServerProxyOptions): ServerNamespace;",
  "export declare function resolveServerCommandArguments(args: Array<{ type: \"local\"; name: string } | { type: \"signal\"; path: string }>, context?: Record<string, unknown>): { args: unknown[]; signalValues: Record<string, unknown>; signalPaths: string[] };",
  "export declare function unwrapServerResult<T = unknown>(result: ServerResult<T>): T | ServerResult<T>;",
  "export declare function computed<T = unknown>(fn: (this: { signals: SignalRegistry; id: string; server?: ServerNamespace; router?: Router; loader?: LoaderInstance; cache?: CacheRegistry; scheduler?: Scheduler }) => T): ComputedSignal<T>;",
  "export declare function createSignal<T = unknown>(initial: T): Signal<T>;",
  "export declare function createSignalRegistry(initialMap?: SignalMap, options?: { registry?: RegistryStore; type?: \"signal\" }): SignalRegistry;",
  "export declare function effect(fn: () => unknown): EffectDefinition;",
  "export declare const signal: typeof createSignal;",
  "",
  "declare global {",
  "  const Async: AsyncNamespace;",
  "  const AsyncFramework: AsyncNamespace;",
  "}",
  ""
].join("\n");
const browserDtsOutput = removeRouterDeclarations(removeFlowDeclarations(fullBrowserDtsOutput));
const flowDtsOutput = addFlowEntrypointDeclarations(
  removeRouterDeclarations(fullBrowserDtsOutput)
    .replace("Browser type declarations for @async/framework/browser.", "Flow type declarations for @async/framework/flow.")
);
const routerDtsOutput = addRouterEntrypointDeclarations(
  removeFlowDeclarations(fullBrowserDtsOutput)
    .replace("Browser type declarations for @async/framework/browser.", "Router type declarations for @async/framework/router.")
);
const frameworkDtsOutput = fullBrowserDtsOutput
  .replace(
    "  createServerProxy: typeof createServerProxy;\n",
    "  createServerProxy: typeof createServerProxy;\n  createServerRegistry: typeof createServerRegistry;\n  createRequestContextStore: typeof createRequestContextStore;\n"
  )
  .replace(
    "export declare function createServerProxy(options: ServerProxyOptions): ServerNamespace;\n",
    "export declare function createServerProxy(options: ServerProxyOptions): ServerNamespace;\nexport declare function createServerRegistry(initialMap?: Record<string, ServerFunction>, options?: { registry?: RegistryStore; type?: \"server\" }): ServerNamespace;\nexport declare function createRequestContextStore(): RequestContextStore;\n"
  )
  .replace(
    "Browser type declarations for @async/framework/browser.",
    "Server-capable type declarations for @async/framework."
  );
const streamDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Stream type declarations for @async/framework/stream.",
  "",
  "import type {",
  "  AsyncStreamNamespace,",
  "  BoundaryReceiver,",
  "  BoundaryReceiverOptions",
  "} from \"./browser.js\";",
  "",
  "export type {",
  "  AsyncStreamApplyOptions,",
  "  AsyncStreamNamespace,",
  "  AttributePatchValue,",
  "  BoundaryApplyResult,",
  "  BoundaryPatch,",
  "  BoundaryPatchCounts,",
  "  BoundaryReceiver,",
  "  BoundaryReceiverInspection,",
  "  BoundaryReceiverOptions,",
  "  BuiltAttributePatchTriples,",
  "  NoBuildAttributePatchTuple,",
  "  NoBuildAttributePatchTuples,",
  "  StreamReplacement,",
  "  StreamRevealMetadata",
  "} from \"./browser.js\";",
  "",
  "export declare const AsyncStream: AsyncStreamNamespace;",
  "export declare function createBoundaryReceiver(options: BoundaryReceiverOptions): BoundaryReceiver;",
  ""
].join("\n");
const runtimeDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Type declarations for @async/framework/runtime.",
  "",
  "export type ElementLocator = string | { readonly selector: string; readonly optional?: boolean };",
  "export type RuntimeSliceController = {",
  "  readonly stopped: boolean;",
  "  stop(): void;",
  "};",
  "export type SignalRuntimePlan = {",
  "  readonly version?: 1;",
  "  readonly values?: readonly (readonly [path: string, value: unknown])[];",
  "  readonly bindings?: readonly SignalBindingRecord[];",
  "};",
  "export type SignalBindingRecord =",
  "  | readonly [element: number, kind: \"text\", path: string]",
  "  | readonly [element: number, kind: \"value\", path: string]",
  "  | readonly [element: number, kind: \"attr\", name: string, path: string]",
  "  | readonly [element: number, kind: \"prop\", name: string, path: string]",
  "  | readonly [element: number, kind: \"class\", token: string, path: string]",
  "  | readonly [element: number, kind: \"classList\", path: string];",
  "export type EventRuntimePlan = {",
  "  readonly version?: 1;",
  "  readonly events: readonly EventBindingRecord[];",
  "  readonly handlers?: Record<string, HandlerDescriptor>;",
  "};",
  "export type EventBindingRecord = readonly [element: number, event: string, commands: readonly EventCommand[]];",
  "export type EventCommand =",
  "  | readonly [\"handler\", id: string]",
  "  | readonly [\"preventDefault\"]",
  "  | readonly [\"stopPropagation\"]",
  "  | readonly [\"stopImmediatePropagation\"]",
  "  | readonly [\"setSignal\", path: string, valueSource: EventValueSource];",
  "export type EventValueSource =",
  "  | readonly [\"event.target.value\"]",
  "  | readonly [\"event.target.checked\"]",
  "  | readonly [\"constant\", value: unknown];",
  "export type EventRuntimeContext = {",
  "  event: Event;",
  "  element: Element;",
  "  el: Element;",
  "  root: ParentNode;",
  "  signals?: SignalRuntimeController;",
  "};",
  "export type StrictHandlerDescriptor = {",
  "  readonly mode?: \"strict\";",
  "  readonly module?: string;",
  "  readonly browserImport: string;",
  "  readonly exportName: string;",
  "  readonly version?: string;",
  "  readonly integrity?: string;",
  "};",
  "export type HandlerDescriptor = ((context: EventRuntimeContext) => unknown | Promise<unknown>) | StrictHandlerDescriptor;",
  "export type RuntimePlan = {",
  "  readonly version: 1;",
  "  readonly elements?: readonly ElementLocator[];",
  "  readonly signals?: SignalRuntimePlan;",
  "  readonly events?: EventRuntimePlan;",
  "};",
  "export type RuntimeStartOptions = {",
  "  readonly signal?: AbortSignal;",
  "  readonly importModule?: (specifier: string) => Promise<Record<string, unknown>>;",
  "  readonly onDiagnostic?: (diagnostic: Record<string, unknown>) => void;",
  "};",
  "export type SignalRuntimeController = RuntimeSliceController & {",
  "  get(path: string): unknown;",
  "  set(path: string, value: unknown): void;",
  "  update(path: string, fn: (value: unknown) => unknown): unknown;",
  "  subscribe(path: string, fn: (value: unknown) => void): () => void;",
  "  snapshot(): Record<string, unknown>;",
  "};",
  "export type RuntimeController = RuntimeSliceController;",
  "export declare function start(rootOrOptions: ParentNode | ({ root: ParentNode; plan: RuntimePlan } & RuntimeStartOptions), plan?: RuntimePlan, options?: RuntimeStartOptions): RuntimeController;",
  ""
].join("\n");
const runtimeSignalsDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Type declarations for @async/framework/runtime/signals.",
  "",
  "export type ElementLocator = string | { readonly selector: string; readonly optional?: boolean };",
  "export type SignalRuntimePlan = {",
  "  readonly version?: 1;",
  "  readonly values?: readonly (readonly [path: string, value: unknown])[];",
  "  readonly bindings?: readonly SignalBindingRecord[];",
  "};",
  "export type SignalBindingRecord =",
  "  | readonly [element: number, kind: \"text\", path: string]",
  "  | readonly [element: number, kind: \"value\", path: string]",
  "  | readonly [element: number, kind: \"attr\", name: string, path: string]",
  "  | readonly [element: number, kind: \"prop\", name: string, path: string]",
  "  | readonly [element: number, kind: \"class\", token: string, path: string]",
  "  | readonly [element: number, kind: \"classList\", path: string];",
  "export type SignalRuntimeOptions = {",
  "  readonly elements?: readonly ElementLocator[];",
  "  readonly signal?: AbortSignal;",
  "  readonly onDiagnostic?: (diagnostic: Record<string, unknown>) => void;",
  "};",
  "export type SignalRuntimeController = {",
  "  readonly stopped: boolean;",
  "  stop(): void;",
  "  get(path: string): unknown;",
  "  set(path: string, value: unknown): void;",
  "  update(path: string, fn: (value: unknown) => unknown): unknown;",
  "  subscribe(path: string, fn: (value: unknown) => void): () => void;",
  "  snapshot(): Record<string, unknown>;",
  "};",
  "export declare function startSignals(rootOrOptions: ParentNode | ({ root: ParentNode; plan: SignalRuntimePlan } & SignalRuntimeOptions), plan?: SignalRuntimePlan, options?: SignalRuntimeOptions): SignalRuntimeController;",
  ""
].join("\n");
const runtimeEventsDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Type declarations for @async/framework/runtime/events.",
  "",
  "export type ElementLocator = string | { readonly selector: string; readonly optional?: boolean };",
  "export type EventRuntimeContext = {",
  "  event: Event;",
  "  element: Element;",
  "  el: Element;",
  "  root: ParentNode;",
  "  signals?: { set(path: string, value: unknown): void };",
  "};",
  "export type EventValueSource =",
  "  | readonly [\"event.target.value\"]",
  "  | readonly [\"event.target.checked\"]",
  "  | readonly [\"constant\", value: unknown];",
  "export type EventCommand =",
  "  | readonly [\"handler\", id: string]",
  "  | readonly [\"preventDefault\"]",
  "  | readonly [\"stopPropagation\"]",
  "  | readonly [\"stopImmediatePropagation\"]",
  "  | readonly [\"setSignal\", path: string, valueSource: EventValueSource];",
  "export type EventBindingRecord = readonly [element: number, event: string, commands: readonly EventCommand[]];",
  "export type StrictHandlerDescriptor = {",
  "  readonly mode?: \"strict\";",
  "  readonly module?: string;",
  "  readonly browserImport: string;",
  "  readonly exportName: string;",
  "  readonly version?: string;",
  "  readonly integrity?: string;",
  "};",
  "export type HandlerDescriptor = ((context: EventRuntimeContext) => unknown | Promise<unknown>) | StrictHandlerDescriptor;",
  "export type EventRuntimePlan = {",
  "  readonly version?: 1;",
  "  readonly events: readonly EventBindingRecord[];",
  "  readonly handlers?: Record<string, HandlerDescriptor>; ",
  "};",
  "export type EventRuntimeOptions = {",
  "  readonly elements?: readonly ElementLocator[];",
  "  readonly signal?: AbortSignal;",
  "  readonly signals?: { set(path: string, value: unknown): void };",
  "  readonly importModule?: (specifier: string) => Promise<Record<string, unknown>>;",
  "  readonly onDiagnostic?: (diagnostic: Record<string, unknown>) => void;",
  "};",
  "export type EventRuntimeController = {",
  "  readonly stopped: boolean;",
  "  stop(): void;",
  "};",
  "export declare function startEvents(rootOrOptions: ParentNode | ({ root: ParentNode; plan: EventRuntimePlan } & EventRuntimeOptions), plan?: EventRuntimePlan, options?: EventRuntimeOptions): EventRuntimeController;",
  ""
].join("\n");
const jsxDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Type declarations for @async/framework/jsx.",
  "",
  "export declare const ASYNC_JSX_SIGNAL: unique symbol;",
  "export declare const ASYNC_JSX_COMPONENT: unique symbol;",
  "export declare const ASYNC_JSX_SUSPENSE: unique symbol;",
  "export declare const ASYNC_JSX_REVEAL: unique symbol;",
  "export type JsxSignal<T = unknown> = { readonly kind: \"async-jsx-signal\"; readonly type: typeof ASYNC_JSX_SIGNAL; readonly source: T; readonly options: Record<string, unknown> };",
  "export type JsxComponent<TProps extends object = Record<string, unknown>> = { readonly kind: \"async-jsx-component\"; readonly type: typeof ASYNC_JSX_COMPONENT; readonly render: (props: TProps) => unknown; readonly options: Record<string, unknown> };",
  "export type JsxBoundary = { readonly kind: \"async-jsx-suspense\" | \"async-jsx-reveal\"; readonly type: typeof ASYNC_JSX_SUSPENSE | typeof ASYNC_JSX_REVEAL; readonly props: Record<string, unknown> };",
  "export declare function signal<T = unknown>(source: T, options?: Record<string, unknown>): JsxSignal<T>;",
  "export declare function component<TProps extends object = Record<string, unknown>>(render: (props: TProps) => unknown, options?: Record<string, unknown>): JsxComponent<TProps>;",
  "export declare function Suspense(props?: Record<string, unknown>): JsxBoundary;",
  "export declare function Reveal(props?: Record<string, unknown>): JsxBoundary;",
  ""
].join("\n");
const jsxProfileTypesOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Shared JSX type declarations for @async/framework JSX profiles.",
  "",
  "export type AsyncJsxProfile = \"runtime\" | \"buildtime\";",
  "export type AsyncJSXElementType = string | ((props: Record<string, unknown>) => unknown);",
  "export type AsyncJSXElement = { readonly kind?: \"async-jsx-node\"; readonly type?: AsyncJSXElementType; readonly props?: Record<string, unknown>; readonly key?: string | number | null } | unknown;",
  "export type AsyncJSXChild = AsyncJSXElement | string | number | boolean | null | undefined;",
  "export type AsyncJSXChildren = AsyncJSXChild | readonly AsyncJSXChild[];",
  "export type AsyncEventHandler<E = Event, T extends EventTarget = EventTarget> = string | ((event: E & { currentTarget: T }) => unknown);",
  "export interface WritableSignal<T> {",
  "  readonly kind: \"signal\";",
  "  value: T;",
  "}",
  "export interface ComputedSignal<T> {",
  "  readonly kind: \"computed\";",
  "  readonly value: T;",
  "}",
  "export interface AsyncSignal<T> {",
  "  readonly kind: \"asyncSignal\";",
  "  readonly value: T | undefined;",
  "  readonly pending: boolean;",
  "  readonly error: unknown;",
  "  readonly version: number;",
  "}",
  "export interface JsxSignalIntent<T = unknown> {",
  "  readonly kind: \"async-jsx-signal\";",
  "  readonly source: T;",
  "}",
  "export type Signal<T> = WritableSignal<T> | ComputedSignal<T> | AsyncSignal<T>;",
  "export type SignalValue<T = unknown> = T | Signal<T> | JsxSignalIntent<T>;",
  "export type PrimitiveAttributeValue = string | number | boolean | null | undefined;",
  "export type DataAttributes = { [K in `data-${string}`]?: PrimitiveAttributeValue };",
  "export type AriaAttributes = { [K in `aria-${string}`]?: PrimitiveAttributeValue };",
  "export type CommonAttributes = DataAttributes & AriaAttributes & {",
  "  id?: string;",
  "  class?: string;",
  "  className?: string;",
  "  style?: string | Partial<CSSStyleDeclaration>;",
  "  title?: string;",
  "  role?: string;",
  "  tabIndex?: number;",
  "  hidden?: boolean;",
  "  children?: AsyncJSXChildren;",
  "  key?: string | number;",
  "};",
  "export type RuntimeProtocolEventProps = { [K in `on:${string}`]?: AsyncEventHandler | readonly unknown[] };",
  "export type RuntimeSignalBindingProps = { [K in `signal:${string}`]?: SignalValue };",
  "export type RuntimeClassToggleProps = { [K in `class:${string}`]?: boolean | SignalValue<boolean> };",
  "export type BuildtimeEventName = \"Click\" | \"Input\" | \"Change\" | \"Submit\" | \"PointerEnter\" | \"PointerLeave\" | \"PointerDown\" | \"PointerUp\" | \"KeyDown\" | \"KeyUp\" | \"Focus\" | \"Blur\";",
  "export type BuildtimeEventProps<T extends EventTarget = EventTarget> = { [K in `on${BuildtimeEventName}`]?: AsyncEventHandler<Event, T> };",
  "export type HTMLAttributeProps<T extends EventTarget> = CommonAttributes & {",
  "  value?: SignalValue<string | number | readonly string[]>;",
  "  checked?: SignalValue<boolean>;",
  "  disabled?: SignalValue<boolean>;",
  "  name?: string;",
  "  type?: string;",
  "  href?: string;",
  "  src?: string;",
  "  alt?: string;",
  "  width?: string | number;",
  "  height?: string | number;",
  "  for?: string;",
  "  htmlFor?: string;",
  "  placeholder?: string;",
  "  target?: string;",
  "  rel?: string;",
  "  ref?: T | ((element: T) => void);",
  "};",
  "export type SVGAttributeProps<T extends EventTarget> = CommonAttributes & {",
  "  viewBox?: string;",
  "  xmlns?: string;",
  "  fill?: string;",
  "  stroke?: string;",
  "  d?: string;",
  "  cx?: string | number;",
  "  cy?: string | number;",
  "  r?: string | number;",
  "  x?: string | number;",
  "  y?: string | number;",
  "  ref?: T | ((element: T) => void);",
  "};",
  "export type AsyncHTMLProps<Profile extends AsyncJsxProfile, T extends EventTarget = HTMLElement> = HTMLAttributeProps<T> & (Profile extends \"runtime\" ? RuntimeProtocolEventProps & RuntimeSignalBindingProps & RuntimeClassToggleProps : BuildtimeEventProps<T>);",
  "export type AsyncSVGProps<Profile extends AsyncJsxProfile, T extends EventTarget = SVGElement> = SVGAttributeProps<T> & (Profile extends \"runtime\" ? RuntimeProtocolEventProps & RuntimeSignalBindingProps & RuntimeClassToggleProps : BuildtimeEventProps<T>);",
  "export type AsyncHTMLElements<Profile extends AsyncJsxProfile> = { [Tag in keyof HTMLElementTagNameMap]: AsyncHTMLProps<Profile, HTMLElementTagNameMap[Tag]> } & { [Tag in `${string}-${string}`]: AsyncHTMLProps<Profile, HTMLElement> };",
  "export type AsyncSVGElements<Profile extends AsyncJsxProfile> = { [Tag in keyof SVGElementTagNameMap]: AsyncSVGProps<Profile, SVGElementTagNameMap[Tag]> };",
  "export type RuntimeIntrinsicElements = AsyncHTMLElements<\"runtime\"> & AsyncSVGElements<\"runtime\">;",
  "export type BuildtimeIntrinsicElements = AsyncHTMLElements<\"buildtime\"> & AsyncSVGElements<\"buildtime\">;",
  "export type PropsOf<Tag extends keyof RuntimeIntrinsicElements | keyof BuildtimeIntrinsicElements, Profile extends AsyncJsxProfile = \"buildtime\"> = Profile extends \"runtime\" ? RuntimeIntrinsicElements[Extract<Tag, keyof RuntimeIntrinsicElements>] : BuildtimeIntrinsicElements[Extract<Tag, keyof BuildtimeIntrinsicElements>];",
  "export namespace AsyncJSX {",
  "  type Element = AsyncJSXElement;",
  "  interface ElementChildrenAttribute {",
  "    children: AsyncJSXChildren;",
  "  }",
  "}",
  "export namespace RuntimeJSX {",
  "  type Element = AsyncJSXElement;",
  "  interface ElementChildrenAttribute {",
  "    children: AsyncJSXChildren;",
  "  }",
  "  type IntrinsicElements = RuntimeIntrinsicElements;",
  "}",
  "export namespace BuildtimeJSX {",
  "  type Element = AsyncJSXElement;",
  "  interface ElementChildrenAttribute {",
  "    children: AsyncJSXChildren;",
  "  }",
  "  type IntrinsicElements = BuildtimeIntrinsicElements;",
  "}",
  ""
].join("\n");
const jsxRuntimeProfileDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Runtime/no-build JSX profile declarations.",
  "",
  "export { ASYNC_JSX_COMPONENT, ASYNC_JSX_REVEAL, ASYNC_JSX_SIGNAL, ASYNC_JSX_SUSPENSE, Reveal, Suspense, component, signal } from \"../jsx.js\";",
  "export type { AsyncEventHandler, AsyncHTMLElements, AsyncJSX, AsyncJSXChild, AsyncJSXChildren, AsyncJSXElement, AsyncJsxProfile, AsyncSVGElements, AsyncSignal, BuildtimeIntrinsicElements, BuildtimeJSX, ComputedSignal, PropsOf, RuntimeIntrinsicElements, RuntimeJSX, Signal, SignalValue, WritableSignal } from \"./types.js\";",
  ""
].join("\n");
const jsxBuildtimeProfileDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Buildtime/build-required JSX profile declarations.",
  "",
  "export { ASYNC_JSX_COMPONENT, ASYNC_JSX_REVEAL, ASYNC_JSX_SIGNAL, ASYNC_JSX_SUSPENSE, Reveal, Suspense, component, signal } from \"../jsx.js\";",
  "export type { AsyncEventHandler, AsyncHTMLElements, AsyncJSX, AsyncJSXChild, AsyncJSXChildren, AsyncJSXElement, AsyncJsxProfile, AsyncSVGElements, AsyncSignal, BuildtimeIntrinsicElements, BuildtimeJSX, ComputedSignal, PropsOf, RuntimeIntrinsicElements, RuntimeJSX, Signal, SignalValue, WritableSignal } from \"./types.js\";",
  ""
].join("\n");
function jsxAutomaticRuntimeDtsOutput(profile, factoryPath = "../jsx-runtime.js", typesPath = "../types.js") {
  const profileName = profile === "runtime" ? "RuntimeIntrinsicElements" : "BuildtimeIntrinsicElements";
  return [
    "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
    `// Automatic JSX runtime declarations for the ${profile} JSX profile.`,
    "",
    `export { Fragment, jsx, jsxDEV, jsxs } from "${factoryPath}";`,
    `import type { AsyncJSXChildren, AsyncJSXElement, ${profileName} } from "${typesPath}";`,
    "export namespace JSX {",
    "  type Element = AsyncJSXElement;",
    "  interface ElementChildrenAttribute {",
    "    children: AsyncJSXChildren;",
    "  }",
    `  type IntrinsicElements = ${profileName};`,
    "}",
    ""
  ].join("\n");
}
const jsxRuntimeProfileJsxRuntimeDtsOutput = jsxAutomaticRuntimeDtsOutput("runtime");
const jsxRuntimeProfileJsxDevRuntimeDtsOutput = jsxAutomaticRuntimeDtsOutput("runtime");
const jsxBuildtimeProfileJsxRuntimeDtsOutput = jsxAutomaticRuntimeDtsOutput("buildtime");
const jsxBuildtimeProfileJsxDevRuntimeDtsOutput = jsxAutomaticRuntimeDtsOutput("buildtime");
const jsxRuntimeFactoryDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Automatic JSX runtime factory declarations for @async/framework/jsx.",
  "// The base entrypoint defaults to the runtime JSX profile; use",
  "// @async/framework/jsx/runtime or @async/framework/jsx/buildtime as the",
  "// jsxImportSource for profile-specific prop checking.",
  "",
  "import type { AsyncJSXChildren, AsyncJSXElement, RuntimeIntrinsicElements } from \"./types.js\";",
  "export declare const Fragment: unique symbol;",
  "export type AsyncJsxNode = {",
  "  readonly kind: \"async-jsx-node\";",
  "  readonly type: unknown;",
  "  readonly props: Record<string, unknown>;",
  "  readonly key: string | number | null;",
  "  readonly dev?: { readonly dev: true; readonly isStaticChildren?: boolean; readonly source?: unknown; readonly self?: unknown };",
  "};",
  "export declare function jsx(type: unknown, props?: Record<string, unknown> | null, key?: string | number | null): AsyncJsxNode;",
  "export declare function jsxs(type: unknown, props?: Record<string, unknown> | null, key?: string | number | null): AsyncJsxNode;",
  "export declare function jsxDEV(type: unknown, props?: Record<string, unknown> | null, key?: string | number | null, isStaticChildren?: boolean, source?: unknown, self?: unknown): AsyncJsxNode;",
  "export namespace JSX {",
  "  type Element = AsyncJSXElement;",
  "  interface ElementChildrenAttribute {",
  "    children: AsyncJSXChildren;",
  "  }",
  "  type IntrinsicElements = RuntimeIntrinsicElements;",
  "}",
  ""
].join("\n");
const jsxDevRuntimeFactoryDtsOutput = jsxAutomaticRuntimeDtsOutput("runtime", "./jsx-runtime.js", "./types.js");
const viteDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Type declarations for @async/framework/vite.",
  "",
  "export type ViteRolldownHost = { readonly name?: string; readonly version?: string | number; readonly viteVersion?: string | number; readonly versionMajor?: string | number; readonly engine?: string; readonly builder?: string | { readonly name?: string }; readonly rolldown?: boolean };",
  "export type AsyncFrameworkLayer = 1 | \"1\" | 1.5 | \"1.5\";",
  "export type AsyncFrameworkClientOptions = { readonly entry?: string; readonly outDir?: string };",
  "export type AsyncFrameworkServerOptions = { readonly entry?: string; readonly export?: string; readonly injectClientScript?: boolean; readonly exclude?: readonly (string | RegExp)[]; readonly ignoreWatching?: readonly (string | RegExp)[]; readonly env?: unknown; readonly loadModule?: unknown; readonly adapter?: unknown; readonly handleHotUpdate?: unknown; readonly base?: \"\" | `/${string}`; readonly target?: never };",
  "export type AsyncFrameworkPluginOptions = { readonly fixture?: Record<string, unknown>; readonly mode?: \"development\" | \"production\" | string; readonly host?: ViteRolldownHost; readonly layer?: AsyncFrameworkLayer; readonly server?: boolean | AsyncFrameworkServerOptions; readonly client?: boolean | AsyncFrameworkClientOptions; readonly optimizeFrameworkDeps?: boolean };",
  "export type AsyncFrameworkVitePlugin = {",
  "  readonly name: \"async-framework\";",
  "  readonly enforce: \"pre\";",
  "  readonly asyncFramework: { readonly profile: Record<string, unknown>; readonly report: Record<string, unknown>; readonly layer?: 1 | 1.5 };",
  "  config(config?: Record<string, unknown>, env?: { readonly mode?: string }): Record<string, unknown> | null;",
  "  configResolved(config?: unknown): void;",
  "  buildStart(): void;",
  "  resolveId(id: string): string | null;",
  "  load(id: string): string | null;",
  "  transform(code: string, id: string): { code: string; map: { mappings: \"\" } } | null;",
  "  getAsyncFrameworkReport(): Record<string, unknown>;",
  "};",
  "export type AsyncFrameworkExternalVitePlugin = { readonly name: string; readonly [key: string]: unknown };",
  "export type AsyncFrameworkPluginOption = AsyncFrameworkVitePlugin | Array<AsyncFrameworkVitePlugin | Promise<AsyncFrameworkExternalVitePlugin> | AsyncFrameworkExternalVitePlugin>;",
  "export declare const frameworkOptimizeDepsExclude: readonly string[];",
  "export declare function asyncFramework<Options extends AsyncFrameworkPluginOptions | undefined = undefined>(options?: Options): Options extends { readonly server: true | AsyncFrameworkServerOptions } ? AsyncFrameworkPluginOption : AsyncFrameworkVitePlugin;",
  "export declare function normalizeAsyncFrameworkLayer(layer?: AsyncFrameworkLayer): 1 | 1.5 | undefined;",
  "export declare function validateViteRolldownHost(host?: ViteRolldownHost): Required<Pick<ViteRolldownHost, \"name\" | \"version\" | \"engine\">>;",
  "export declare function normalizeViteHost(host?: ViteRolldownHost): Required<Pick<ViteRolldownHost, \"name\" | \"version\" | \"engine\">>;",
  "export declare function detectViteHost(meta?: { readonly viteVersion?: string | number; readonly rolldownVersion?: string | number } | null): Required<Pick<ViteRolldownHost, \"name\" | \"version\" | \"engine\">> | undefined;",
  "export declare function importsAsyncJsx(source: string): boolean;",
  ""
].join("\n");
const publishManifest = createPublishManifest(packageManifest);
const publishPackageJsonOutput = `${JSON.stringify(publishManifest, null, 2)}\n`;

const outputs = new Map([
  [outFiles.browserEsm, browserEsmOutput],
  [outFiles.browserEsmMin, browserEsmMinOutput],
  [outFiles.browserUmd, browserUmdOutput],
  [outFiles.browserUmdMin, browserUmdMinOutput],
  [outFiles.browserTs, browserTsOutput],
  [outFiles.browserDts, browserDtsOutput],
  [outFiles.streamEsm, streamEsmOutput],
  [outFiles.streamEsmMin, streamEsmMinOutput],
  [outFiles.streamUmd, streamUmdOutput],
  [outFiles.streamUmdMin, streamUmdMinOutput],
  [outFiles.streamTs, streamTsOutput],
  [outFiles.streamDts, streamDtsOutput],
  [outFiles.flowEsm, flowEsmOutput],
  [outFiles.flowEsmMin, flowEsmMinOutput],
  [outFiles.flowUmd, flowUmdOutput],
  [outFiles.flowUmdMin, flowUmdMinOutput],
  [outFiles.flowTs, flowTsOutput],
  [outFiles.flowDts, flowDtsOutput],
  [outFiles.routerEsm, routerEsmOutput],
  [outFiles.routerEsmMin, routerEsmMinOutput],
  [outFiles.routerUmd, routerUmdOutput],
  [outFiles.routerUmdMin, routerUmdMinOutput],
  [outFiles.routerTs, routerTsOutput],
  [outFiles.routerDts, routerDtsOutput],
  [outFiles.serverEsm, serverEsmOutput],
  [outFiles.frameworkTs, frameworkTsOutput],
  [outFiles.frameworkDts, frameworkDtsOutput],
  [outFiles.jsxDts, jsxDtsOutput],
  [outFiles.jsxRuntimeFactoryDts, jsxRuntimeFactoryDtsOutput],
  [outFiles.jsxDevRuntimeFactoryDts, jsxDevRuntimeFactoryDtsOutput],
  [outFiles.jsxProfileTypesDts, jsxProfileTypesOutput],
  [outFiles.jsxRuntimeProfileDts, jsxRuntimeProfileDtsOutput],
  [outFiles.jsxRuntimeProfileJsxRuntimeDts, jsxRuntimeProfileJsxRuntimeDtsOutput],
  [outFiles.jsxRuntimeProfileJsxDevRuntimeDts, jsxRuntimeProfileJsxDevRuntimeDtsOutput],
  [outFiles.jsxBuildtimeProfileDts, jsxBuildtimeProfileDtsOutput],
  [outFiles.jsxBuildtimeProfileJsxRuntimeDts, jsxBuildtimeProfileJsxRuntimeDtsOutput],
  [outFiles.jsxBuildtimeProfileJsxDevRuntimeDts, jsxBuildtimeProfileJsxDevRuntimeDtsOutput],
  [outFiles.viteDts, viteDtsOutput],
  [outFiles.runtimeDts, runtimeDtsOutput],
  [outFiles.runtimeSignalsDts, runtimeSignalsDtsOutput],
  [outFiles.runtimeEventsDts, runtimeEventsDtsOutput],
  [outFiles.packageJson, publishPackageJsonOutput]
]);
const copies = Object.values(copiedPublishFiles);

if (check) {
  for (const [file, output] of outputs) {
    const current = await readFile(file, "utf8").catch(() => "");
    if (current !== output) {
      console.error(`${relative(root, file)} is stale. Run \`pnpm run bundle\`.`);
      process.exitCode = 1;
    }
  }
  for (const [source, destination] of copies) {
    const current = await readFile(destination, "utf8").catch(() => "");
    const expected = await readFile(source, "utf8");
    if (current !== expected) {
      console.error(`${relative(root, destination)} is stale. Run \`pnpm run bundle\`.`);
      process.exitCode = 1;
    }
  }
} else {
  await mkdir(distRoot, { recursive: true });
  for (const [file, output] of outputs) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, output, "utf8");
  }
  for (const [source, destination] of copies) {
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

function createPublishManifest(manifest) {
  const publishManifest = JSON.parse(JSON.stringify(manifest));
  publishManifest.files = publishFiles;
  publishManifest.types = `./${frameworkDts}`;
  publishManifest.source = `./${frameworkTs}`;
  delete publishManifest.private;
  delete publishManifest.packageManager;
  delete publishManifest.scripts;
  delete publishManifest.devDependencies;
  return publishManifest;
}

function removeFlowDeclarations(source) {
  const removeExact = new Set([
    "  flow: typeof flow;",
    "  flowSignal: typeof flowSignal;",
    "  flowComputed: typeof flowComputed;",
    "  flowAsyncSignal: typeof flowAsyncSignal;",
    "  flowStatus: typeof flowStatus;",
    "  defineFrameworkFlow: typeof defineFrameworkFlow;",
    "  isFrameworkFlowDefinition: typeof isFrameworkFlowDefinition;",
    "  set: typeof set;",
    "  update: typeof update;",
    "  when: typeof when;",
    "  onError: typeof onError;",
    "  dispatch: typeof dispatch;",
    "  after: typeof after;",
    "  branch: typeof branch;",
    "  guard: typeof guard;",
    "  transition: typeof transition;",
    "  can: typeof can;",
    "  matches: typeof matches;",
    "  bool: typeof bool;",
    "  every: typeof every;",
    "  some: typeof some;",
    "  not: typeof not;",
    "  inspect: typeof inspect;",
    "  compose: typeof compose;",
    "  parallel: typeof parallel;",
    "  remember: typeof remember;"
  ]);
  const removeDeclaredFunctions = [
    "defineFrameworkFlow",
    "flowSignal",
    "flowComputed",
    "flowAsyncSignal",
    "flowStatus",
    "isFrameworkFlowDefinition",
    "set",
    "update",
    "when",
    "onError",
    "dispatch",
    "after",
    "branch",
    "guard",
    "transition",
    "can",
    "matches",
    "bool",
    "every",
    "some",
    "not",
    "inspect",
    "compose",
    "parallel",
    "remember"
  ].map((name) => new RegExp(`^export declare function ${name}\\b`));
  return source
    .split("\n")
    .filter((line) => !removeExact.has(line))
    .filter((line) => !/^export declare const flow\b/.test(line))
    .filter((line) => !removeDeclaredFunctions.some((pattern) => pattern.test(line)))
    .join("\n");
}

function removeRouterDeclarations(source) {
  const removeExact = new Set([
    "  createRouter: typeof createRouter;",
    "  defineRoute: typeof defineRoute;",
    "  route: typeof route;"
  ]);
  return source
    .split("\n")
    .filter((line) => !removeExact.has(line))
    .filter((line) => !/^export declare function createRouter\b/.test(line))
    .filter((line) => !/^export declare function defineRoute\b/.test(line))
    .filter((line) => !/^export declare const route\b/.test(line))
    .join("\n");
}

function addFlowEntrypointDeclarations(source) {
  return source
    .replace(
      "  Async: AsyncNamespace;\n",
      "  Async: AsyncNamespace;\n  installFlow: typeof installFlow;\n"
    )
    .replace(
      "export declare const Async: AppHub;\n",
      "export declare const Async: AppHub;\nexport declare function installFlow(app?: AppHub): AppHub;\n"
    )
    .replace(
      "  const AsyncFramework: AsyncNamespace;\n",
      "  const AsyncFramework: AsyncNamespace;\n  const AsyncFrameworkFlow: AsyncNamespace;\n"
    );
}

function addRouterEntrypointDeclarations(source) {
  return source
    .replace(
      "  createRouter: typeof createRouter;\n",
      "  installRouter: typeof installRouter;\n  createRouteRegistry: typeof createRouteRegistry;\n  createRouter: typeof createRouter;\n"
    )
    .replace(
      "export declare function createRouter(options?: RouterOptions): Router;\n",
      "export declare function installRouter(app?: AppHub): AppHub;\nexport declare function createRouteRegistry(initialMap?: Record<string, RouteDefinition | string>, options?: { registry?: RegistryStore; type?: \"route\" }): RouteRegistry;\nexport declare function createRouter(options?: RouterOptions): Router;\n"
    )
    .replace(
      "  const AsyncFramework: AsyncNamespace;\n",
      "  const AsyncFramework: AsyncNamespace;\n  const AsyncFrameworkRouter: AsyncNamespace;\n"
    );
}

function unique(values) {
  return [...new Set(values)];
}

function getPackageExport(exports, subpath) {
  const entry = exports?.[subpath];
  if (!entry) {
    throw new Error(`package.json exports must define ${subpath}.`);
  }
  return entry;
}

function resolveConditionalTarget(target, conditions) {
  if (typeof target === "string") {
    return target;
  }
  for (const condition of conditions) {
    const value = target?.[condition];
    if (value !== undefined) {
      return resolveConditionalTarget(value, conditions);
    }
  }
  return undefined;
}

function packagePathToFile(value) {
  if (typeof value !== "string") {
    throw new Error("Expected package export target to resolve to a string file path.");
  }
  if (!value.startsWith("./")) {
    throw new Error(`Package export target must be relative: ${value}`);
  }
  return value.slice(2);
}

function unminifiedArtifact(file) {
  if (file.endsWith(".min.js")) {
    return `${file.slice(0, -".min.js".length)}.js`;
  }
  return file;
}

function minifiedArtifact(file) {
  if (file.endsWith(".js")) {
    return `${file.slice(0, -".js".length)}.min.js`;
  }
  return file;
}

function typedSourceArtifact(file) {
  if (file.endsWith(".d.ts")) {
    return `${file.slice(0, -".d.ts".length)}.ts`;
  }
  if (file.endsWith(".js")) {
    return `${file.slice(0, -".js".length)}.ts`;
  }
  return file;
}

async function buildBundle(entry) {
  const modules = new Map();
  await loadModule(entry, modules);
  const normalizedEntry = normalizeModule(entry);
  const ordered = topoSort(normalizedEntry, modules);
  const entryModule = modules.get(normalizedEntry);
  const publicExports = [
    ...entryModule.exports.map((name) => ({
      source: normalizedEntry,
      imported: name,
      exported: name,
      external: false
    })),
    ...entryModule.reexports
  ];
  const chunks = [];
  const externalImports = new Map();

  for (const file of ordered) {
    const module = modules.get(file);
    const imports = module.imports.map((item) => {
      const dependency = item.external ? externalVariable(item.source) : moduleVariable(item.source);
      if (item.external) {
        externalImports.set(item.source, dependency);
      }
      const specifiers = item.specifiers
        .map(({ imported, local }) => imported === local ? imported : `${imported}: ${local}`)
        .join(", ");
      return `  const { ${specifiers} } = ${dependency};`;
    });

    chunks.push(`const ${moduleVariable(file)} = (() => {`);
    chunks.push(...imports);
    chunks.push(indent(stripExports(removeImports(module.source)).trim()));
    chunks.push(`  return { ${module.exports.join(", ")} };`);
    chunks.push("})();");
    chunks.push("");
  }

  const publicBindings = [];
  for (const item of publicExports) {
    const local = item.exported;
    const source = item.external ? externalVariable(item.source) : moduleVariable(item.source);
    if (item.external) {
      externalImports.set(item.source, source);
    }
    publicBindings.push(local);
    chunks.push(`const { ${item.imported}: ${local} } = ${source};`);
  }

  return {
    publicBindings,
    bundleBody: chunks.join("\n"),
    externalImports: [...externalImports.entries()].map(([source, variable]) => `import * as ${variable} from "${source}";`)
  };
}

async function loadModule(file, modules) {
  const normalized = normalizeModule(file);
  if (modules.has(normalized)) {
    return modules.get(normalized);
  }

  const source = await readFile(join(root, normalized), "utf8");
  const imports = parseImports(source, normalized);
  const reexports = parseReexports(source, normalized);
  const exports = parseExports(source);
  const module = { source, imports, reexports, exports };
  modules.set(normalized, module);

  for (const dependency of [...imports, ...reexports].filter((item) => !item.external).map((item) => item.source)) {
    await loadModule(dependency, modules);
  }

  return module;
}

function topoSort(file, modules, seen = new Set(), visiting = new Set(), result = []) {
  const normalized = normalizeModule(file);
  if (seen.has(normalized)) {
    return result;
  }
  if (visiting.has(normalized)) {
    throw new Error(`Cycle detected while bundling ${normalized}.`);
  }
  visiting.add(normalized);

  const module = modules.get(normalized);
  for (const dependency of [...module.imports, ...module.reexports].filter((item) => !item.external).map((item) => item.source)) {
    topoSort(dependency, modules, seen, visiting, result);
  }

  visiting.delete(normalized);
  seen.add(normalized);
  result.push(normalized);
  return result;
}

function parseImports(source, file) {
  return [...source.matchAll(/import\s+{([\s\S]*?)}\s+from\s+"([^"]+)";/g)]
    .map((match) => ({
      ...resolveSpecifier(file, match[2]),
      specifiers: parseSpecifiers(match[1])
    }));
}

function parseReexports(source, file) {
  return [...source.matchAll(/export\s+{([\s\S]*?)}\s+from\s+"([^"]+)";/g)]
    .flatMap((match) => {
      const resolved = resolveSpecifier(file, match[2]);
      return parseSpecifiers(match[1]).map((specifier) => ({
        ...resolved,
        imported: specifier.imported,
        exported: specifier.local
      }));
    });
}

function parseExports(source) {
  const names = new Set();
  for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+const\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+let\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/export\s+class\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/^export\s+{([^}\n]+)};/gm)) {
    for (const specifier of parseSpecifiers(match[1])) {
      names.add(specifier.local);
    }
  }
  return [...names];
}

function parseSpecifiers(source) {
  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [imported, local = imported] = part.split(/\s+as\s+/);
      return {
        imported: imported.trim(),
        local: local.trim()
      };
    });
}

function removeImports(source) {
  return source.replace(/import\s+{[\s\S]*?}\s+from\s+"[^"]+";\n?/g, "");
}

function stripExports(source) {
  return source
    .replace(/export\s+async\s+function\s+/g, "async function ")
    .replace(/export\s+function\s+/g, "function ")
    .replace(/export\s+const\s+/g, "const ")
    .replace(/export\s+let\s+/g, "let ")
    .replace(/export\s+class\s+/g, "class ")
    .replace(/export\s+{[\s\S]*?}\s+from\s+"[^"]+";\n?/g, "")
    .replace(/export\s+{[\s\S]*?};\n?/g, "");
}

function resolveSpecifier(file, specifier) {
  const localFlowSource = resolveLocalFlowSource(specifier);
  if (localFlowSource) {
    return {
      source: localFlowSource,
      external: false
    };
  }

  if (!specifier.startsWith(".")) {
    return { source: specifier, external: true };
  }
  return {
    source: normalizeModule(relative(root, resolve(dirname(join(root, file)), specifier))),
    external: false
  };
}

function normalizeModule(file) {
  const normalized = normalize(file).replaceAll("\\", "/");
  if (normalized.startsWith("../") || normalized.startsWith("node_modules/")) {
    return normalized;
  }
  return normalized.startsWith("src/") ? normalized : `src/${normalized}`;
}

function moduleVariable(file) {
  const name = file
    .replace(/\.js$/, "")
    .replace(/[^A-Za-z0-9]+(.)/g, (_match, char) => char.toUpperCase())
    .replace(/^[^A-Za-z_$]+/, "");
  return `__${name}Module`;
}

function resolveLocalFlowSource(specifier) {
  const flowSources = {
    "@async/flow/protocol": "src/protocol.js",
    "@async/flow/compose": "src/compose.js",
    "@async/flow/define": "src/define.js",
    "@async/flow/runtime": "src/runtime.js",
    "@async/flow/framework-runtime": "src/framework-runtime.js",
    "@async/flow/helpers": "src/helpers.js",
    "@async/flow/helpers/core": "src/helpers/core.js",
    "@async/flow/scheduler": "src/scheduler.js"
  };
  const fallback = flowSources[specifier];
  if (!fallback) {
    return null;
  }

  const packageSource = normalize(join("node_modules", "@async", "flow", fallback)).replaceAll("\\", "/");
  if (existsSync(join(root, packageSource))) {
    return packageSource;
  }

  try {
    return normalize(relative(root, require.resolve(specifier))).replaceAll("\\", "/");
  } catch {
    const localSource = normalize(join("..", "flow", fallback)).replaceAll("\\", "/");
    return existsSync(join(root, localSource)) ? localSource : null;
  }
}

function externalVariable(specifier) {
  const name = specifier
    .replace(/^node:/, "node-")
    .replace(/[^A-Za-z0-9]+(.)/g, (_match, char) => char.toUpperCase())
    .replace(/^[^A-Za-z_$]+/, "");
  return `__${name}External`;
}

function indent(source) {
  if (!source) {
    return "";
  }
  return source
    .split("\n")
    .map((line) => line ? `  ${line}` : "")
    .join("\n");
}

async function minifyJavaScript(source, { module }) {
  const result = await minify(source, {
    ecma: 2020,
    module,
    toplevel: true,
    compress: {
      passes: 2,
      unsafe_arrows: true
    },
    mangle: true,
    format: {
      comments: false,
      semicolons: true
    }
  });

  if (!result.code) {
    throw new Error("Terser did not produce minified output.");
  }
  if (/[\r\n]/.test(result.code)) {
    throw new Error("Terser emitted newlines in minified output.");
  }

  return result.code;
}

async function readUmdNamespaceReservedKeys(entry) {
  const sourceUrl = pathToFileURL(join(root, entry));
  const source = await import(sourceUrl.href);
  return new Set(Object.keys(source.Async));
}

function assertNoUmdNamespaceConflicts(exportNames, reservedKeys) {
  const conflicts = exportNames.filter((name) => name !== "Async" && reservedKeys.has(name));
  if (conflicts.length > 0) {
    throw new Error(`UMD Async namespace export conflict: ${conflicts.join(", ")}.`);
  }
}
