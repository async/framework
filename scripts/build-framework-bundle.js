#!/usr/bin/env node
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { minify } from "terser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = join(root, "src");
const distRoot = join(root, "dist");
const browserEntry = "src/browser.js";
const serverEntry = "src/index.js";
const packageManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const packageExportSpec = packageManifest.exports;
const browserExport = getPackageExport(packageExportSpec, "./browser");
const serverExport = getPackageExport(packageExportSpec, "./server");
const jsxExport = getPackageExport(packageExportSpec, "./jsx");
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
const frameworkDts = packagePathToFile(resolveConditionalTarget(serverExport, ["types"]));
const frameworkTs = typedSourceArtifact(frameworkDts);
const packageJsonArtifact = packagePathToFile(resolveConditionalTarget(packageExportSpec, ["./package.json"]));
const serverEsm = packagePathToFile(resolveConditionalTarget(serverExport, ["import", "node", "default"]));
const jsxEsm = packagePathToFile(resolveConditionalTarget(jsxExport, ["import", "default"]));
const jsxDts = packagePathToFile(resolveConditionalTarget(jsxExport, ["types"]));
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
  frameworkDts,
  frameworkTs,
  packageJson: packageJsonArtifact,
  serverEsm,
  jsxDts,
  viteDts,
  runtimeDts,
  runtimeSignalsDts,
  runtimeEventsDts
};
const copiedArtifacts = {
  changelog: { source: "CHANGELOG.md", file: "CHANGELOG.md" },
  readme: { source: "README.md", file: "README.md" },
  license: { source: "LICENSE", file: "LICENSE" }
};
const runtimeCopiedArtifacts = {
  jsxEsm: { source: "src/jsx.js", file: jsxEsm },
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
const browserDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Browser type declarations for @async/framework/browser.",
  "",
  "export type RuntimeTarget = \"browser\" | \"server\";",
  "export type RouterMode = \"csr\" | \"spa\" | \"ssr\" | \"mpa\";",
  "export type AsyncSignalStatus = \"idle\" | \"loading\" | \"ready\" | \"error\";",
  "export type MaybePromise<T> = T | Promise<T>;",
  "export type Cleanup = () => void;",
  "export type RegistryType =",
  "  | \"signal\"",
  "  | \"handler\"",
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
  "export type TemplateLike = TemplateResult | TemplatePrimitive | Node | TemplateLike[];",
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
  "  [key: string]: unknown;",
  "}",
  "",
  "export interface RouteMatch {",
  "  pattern: string;",
  "  params: Record<string, string>;",
  "  route: RouteDefinition;",
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
  "  root?: Document | Element;",
  "  boundary?: string;",
  "  routes?: RouteRegistry;",
  "  loader?: LoaderInstance;",
  "  signals?: SignalRegistry;",
  "  handlers?: HandlerRegistry;",
  "  server?: ServerNamespace;",
  "  cache?: CacheRegistry;",
  "  partials?: PartialRegistry;",
  "  attributes?: AttributeConfig;",
  "  scheduler?: Scheduler;",
  "}",
  "",
  "export interface Router {",
  "  mode: RouterMode;",
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
  "  start(): this;",
  "  match(url: string | URL): RouteMatch | null;",
  "  prefetch(url: string | URL): Promise<unknown>;",
  "  navigate(url: string | URL, options?: { replace?: boolean; initial?: boolean; source?: string; history?: boolean }): Promise<unknown>;",
  "  destroy(): void;",
  "}",
  "",
  "export type LifecycleEventName = \"attach\" | \"mount\" | \"visible\" | \"intersect\" | \"destroy\";",
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
  "  render<TProps extends Record<string, unknown> = Record<string, unknown>>(Child: ComponentFunction<TProps>, props?: TProps): TemplateLike;",
  "  suspense(signalRef: Pick<SignalRef, \"id\">, views: SuspenseViews | SuspenseReadyView): TemplateLike;",
  "  on(eventName: \"intersect\", fn: IntersectionCallback): void;",
  "  on(eventName: \"intersect\", options: IntersectionOptions | undefined | null, fn: IntersectionCallback): void;",
  "  on(eventName: Exclude<LifecycleEventName, \"intersect\">, fn: (this: ComponentContext, target?: Element) => unknown): void;",
  "  onMount(fn: (this: ComponentContext, target?: Element) => unknown): void;",
  "  onVisible(fn: (this: ComponentContext, target?: Element) => unknown): void;",
  "  intersect(target: Element, fn: IntersectionCallback): Cleanup;",
  "  intersect(target: Element, options: IntersectionOptions | undefined | null, fn: IntersectionCallback): Cleanup;",
  "}",
  "",
  "export type ComponentFunction<TProps extends Record<string, unknown> = Record<string, unknown>> = (this: ComponentContext, props: TProps) => TemplateLike;",
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
  "  start(): this;",
  "  scan(rootOrFragment?: Document | Element | DocumentFragment): this;",
  "  swap(boundaryId: string, fragmentOrTemplate: TemplateLike): Element;",
  "  mount<TProps extends Record<string, unknown> = Record<string, unknown>>(target: Element, Component: ComponentFunction<TProps>, props?: TProps): unknown;",
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
  "  swap(boundaryId: string, fragmentOrTemplate: TemplateLike): Promise<Element>;",
  "  mount<TProps extends Record<string, unknown> = Record<string, unknown>>(target: Element, Component: ComponentFunction<TProps>, props?: TProps): Promise<unknown>;",
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
  "export interface RegistrySnapshot {",
  "  signal: Record<string, unknown>;",
  "  handler: Record<string, { id?: string } | LazyDescriptor>;",
  "  server: Record<string, { id?: string } | LazyDescriptor>;",
  "  partial: Record<string, { id?: string } | LazyDescriptor>;",
  "  route: Record<string, RouteDefinition>;",
  "  component: Record<string, { id?: string } | LazyDescriptor>;",
  "  asyncSignal: Record<string, { id?: string } | LazyDescriptor>;",
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
  "  cache?: {",
  "    browser?: Record<string, CacheDefinition | CacheDefinitionOptions>;",
  "    server?: Record<string, CacheDefinition | CacheDefinitionOptions>;",
  "  };",
  "  entries?: { browser?: Record<string, unknown>; server?: Record<string, unknown> };",
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
  "  registry: RegistryStore;",
  "  loader: AsyncLoaderFacade;",
  "  use(type: \"signal\", entries: SignalMap): this;",
  "  use(type: \"handler\", entries: Record<string, HandlerFunction | LazyDescriptor>): this;",
  "  use(type: \"server\", entries: Record<string, ServerFunction>): this;",
  "  use(type: \"partial\", entries: Record<string, PartialFunction | LazyDescriptor>): this;",
  "  use(type: \"route\", entries: Record<string, RouteDefinition | string>): this;",
  "  use(type: \"component\", entries: Record<string, ComponentFunction | LazyDescriptor>): this;",
  "  use(type: \"asyncSignal\", entries: Record<string, AsyncSignalFunction | LazyDescriptor>): this;",
  "  use(moduleObject: AppDefinition): this;",
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
  "  routes?: RouteRegistry;",
  "  partials?: PartialRegistry;",
  "  components?: ComponentRegistry;",
  "  request?: Request;",
  "  locals?: unknown;",
  "  requestContext?: RequestContextStore;",
  "  scheduler?: Scheduler;",
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
  "  registry: RegistryStore;",
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
  "  asyncSignal: typeof asyncSignal;",
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
  "  AsyncStream: AsyncStreamNamespace;",
  "  createBoundaryReceiver: typeof createBoundaryReceiver;",
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
  "  createHandlerRegistry: typeof createHandlerRegistry;",
  "  html: typeof html;",
  "  Loader: typeof Loader;",
  "  AsyncLoader: typeof Loader;",
  "  createPartialRegistry: typeof createPartialRegistry;",
  "  createRegistryStore: typeof createRegistryStore;",
  "  createRouteRegistry: typeof createRouteRegistry;",
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
  "export declare function asyncSignal<T = unknown>(id: string, fn: AsyncSignalFunction<T>): AsyncSignal<T>;",
  "export declare const Async: AppHub;",
  "export declare function createApp(appOrDefinition?: AppHub | AppDefinition, options?: CreateAppOptions): AppRuntime;",
  "export declare function defineApp(initial?: AppDefinition): AppHub;",
  "export declare function readSnapshot(root?: Document | Element, options?: { attributes?: AttributeConfig }): RegistryRuntimeSnapshot;",
  "export declare function attributeName(attributes: AttributeConfig | undefined, type: keyof NormalizedAttributeConfig, name: string): string;",
  "export declare function defineAttributeConfig(config?: AttributeConfig): NormalizedAttributeConfig;",
  "export declare const AsyncStream: AsyncStreamNamespace;",
  "export declare function createBoundaryReceiver(options: BoundaryReceiverOptions): BoundaryReceiver;",
  "export declare function createCacheRegistry(initialMap?: Record<string, CacheDefinition | CacheDefinitionOptions>, options?: { now?: () => number; registry?: RegistryStore; type?: \"cache.browser\" | \"cache.server\" }): CacheRegistry;",
  "export declare function defineCache(options?: CacheDefinitionOptions): CacheDefinition;",
  "export declare function component<TProps extends Record<string, unknown> = Record<string, unknown>>(fn: ComponentFunction<TProps>): ComponentFunction<TProps>;",
  "export declare function createComponentRegistry(initialMap?: Record<string, ComponentFunction>, options?: { registry?: RegistryStore; type?: \"component\" }): ComponentRegistry;",
  "export declare function defineComponent<TProps extends Record<string, unknown> = Record<string, unknown>>(fn: ComponentFunction<TProps>): ComponentFunction<TProps>;",
  "export declare function defineAsyncContainerElement(options?: { tagName?: string; app?: AppHub; Async?: AppHub; customElements?: CustomElementRegistry; HTMLElement?: typeof HTMLElement; window?: Window }): CustomElementConstructor;",
  "export declare function defineAsyncSuspenseElement(options?: { tagName?: string; customElements?: CustomElementRegistry; HTMLElement?: typeof HTMLElement; window?: Window }): CustomElementConstructor;",
  "export declare function defineRegistrySnapshot<T extends RegistryRuntimeSnapshot>(snapshot?: T): T;",
  "export declare function createLazyRegistry(options?: { registryAssets?: RegistryAssetsConfig; assets?: RegistryAssetsConfig; importModule?: (url: string) => MaybePromise<Record<string, unknown>> }): LazyRegistry;",
  "export declare function delay(ms: number, signal?: AbortSignal): Promise<void>;",
  "export declare function createHandlerRegistry(initialMap?: Record<string, HandlerFunction>, options?: { registry?: RegistryStore; type?: \"handler\" }): HandlerRegistry;",
  "export declare function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult;",
  "export declare function Loader(options?: LoaderOptions): LoaderInstance;",
  "export declare const AsyncLoader: typeof Loader;",
  "export declare function createPartialRegistry(initialMap?: Record<string, PartialFunction>, options?: { registry?: RegistryStore; type?: \"partial\" }): PartialRegistry;",
  "export declare function createRegistryStore(initial?: AppDefinition, options?: { target?: RuntimeTarget; backing?: unknown }): RegistryStore;",
  "export declare function createRouteRegistry(initialMap?: Record<string, RouteDefinition | string>, options?: { registry?: RegistryStore; type?: \"route\" }): RouteRegistry;",
  "export declare function createRouter(options?: RouterOptions): Router;",
  "export declare function createScheduler(options?: SchedulerOptions): Scheduler;",
  "export declare function defineRoute(partial: string, options?: Omit<RouteDefinition, \"partial\">): RouteDefinition;",
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
const frameworkDtsOutput = browserDtsOutput
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
  "export type JsxComponent<TProps extends Record<string, unknown> = Record<string, unknown>> = { readonly kind: \"async-jsx-component\"; readonly type: typeof ASYNC_JSX_COMPONENT; readonly render: (props: TProps) => unknown; readonly options: Record<string, unknown> };",
  "export type JsxBoundary = { readonly kind: \"async-jsx-suspense\" | \"async-jsx-reveal\"; readonly type: typeof ASYNC_JSX_SUSPENSE | typeof ASYNC_JSX_REVEAL; readonly props: Record<string, unknown> };",
  "export declare function signal<T = unknown>(source: T, options?: Record<string, unknown>): JsxSignal<T>;",
  "export declare function component<TProps extends Record<string, unknown> = Record<string, unknown>>(render: (props: TProps) => unknown, options?: Record<string, unknown>): JsxComponent<TProps>;",
  "export declare function Suspense(props?: Record<string, unknown>): JsxBoundary;",
  "export declare function Reveal(props?: Record<string, unknown>): JsxBoundary;",
  ""
].join("\n");
const viteDtsOutput = [
  "// Generated by scripts/build-framework-bundle.js. Do not edit by hand.",
  "// Type declarations for @async/framework/vite.",
  "",
  "export type ViteRolldownHost = { readonly name?: string; readonly version?: string | number; readonly viteVersion?: string | number; readonly versionMajor?: string | number; readonly engine?: string; readonly builder?: string | { readonly name?: string }; readonly rolldown?: boolean };",
  "export type AsyncFrameworkPluginOptions = { readonly fixture?: Record<string, unknown>; readonly mode?: \"development\" | \"production\" | string; readonly host?: ViteRolldownHost };",
  "export type AsyncFrameworkVitePlugin = {",
  "  readonly name: \"async-framework\";",
  "  readonly enforce: \"pre\";",
  "  readonly asyncFramework: { readonly profile: Record<string, unknown>; readonly report: Record<string, unknown> };",
  "  configResolved(config: ViteRolldownHost): void;",
  "  resolveId(id: string): string | null;",
  "  load(id: string): string | null;",
  "  transform(code: string, id: string): { code: string; map: null } | null;",
  "  getAsyncFrameworkReport(): Record<string, unknown>;",
  "};",
  "export declare function asyncFramework(options?: AsyncFrameworkPluginOptions): AsyncFrameworkVitePlugin;",
  "export declare function validateViteRolldownHost(host?: ViteRolldownHost): Required<Pick<ViteRolldownHost, \"name\" | \"version\" | \"engine\">>;",
  "export declare function normalizeViteHost(host?: ViteRolldownHost): Required<Pick<ViteRolldownHost, \"name\" | \"version\" | \"engine\">>;",
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
  [outFiles.serverEsm, serverEsmOutput],
  [outFiles.frameworkTs, frameworkTsOutput],
  [outFiles.frameworkDts, frameworkDtsOutput],
  [outFiles.jsxDts, jsxDtsOutput],
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
  delete publishManifest.private;
  delete publishManifest.packageManager;
  delete publishManifest.scripts;
  delete publishManifest.devDependencies;
  return publishManifest;
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
  const ordered = topoSort(normalizedEntry, modules).filter((file) => file !== normalizedEntry);
  const publicExports = modules.get(normalizedEntry).reexports;
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
  for (const match of source.matchAll(/export\s+{([\s\S]*?)};/g)) {
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
    .replace(/export\s+{[\s\S]*?}\s+from\s+"[^"]+";\n?/g, "")
    .replace(/export\s+{[\s\S]*?};\n?/g, "");
}

function resolveSpecifier(file, specifier) {
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
  return normalized.startsWith("src/") ? normalized : `src/${normalized}`;
}

function moduleVariable(file) {
  const name = basename(file, ".js")
    .replace(/[^A-Za-z0-9]+(.)/g, (_match, char) => char.toUpperCase())
    .replace(/^[^A-Za-z_$]+/, "");
  return `__${name}Module`;
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
