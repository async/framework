#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { compose, createRuntime, defineRuntime, task } from "@async/pipeline/runtime";
import { minify } from "terser";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const browserEntry = "src/browser.js";
const outputRoot = resolvePathOption("--out", join(root, ".async", "bundle-layout-optimizer"));
const writeBundles = !process.argv.includes("--no-write");
const checkOnly = process.argv.includes("--check");
const selectedPipeline = resolveValueOption("--pipeline");
const customStepNames = resolveListOption("--steps");
const listSteps = process.argv.includes("--list-steps");

const modules = new Map();
await loadModule(browserEntry, modules);

const normalizedEntry = normalizeModule(browserEntry);
const currentOrder = topoSort(normalizedEntry, modules).filter((file) => file !== normalizedEntry);
const optimizerSteps = createOptimizerSteps();
const baseline = await runOptimizationPipeline({
  name: "current",
  steps: []
});
if (!baseline.ok) {
  throw new Error(`Baseline optimizer pipeline failed: ${baseline.reason}`);
}
const optimizerPipelines = createOptimizerPipelines();
if (customStepNames.length > 0) {
  optimizerPipelines.set("custom", {
    name: "custom",
    steps: customStepNames
  });
}
if (listSteps) {
  printStepList();
  process.exit(0);
}
const candidates = [];
const errors = [];

for (const pipeline of optimizerPipelines.values()) {
  if (selectedPipeline && pipeline.name !== selectedPipeline) {
    continue;
  }
  const result = pipeline.name === "current" ? baseline : await runOptimizationPipeline(pipeline);
  if (!result.ok) {
    errors.push({
      name: pipeline.name,
      steps: pipeline.steps,
      reason: result.reason
    });
    continue;
  }
  candidates.push(result.candidate);
}
if (selectedPipeline && candidates.length === 0 && !errors.some((error) => error.name === selectedPipeline)) {
  throw new Error(`Unknown optimizer pipeline "${selectedPipeline}". Use --list-steps to inspect available steps.`);
}

const ranked = candidates
  .map((candidate) => ({
    ...candidate,
    esmDelta: diffSizes(candidate.esm, baseline.candidate.esm),
    umdDelta: diffSizes(candidate.umd, baseline.candidate.umd),
    diagnostics: diagnoseCandidate(candidate, baseline.candidate)
  }))
  .sort((a, b) =>
    Number(a.contract?.ok === false) - Number(b.contract?.ok === false) ||
    a.esm.br - b.esm.br ||
    a.umd.br - b.umd.br ||
    a.name.localeCompare(b.name)
  );

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  compression: {
    gzip: "level 9",
    brotli: "quality 11"
  },
  entry: browserEntry,
  moduleCount: currentOrder.length,
  baseline: {
    name: baseline.candidate.name,
    esm: baseline.candidate.esm,
    umd: baseline.candidate.umd
  },
  availableSteps: [...optimizerSteps.values()].map(({ name, description, risk }) => ({ name, description, risk })),
  ranked: ranked.map(({ esmCode: _esmCode, umdCode: _umdCode, ...candidate }) => candidate),
  errors
};

if (writeBundles) {
  await mkdir(join(outputRoot, "bundles"), { recursive: true });
  for (const candidate of ranked) {
    await writeFile(join(outputRoot, "bundles", `${candidate.name}.browser.min.js`), candidate.esmCode, "utf8");
    await writeFile(join(outputRoot, "bundles", `${candidate.name}.browser.umd.min.js`), candidate.umdCode, "utf8");
  }
  await writeFile(join(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(outputRoot, "report.md"), renderMarkdownReport(report), "utf8");
}

if (checkOnly && ranked.every((candidate) => candidate.name === "current" || candidate.contract?.ok === false)) {
  console.error("No candidate improved over the current browser layout.");
  process.exitCode = 1;
}

printSummary(report);

async function runOptimizationPipeline(pipeline) {
  const unknownSteps = pipeline.steps.filter((stepName) => !optimizerSteps.has(stepName));
  if (unknownSteps.length > 0) {
    return {
      ok: false,
      reason: `unknown optimizer steps: ${unknownSteps.join(", ")}`
    };
  }

  const runtime = createRuntime(defineRuntime([
    task(
      { id: pipeline.name },
      compose(
        ...pipeline.steps.map((stepName) => createOptimizerMiddleware(optimizerSteps.get(stepName))),
        measureOptimizerPipeline
      )
    )
  ]));
  const execution = await runtime.run(createInitialOptimizerState(pipeline));
  if (execution.status !== "passed") {
    return {
      ok: false,
      reason: await diagnosePipelineFailure(pipeline, execution),
      execution
    };
  }
  return {
    ok: true,
    candidate: {
      ...execution.output,
      execution: summarizeExecution(execution)
    }
  };
}

function createInitialOptimizerState(pipeline) {
  return {
    name: pipeline.name,
    order: [...currentOrder],
    minifierOptions: {},
    moduleOverrides: {},
    entryExportRemovals: [],
    sortModuleExports: false,
    sortPublicBindings: false,
    contractRisks: [],
    diagnosticHints: [],
    steps: [],
    stepReports: []
  };
}

function createOptimizerMiddleware(stepDefinition) {
  return async function optimizerStep(context, next) {
    const previous = optimizerState(context);
    const nextState = await stepDefinition.apply(cloneOptimizerState(previous));
    nextState.steps.push(stepDefinition.name);
    nextState.stepReports.push({
      name: stepDefinition.name,
      description: stepDefinition.description,
      risk: stepDefinition.risk ?? "safe",
      orderChanged: previous.order.join("\n") !== nextState.order.join("\n"),
      minifierChanged: JSON.stringify(previous.minifierOptions) !== JSON.stringify(nextState.minifierOptions),
      modulesChanged: JSON.stringify(previous.moduleOverrides) !== JSON.stringify(nextState.moduleOverrides),
      publicExportsChanged: previous.entryExportRemovals.join("\n") !== nextState.entryExportRemovals.join("\n"),
      diagnosticsChanged: previous.diagnosticHints.join("\n") !== nextState.diagnosticHints.join("\n")
    });
    context.output = nextState;
    return next();
  };
}

async function measureOptimizerPipeline(context) {
  const state = optimizerState(context);
  const valid = validateOrder(state.order, state);
  if (!valid.ok) {
    throw new Error(valid.reason);
  }
  const candidate = await buildAndMeasure(state);
  candidate.steps = state.steps;
  candidate.stepReports = state.stepReports;
  candidate.contract = {
    ...await smokeBrowserEsm(candidate.esmCode, candidate.publicBindings),
    risks: state.contractRisks,
    hints: state.diagnosticHints
  };
  context.output = candidate;
  return candidate;
}

function optimizerState(context) {
  return context.output ?? context.input;
}

function cloneOptimizerState(state) {
  return {
    ...state,
    order: [...state.order],
    minifierOptions: clonePlainObject(state.minifierOptions),
    moduleOverrides: clonePlainObject(state.moduleOverrides),
    entryExportRemovals: [...state.entryExportRemovals],
    contractRisks: [...state.contractRisks],
    diagnosticHints: [...state.diagnosticHints],
    steps: [...state.steps],
    stepReports: [...state.stepReports],
    sortModuleExports: state.sortModuleExports,
    sortPublicBindings: state.sortPublicBindings
  };
}

function clonePlainObject(value) {
  return structuredClone(value ?? {});
}

async function buildAndMeasure(state) {
  const esmSource = buildBrowserEsm(state);
  const umdSource = buildBrowserUmd(state);
  const { publicBindings } = buildBundleBody(state);
  const [esmCode, umdCode] = await Promise.all([
    minifyJavaScript(esmSource, { module: true, options: state.minifierOptions }),
    minifyJavaScript(umdSource, { module: false, options: state.minifierOptions })
  ]);

  return {
    name: state.name,
    order: state.order,
    publicBindings,
    esm: size(esmCode),
    umd: size(umdCode),
    esmCode,
    umdCode
  };
}

async function smokeBrowserEsm(code, publicBindings) {
  try {
    const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
    const missingExports = publicBindings.filter((name) => !Object.hasOwn(module, name));
    const wrongType = [];
    for (const name of publicBindings) {
      const value = module[name];
      if (value === undefined) {
        continue;
      }
      if (name === "Async") {
        if (typeof value?.use !== "function" || typeof value?.loader?.ready !== "function" || typeof value?.loader?.swap !== "function") {
          wrongType.push("Async");
        }
        continue;
      }
      if (typeof value === "undefined") {
        wrongType.push(name);
      }
    }
    if (missingExports.length > 0 || wrongType.length > 0) {
      return {
        ok: false,
        reason: [
          missingExports.length > 0 ? `missing exports: ${missingExports.join(", ")}` : null,
          wrongType.length > 0 ? `invalid export shape: ${wrongType.join(", ")}` : null
        ].filter(Boolean).join("; ")
      };
    }
    return {
      ok: true
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

function summarizeExecution(execution) {
  return {
    status: execution.status,
    tasks: execution.tasks.map((taskResult) => ({
      id: taskResult.id,
      status: taskResult.status,
      cacheHit: taskResult.cacheHit
    })),
    nodes: execution.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      status: node.status,
      path: node.path
    }))
  };
}

function runtimeFailureReason(execution) {
  const failedNode = [...execution.nodes].reverse().find((node) => node.status === "failed");
  return failedNode?.error ?? execution.error ?? "optimizer pipeline failed";
}

async function diagnosePipelineFailure(pipeline, execution) {
  let state = createInitialOptimizerState(pipeline);
  for (const stepName of pipeline.steps) {
    const stepDefinition = optimizerSteps.get(stepName);
    if (!stepDefinition) {
      return `unknown optimizer step: ${stepName}`;
    }
    try {
      state = await stepDefinition.apply(cloneOptimizerState(state));
      const valid = validateOrder(state.order, state);
      if (!valid.ok) {
        return `${stepName}: ${valid.reason}`;
      }
    } catch (error) {
      return `${stepName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return runtimeFailureReason(execution);
}

function createOptimizerPipelines() {
  return new Map([
    ["current", { name: "current", steps: [] }],
    ["flow-late", { name: "flow-late", steps: ["order.flow-late"] }],
    ["registry-first", { name: "registry-first", steps: ["order.registry-first"] }],
    ["runtime-core-late", { name: "runtime-core-late", steps: ["order.runtime-core-late"] }],
    ["protocol-grouped", { name: "protocol-grouped", steps: ["order.protocol-grouped"] }],
    ["lexical", { name: "lexical", steps: ["order.lexical"] }],
    ["size-asc", { name: "size-asc", steps: ["order.size-asc"] }],
    ["size-desc", { name: "size-desc", steps: ["order.size-desc"] }],
    ["passes4-unsafe", { name: "passes4-unsafe", steps: ["minify.passes4-unsafe"] }],
    ["mangle-private-props", { name: "mangle-private-props", steps: ["mangle.private-regex"] }],
    ["mangle-public-reserved", { name: "mangle-public-reserved", steps: ["mangle.public-reserved"] }],
    ["mangle-broad-keep-quoted", { name: "mangle-broad-keep-quoted", steps: ["mangle.broad-keep-quoted"] }],
    ["flow-late-public-mangle", { name: "flow-late-public-mangle", steps: ["order.flow-late", "mangle.public-reserved"] }],
    ["stream-subpath-check", { name: "stream-subpath-check", steps: ["slice.stream-subpath"] }],
    ["flow-subpath", { name: "flow-subpath", steps: ["slice.flow-subpath"] }],
    ["flow-dynamic-guard", { name: "flow-dynamic-guard", steps: ["dynamic.flow-import-guard"] }],
    ["router-subpath", { name: "router-subpath", steps: ["slice.router-subpath"] }],
    ["router-dynamic-guard", { name: "router-dynamic-guard", steps: ["dynamic.router-import-guard"] }],
    ["shape-stable-exports", { name: "shape-stable-exports", steps: ["shape.stable-export-order"] }],
    ["protocol-diagnostics", { name: "protocol-diagnostics", steps: ["diagnose.protocol-vocabulary"] }],
    ["wrapper-diagnostics", { name: "wrapper-diagnostics", steps: ["diagnose.wrapper-overhead"] }],
    ["invalid-reverse", { name: "invalid-reverse", steps: ["invalid.reverse"] }],
    ["invalid-missing-dependency", { name: "invalid-missing-dependency", steps: ["invalid.missing-dependency"] }]
  ]);
}

function createOptimizerSteps() {
  return new Map([
    orderStep("order.flow-late", "Move Flow modules later while preserving dependency order.", flowLateRank),
    orderStep("order.registry-first", "Move registry/cache/signals-like modules earlier.", registryFirstRank),
    orderStep("order.runtime-core-late", "Move app/loader/router/server modules later.", runtimeCoreLateRank),
    orderStep("order.protocol-grouped", "Group registry/cache/signals, component/router, runtime core, Flow, then small utilities.", protocolRank),
    orderStep("order.lexical", "Sort available dependency-valid modules lexically.", (file) => file),
    orderStep("order.size-asc", "Sort available dependency-valid modules by source byte size ascending.", byteLength),
    orderStep("order.size-desc", "Sort available dependency-valid modules by source byte size descending.", (file) => -byteLength(file)),
    minifierStep(
      "minify.passes4-unsafe",
      "Use a higher compression pass count and unsafe method compression.",
      {
        compress: {
          passes: 4,
          unsafe_arrows: true,
          unsafe_methods: true
        }
      },
      "medium"
    ),
    minifierStep(
      "mangle.private-regex",
      "Mangle only private-looking underscore properties.",
      {
        mangle: {
          properties: {
            regex: /^_/,
            keep_quoted: true,
            reserved: publicReservedNames()
          }
        }
      },
      "medium"
    ),
    minifierStep(
      "mangle.public-reserved",
      "Mangle properties while reserving known public browser API names.",
      {
        mangle: {
          properties: {
            builtins: true,
            keep_quoted: true,
            reserved: publicReservedNames()
          }
        }
      },
      "high"
    ),
    minifierStep(
      "mangle.broad-keep-quoted",
      "Broad property mangling with quoted names preserved.",
      {
        mangle: {
          properties: {
            builtins: true,
            keep_quoted: true
          }
        }
      },
      "high"
    ),
    transformStep(
      "slice.stream-subpath",
      "Report whether stream/boundary receiver code is already outside the default browser graph.",
      markStreamSubpathStatus,
      "safe"
    ),
    transformStep(
      "slice.flow-subpath",
      "Simulate moving public Flow authoring APIs to a separate entrypoint while leaving an internal registration guard.",
      (state) => applyFlowSlice(state, { dynamicImportGuard: false }),
      "contract"
    ),
    transformStep(
      "dynamic.flow-import-guard",
      "Simulate a lazy Flow slice guard with an explicit dynamic import target string.",
      (state) => applyFlowSlice(state, { dynamicImportGuard: true }),
      "contract"
    ),
    transformStep(
      "slice.router-subpath",
      "Simulate moving public router APIs to a separate entrypoint while leaving an internal no-router guard.",
      (state) => applyRouterSlice(state, { dynamicImportGuard: false }),
      "contract"
    ),
    transformStep(
      "dynamic.router-import-guard",
      "Simulate a lazy router slice guard with an explicit dynamic import target string.",
      (state) => applyRouterSlice(state, { dynamicImportGuard: true }),
      "contract"
    ),
    transformStep(
      "shape.stable-export-order",
      "Normalize generated wrapper export object and public binding order for consistent emitted shapes.",
      (state) => ({
        ...state,
        sortModuleExports: true,
        sortPublicBindings: true,
        diagnosticHints: [
          ...state.diagnosticHints,
          "Sorted generated wrapper return objects and public binding lists to test whether consistent property order improves Brotli locality."
        ]
      }),
      "safe"
    ),
    transformStep(
      "diagnose.protocol-vocabulary",
      "Add protocol/string vocabulary diagnostics without changing emitted code.",
      (state) => ({
        ...state,
        diagnosticHints: [
          ...state.diagnosticHints,
          "Inspect tokenStats for scattered cache.browser, cache.server, asyncSignal, route, partial, component, boundary, snapshot, registry, and scheduler vocabulary."
        ]
      }),
      "diagnostic"
    ),
    transformStep(
      "diagnose.wrapper-overhead",
      "Add wrapper/import destructuring diagnostics without changing emitted code.",
      (state) => ({
        ...state,
        diagnosticHints: [
          ...state.diagnosticHints,
          "Each source module emits an IIFE wrapper plus destructured imports; repeated wrapper overhead is visible when similar modules remain far apart."
        ]
      }),
      "diagnostic"
    ),
    invalidStep("invalid.reverse", "Reverse the graph to verify dependency-order diagnostics.", (state) => ({
      ...state,
      order: [...state.order].reverse()
    })),
    invalidStep("invalid.missing-dependency", "Drop a required Flow dependency to verify omitted-module diagnostics.", (state) => ({
      ...state,
      order: state.order.filter((file) => file !== "node_modules/@async/flow/src/define.js")
    }))
  ]);
}

function orderStep(name, description, rank) {
  return [
    name,
    {
      name,
      description,
      risk: "safe",
      apply(state) {
        return {
          ...state,
          order: topoKahn(state.order, (a, b) => {
            const aRank = rank(a);
            const bRank = rank(b);
            return compareRank(aRank, bRank) || a.localeCompare(b);
          }, state)
        };
      }
    }
  ];
}

function minifierStep(name, description, options, risk) {
  return [
    name,
    {
      name,
      description,
      risk,
      apply(state) {
        return {
          ...state,
          minifierOptions: mergeMinifierOptions(state.minifierOptions, options)
        };
      }
    }
  ];
}

function invalidStep(name, description, apply) {
  return [
    name,
    {
      name,
      description,
      risk: "invalid-test",
      apply
    }
  ];
}

function transformStep(name, description, apply, risk) {
  return [
    name,
    {
      name,
      description,
      risk,
      apply
    }
  ];
}

function markStreamSubpathStatus(state) {
  const hasBoundaryReceiver = state.order.some((file) => file === "src/boundary-receiver.js");
  return {
    ...state,
    diagnosticHints: [
      ...state.diagnosticHints,
      hasBoundaryReceiver
        ? "Stream/boundary receiver is still present in the default browser graph; measure a stream subpath split before claiming the default asset is focused."
        : "Stream/boundary receiver is already outside the default browser graph; this step is a no-op baseline guard for the completed stream split."
    ]
  };
}

function applyFlowSlice(state, { dynamicImportGuard }) {
  const next = {
    ...state,
    moduleOverrides: {
      ...state.moduleOverrides,
      "src/flow.js": dynamicImportGuard ? flowDynamicGuardSource() : flowSubpathGuardSource()
    },
    entryExportRemovals: unique([...state.entryExportRemovals, ...flowBrowserExportNames()]),
    contractRisks: [
      ...state.contractRisks,
      "Flow authoring exports move out of the default browser asset; package exports and migration docs must make this a versioned delivery change.",
      dynamicImportGuard
        ? "Flow registration would require an async/lazy path, so synchronous startup assumptions and Async.use(...) behavior need explicit tests."
        : "Flow registration without the Flow slice becomes a guarded error; existing inline flow registrations would need migration."
    ],
    diagnosticHints: [
      ...state.diagnosticHints,
      dynamicImportGuard
        ? "Dynamic Flow guard measures br-11 after keeping only a small import('@async/framework/flow') handoff string in the default asset."
        : "Flow subpath simulation removes inlined @async/flow runtime/helper modules from the default asset and keeps only a no-op registration guard."
    ]
  };
  return refreshReachableOrder(next);
}

function applyRouterSlice(state, { dynamicImportGuard }) {
  const next = {
    ...state,
    moduleOverrides: {
      ...state.moduleOverrides,
      "src/router.js": dynamicImportGuard ? routerDynamicGuardSource() : routerSubpathGuardSource()
    },
    entryExportRemovals: unique([...state.entryExportRemovals, ...routerBrowserExportNames()]),
    contractRisks: [
      ...state.contractRisks,
      "Router public exports move out of the default browser asset; route partials, SSR/CSR modes, package exports, CDN usage, and no-build examples need a versioned compatibility story.",
      dynamicImportGuard
        ? "Router startup would require an async/lazy path; synchronous app.start() and Async.use(...) route registration need focused tests."
        : "Route registration without the router slice becomes a guarded error; existing route users would need migration."
    ],
    diagnosticHints: [
      ...state.diagnosticHints,
      dynamicImportGuard
        ? "Dynamic router guard measures br-11 after keeping only a small import('@async/framework/router') handoff string in the default asset."
        : "Router subpath simulation removes route matching/navigation implementation from the default asset and keeps only internal guard shapes needed by app.js."
    ]
  };
  return refreshReachableOrder(next);
}

function unique(values) {
  return [...new Set(values)];
}

function flowBrowserExportNames() {
  return [
    "flowAsyncSignal",
    "flowComputed",
    "defineFrameworkFlow",
    "flow",
    "flowSignal",
    "isFrameworkFlowDefinition",
    "onError",
    "set",
    "update",
    "when"
  ];
}

function routerBrowserExportNames() {
  return [
    "createRouter",
    "defineRoute",
    "route"
  ];
}

function flowSubpathGuardSource() {
  return [
    "const frameworkFlowKind = Symbol.for(\"@async/framework.flow\");",
    "",
    "export function attachFlowRegistrations(runtime, entries = {}) {",
    "  if (!entries || Object.keys(entries).length === 0) {",
    "    return runtime;",
    "  }",
    "  throw new Error(\"Flow registrations require the @async/framework flow entrypoint.\");",
    "}",
    "",
    "export function isFrameworkFlowDefinition(value) {",
    "  return Boolean(value?.[frameworkFlowKind]);",
    "}",
    ""
  ].join("\n");
}

function flowDynamicGuardSource() {
  return [
    "const frameworkFlowKind = Symbol.for(\"@async/framework.flow\");",
    "",
    "export function attachFlowRegistrations(runtime, entries = {}) {",
    "  if (!entries || Object.keys(entries).length === 0) {",
    "    return runtime;",
    "  }",
    "  throw new Error(\"Flow registrations require loading the @async/framework flow runtime slice.\");",
    "}",
    "",
    "export function loadFlowRuntime() {",
    "  return import(\"@async/framework/flow\");",
    "}",
    "",
    "export function isFrameworkFlowDefinition(value) {",
    "  return Boolean(value?.[frameworkFlowKind]);",
    "}",
    ""
  ].join("\n");
}

function routerSubpathGuardSource() {
  return [
    "export function defineRoute(partialOrDefinition, options = {}) {",
    "  return isRouteDefinitionObject(partialOrDefinition)",
    "    ? { ...partialOrDefinition, ...options }",
    "    : { ...options, partial: partialOrDefinition };",
    "}",
    "",
    "export const route = defineRoute;",
    "",
    "export function createRouteRegistry(initialMap = {}) {",
    "  const entries = new Map(Object.entries(initialMap ?? {}));",
    "  return {",
    "    register(pattern, definition) { entries.set(pattern, definition); return { pattern, definition }; },",
    "    registerMany(map = {}) { for (const [pattern, definition] of Object.entries(map ?? {})) { this.register(pattern, definition); } return this; },",
    "    unregister(pattern) { return entries.delete(pattern); },",
    "    match() { return null; },",
    "    entries() { return [...entries].map(([pattern, route]) => ({ pattern, route })); },",
    "    keys() { return [...entries.keys()]; },",
    "    inspect() { return Object.fromEntries(entries); },",
    "    _adoptMany(map = {}) { return this.registerMany(map); }",
    "  };",
    "}",
    "",
    "export function createRouter() {",
    "  throw new Error(\"Router usage requires the @async/framework router entrypoint.\");",
    "}",
    "",
    "function isRouteDefinitionObject(value) {",
    "  return value && typeof value === \"object\" && !Array.isArray(value);",
    "}",
    ""
  ].join("\n");
}

function routerDynamicGuardSource() {
  return [
    routerSubpathGuardSource().trimEnd(),
    "",
    "export function loadRouterRuntime() {",
    "  return import(\"@async/framework/router\");",
    "}",
    ""
  ].join("\n");
}

function compareRank(a, b) {
  if (typeof a === "string" || typeof b === "string") {
    return String(a).localeCompare(String(b));
  }
  return a - b;
}

function mergeMinifierOptions(base, next) {
  return {
    ...base,
    ...next,
    compress: {
      ...(base.compress ?? {}),
      ...(next.compress ?? {})
    },
    mangle: mergeMangleOptions(base.mangle, next.mangle)
  };
}

function mergeMangleOptions(base, next) {
  if (next === undefined) {
    return base;
  }
  if (base === true || next === true) {
    return next;
  }
  return {
    ...(typeof base === "object" ? base : {}),
    ...(typeof next === "object" ? next : {}),
    properties: {
      ...(typeof base === "object" ? base.properties ?? {} : {}),
      ...(typeof next === "object" ? next.properties ?? {} : {})
    }
  };
}

function publicReservedNames() {
  return [
    ...modules.get(normalizedEntry).reexports.map((item) => item.exported),
    "ready",
    "scan",
    "swap",
    "defineRefreshPlan",
    "refresh",
    "attach",
    "inspect",
    "use",
    "start",
    "attachRoot",
    "detachRoot",
    "applySnapshot",
    "inspectRoots",
    "inspectRuntime",
    "loader",
    "router",
    "runtime",
    "signals",
    "handlers",
    "cache",
    "server",
    "browser"
  ];
}

function buildBrowserEsm(state) {
  const { body, publicBindings } = buildBundleBody(state);
  return [
    "// Generated by scripts/bundle-layout-optimizer.js for measurement. Do not publish.",
    "",
    body,
    "",
    `export { ${publicBindings.join(", ")} };`,
    ""
  ].join("\n");
}

function buildBrowserUmd(state) {
  const { body, publicBindings } = buildBundleBody(state);
  return [
    "// Generated by scripts/bundle-layout-optimizer.js for measurement. Do not publish.",
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
    indent(body.trim()),
    `  const api = { ${publicBindings.join(", ")} };`,
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
}

function buildBundleBody(state) {
  const entryModule = effectiveModule(state, normalizedEntry);
  const chunks = [];

  for (const file of state.order) {
    const module = effectiveModule(state, file);
    const imports = module.imports.map((item) => {
      const dependency = item.external ? externalVariable(item.source) : moduleVariable(item.source);
      const specifiers = item.specifiers
        .map(({ imported, local }) => imported === local ? imported : `${imported}: ${local}`)
        .join(", ");
      return `  const { ${specifiers} } = ${dependency};`;
    });

    chunks.push(`const ${moduleVariable(file)} = (() => {`);
    chunks.push(...imports);
    chunks.push(indent(stripExports(removeImports(module.source)).trim()));
    chunks.push(`  return { ${sortedModuleExports(state, module).join(", ")} };`);
    chunks.push("})();");
    chunks.push("");
  }

  const publicBindings = [];
  for (const item of filteredReexports(state, normalizedEntry, entryModule)) {
    const local = item.exported;
    const source = item.external ? externalVariable(item.source) : moduleVariable(item.source);
    publicBindings.push(local);
    chunks.push(`const { ${item.imported}: ${local} } = ${source};`);
  }

  return {
    body: chunks.join("\n"),
    publicBindings: state.sortPublicBindings ? publicBindings.sort((a, b) => a.localeCompare(b)) : publicBindings
  };
}

function validateOrder(order, state = createInitialOptimizerState({ name: "current" })) {
  if (new Set(order).size !== order.length) {
    return { ok: false, reason: "duplicate modules" };
  }
  const expected = reachableOrder(state);
  const expectedSet = new Set(expected);
  for (const file of expected) {
    if (!order.includes(file)) {
      return { ok: false, reason: `${file} is required by the effective graph but omitted` };
    }
  }
  for (const file of order) {
    if (!expectedSet.has(file)) {
      return { ok: false, reason: `${file} is not reachable from ${browserEntry} after active optimizer steps` };
    }
  }
  const indexes = new Map(order.map((file, index) => [file, index]));
  for (const file of order) {
    for (const dependency of internalDependencies(file, state)) {
      if (!indexes.has(dependency)) {
        return { ok: false, reason: `${file} depends on omitted ${dependency}` };
      }
      if (indexes.get(dependency) > indexes.get(file)) {
        return { ok: false, reason: `${file} appears before dependency ${dependency}` };
      }
    }
  }
  return { ok: true };
}

function effectiveModule(state, file) {
  const normalized = normalizeModule(file);
  const source = state.moduleOverrides?.[normalized];
  if (source === undefined) {
    return modules.get(normalized);
  }
  return {
    source,
    imports: parseImports(source, normalized),
    reexports: parseReexports(source, normalized),
    exports: parseExports(source)
  };
}

function filteredReexports(state, file, module = effectiveModule(state, file)) {
  const removals = new Set(state.entryExportRemovals);
  const reexports = file === normalizedEntry
    ? module.reexports.filter((item) => !removals.has(item.exported))
    : module.reexports;
  return state.sortPublicBindings && file === normalizedEntry
    ? [...reexports].sort((a, b) => a.exported.localeCompare(b.exported))
    : reexports;
}

function sortedModuleExports(state, module) {
  return state.sortModuleExports
    ? [...module.exports].sort((a, b) => a.localeCompare(b))
    : module.exports;
}

function reachableOrder(state) {
  return topoSortEffective(normalizedEntry, state).filter((file) => file !== normalizedEntry);
}

function refreshReachableOrder(state) {
  return {
    ...state,
    order: reachableOrder(state)
  };
}

function topoSortEffective(file, state, seen = new Set(), visiting = new Set(), result = []) {
  const normalized = normalizeModule(file);
  if (seen.has(normalized)) {
    return result;
  }
  if (visiting.has(normalized)) {
    throw new Error(`Cycle detected while bundling ${normalized}.`);
  }
  visiting.add(normalized);

  for (const dependency of internalDependencies(normalized, state)) {
    topoSortEffective(dependency, state, seen, visiting, result);
  }

  visiting.delete(normalized);
  seen.add(normalized);
  result.push(normalized);
  return result;
}

function topoKahn(order, compare, state = undefined) {
  const nodes = order;
  const indegree = new Map(nodes.map((node) => [node, 0]));
  const dependents = new Map(nodes.map((node) => [node, []]));

  for (const node of nodes) {
    for (const dependency of internalDependencies(node, state ?? modules)) {
      if (!indegree.has(dependency)) {
        continue;
      }
      indegree.set(node, indegree.get(node) + 1);
      dependents.get(dependency).push(node);
    }
  }

  const available = nodes.filter((node) => indegree.get(node) === 0).sort(compare);
  const result = [];
  while (available.length > 0) {
    const node = available.shift();
    result.push(node);
    for (const dependent of dependents.get(node)) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) {
        available.push(dependent);
        available.sort(compare);
      }
    }
  }
  return result;
}

async function loadModule(file, moduleMap) {
  const normalized = normalizeModule(file);
  if (moduleMap.has(normalized)) {
    return moduleMap.get(normalized);
  }

  const source = await readFile(join(root, normalized), "utf8");
  const imports = parseImports(source, normalized);
  const reexports = parseReexports(source, normalized);
  const exports = parseExports(source);
  const module = { source, imports, reexports, exports };
  moduleMap.set(normalized, module);

  for (const dependency of [...imports, ...reexports].filter((item) => !item.external).map((item) => item.source)) {
    await loadModule(dependency, moduleMap);
  }

  return module;
}

function topoSort(file, moduleMap, seen = new Set(), visiting = new Set(), result = []) {
  const normalized = normalizeModule(file);
  if (seen.has(normalized)) {
    return result;
  }
  if (visiting.has(normalized)) {
    throw new Error(`Cycle detected while bundling ${normalized}.`);
  }
  visiting.add(normalized);

  for (const dependency of internalDependencies(normalized, moduleMap)) {
    topoSort(dependency, moduleMap, seen, visiting, result);
  }

  visiting.delete(normalized);
  seen.add(normalized);
  result.push(normalized);
  return result;
}

function internalDependencies(file, moduleMapOrState = modules) {
  const state = isOptimizerState(moduleMapOrState) ? moduleMapOrState : null;
  const module = state ? effectiveModule(state, file) : moduleMapOrState.get(file);
  const reexports = state ? filteredReexports(state, file, module) : module.reexports;
  return [...module.imports, ...reexports]
    .filter((item) => !item.external)
    .map((item) => item.source);
}

function isOptimizerState(value) {
  return Boolean(value && typeof value === "object" && !("get" in value) && "moduleOverrides" in value);
}

function diagnoseCandidate(candidate, baselineCandidate) {
  const esmBrDelta = candidate.esm.br - baselineCandidate.esm.br;
  const umdBrDelta = candidate.umd.br - baselineCandidate.umd.br;
  const flowSpan = moduleSpan(candidate.order, isFlowModule);
  const registrySpan = moduleSpan(candidate.order, isRegistryModule);
  const tokenStats = Object.fromEntries(
    ["cache.browser", "cache.server", "asyncSignal", "route", "partial", "component", "boundary", "snapshot", "registry", "scheduler"]
      .map((token) => [token, tokenSpan(candidate.esmCode, token)])
      .filter(([, stats]) => stats.count > 1)
  );
  const reasons = [];
  if (esmBrDelta < 0 && umdBrDelta < 0) {
    reasons.push("improved br-11 for both ESM and UMD");
  } else if (esmBrDelta > 0 || umdBrDelta > 0) {
    reasons.push("regressed br-11 for at least one emitted asset");
  } else {
    reasons.push("matches the current layout");
  }
  if (candidate.name === "flow-late") {
    reasons.push("keeps inlined @async/flow runtime/helper vocabulary close together");
  }
  if (candidate.name === "protocol-grouped") {
    reasons.push("groups registry/cache/signals and component/router families");
  }
  if (candidate.name === "lexical") {
    reasons.push("clusters several related module paths but has a weaker design rationale");
  }
  if (candidate.name.startsWith("size-")) {
    reasons.push("source-size ordering is useful for search, not as a stable bundle contract");
  }
  if (candidate.name === "runtime-core-late") {
    reasons.push("moves app/loader/router/server modules later to test whether protocol vocabulary clusters better near registries");
  }
  for (const step of candidate.stepReports ?? []) {
    if (step.modulesChanged) {
      reasons.push(`${step.name} changes the effective module graph; compare removed modules and contract risks before treating byte wins as safe`);
    }
    if (step.publicExportsChanged) {
      reasons.push(`${step.name} removes public browser exports in this candidate`);
    }
    if (step.diagnosticsChanged) {
      reasons.push(`${step.name} adds diagnostics without necessarily changing emitted bytes`);
    }
    if (step.minifierChanged) {
      reasons.push(`${step.name} changes Terser options; risk=${step.risk}`);
    }
  }
  for (const risk of candidate.contract?.risks ?? []) {
    reasons.push(`contract risk: ${risk}`);
  }
  for (const hint of candidate.contract?.hints ?? []) {
    reasons.push(`hint: ${hint}`);
  }
  if (candidate.contract?.ok === false) {
    reasons.push(`rejected by ESM contract smoke: ${candidate.contract.reason}`);
  }

  return {
    summary: reasons.join("; "),
    flowSpan,
    registrySpan,
    tokenStats
  };
}

function size(code) {
  const buffer = Buffer.from(code);
  return {
    raw: buffer.byteLength,
    gzip: gzipSync(buffer, { level: 9 }).byteLength,
    br: brotliCompressSync(buffer, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11
      }
    }).byteLength
  };
}

function diffSizes(after, before) {
  return {
    raw: after.raw - before.raw,
    gzip: after.gzip - before.gzip,
    br: after.br - before.br
  };
}

async function minifyJavaScript(source, { module, options = {} }) {
  const terserOptions = mergeMinifierOptions({
    compress: {
      passes: 2,
      unsafe_arrows: true
    },
    mangle: true
  }, options);
  const result = await minify(source, {
    ecma: 2020,
    module,
    toplevel: true,
    compress: terserOptions.compress,
    mangle: terserOptions.mangle,
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
  for (const match of source.matchAll(/export\s+{([\s\S]*?)};/g)) {
    if (/\}\s+from\s+"/.test(match[0])) {
      continue;
    }
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

function externalVariable(specifier) {
  const name = specifier
    .replace(/^node:/, "node-")
    .replace(/[^A-Za-z0-9]+(.)/g, (_match, char) => char.toUpperCase())
    .replace(/^[^A-Za-z_$]+/, "");
  return `__${name}External`;
}

function byteLength(file) {
  return Buffer.byteLength(modules.get(file).source);
}

function flowLateRank(file) {
  return isFlowModule(file) ? 50 : protocolRank(file);
}

function protocolRank(file) {
  const ranks = [
    /define|attributes|lazy-registry|registry-store|cache|signals/,
    /html|component|handlers|partials|router/,
    /server|boundary-receiver/,
    /scheduler|loader|app|elements/,
    /@async\/flow|flow\.js/,
    /delay/
  ];
  const index = ranks.findIndex((regex) => regex.test(file));
  return index === -1 ? 99 : index;
}

function registryFirstRank(file) {
  if (isRegistryModule(file)) {
    return 0;
  }
  return protocolRank(file) + 10;
}

function runtimeCoreLateRank(file) {
  if (/^src\/(?:app|loader|router|server)\.js$/.test(file)) {
    return 80;
  }
  return protocolRank(file);
}

function isFlowModule(file) {
  return file.includes("@async/flow") || file === "src/flow.js";
}

function isRegistryModule(file) {
  return /lazy-registry|registry-store|cache|signals|handlers|component|partials|router/.test(file);
}

function moduleSpan(order, predicate) {
  const indexes = order
    .map((file, index) => predicate(file) ? index : -1)
    .filter((index) => index >= 0);
  return indexes.length > 0 ? indexes.at(-1) - indexes[0] : 0;
}

function tokenSpan(source, token) {
  const positions = [];
  let index = -1;
  while ((index = source.indexOf(token, index + 1)) !== -1) {
    positions.push(index);
  }
  if (positions.length < 2) {
    return {
      count: positions.length,
      span: 0,
      averageGap: 0,
      maxGap: 0
    };
  }
  const gaps = positions.slice(1).map((position, gapIndex) => position - positions[gapIndex]);
  return {
    count: positions.length,
    span: positions.at(-1) - positions[0],
    averageGap: Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length),
    maxGap: Math.max(...gaps)
  };
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

function renderMarkdownReport(report) {
  const rows = report.ranked.map((candidate) => [
    candidate.name,
    candidate.steps.length > 0 ? candidate.steps.join(" -> ") : "(baseline)",
    contractSummary(candidate),
    formatBytes(candidate.esm.raw),
    formatBytes(candidate.esm.gzip),
    formatBytes(candidate.esm.br),
    formatSigned(candidate.esmDelta.br),
    formatBytes(candidate.umd.raw),
    formatBytes(candidate.umd.gzip),
    formatBytes(candidate.umd.br),
    formatSigned(candidate.umdDelta.br),
    candidate.diagnostics.summary
  ]);
  const errorRows = report.errors.map((error) => `- ${error.name}: ${error.reason}`).join("\n");
  const stepRows = report.availableSteps.map((step) =>
    `- \`${step.name}\` (${step.risk ?? "safe"}): ${step.description}`
  ).join("\n");
  return [
    "# Bundle Layout Optimizer Report",
    "",
    `Entry: \`${report.entry}\``,
    "",
    `Modules: ${report.moduleCount}`,
    "",
    "Compression: gzip level 9, Brotli quality 11.",
    "",
    "## Available Steps",
    "",
    stepRows,
    "",
    "## Ranked Pipelines",
    "",
    "| Candidate | Steps | Contract | ESM raw | ESM gzip-9 | ESM br-11 | ESM br delta | UMD raw | UMD gzip-9 | UMD br-11 | UMD br delta | Diagnostic |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "## Invalid Candidates",
    "",
    errorRows || "None.",
    ""
  ].join("\n");
}

function printSummary(report) {
  console.log("Bundle optimizer pipeline");
  console.log(`Entry: ${report.entry}`);
  console.log(`Modules: ${report.moduleCount}`);
  console.log(`Compression: gzip level 9, Brotli quality 11`);
  console.log("");
  console.log("candidate\tsteps\tcontract\tesm.raw\tesm.gzip\tesm.br\tesm.delta\tumd.raw\tumd.gzip\tumd.br\tumd.delta\tdiagnostic");
  for (const candidate of report.ranked) {
    console.log([
      candidate.name,
      candidate.steps.length > 0 ? candidate.steps.join(" -> ") : "(baseline)",
      contractSummary(candidate),
      candidate.esm.raw,
      candidate.esm.gzip,
      candidate.esm.br,
      formatSigned(candidate.esmDelta.br),
      candidate.umd.raw,
      candidate.umd.gzip,
      candidate.umd.br,
      formatSigned(candidate.umdDelta.br),
      candidate.diagnostics.summary
    ].join("\t"));
  }
  if (report.errors.length > 0) {
    console.log("");
    console.log("invalid candidates");
    for (const error of report.errors) {
      console.log(`${error.name}\t${error.reason}`);
    }
  }
  if (writeBundles) {
    console.log("");
    console.log(`Wrote ${relative(root, outputRoot)}/report.json`);
    console.log(`Wrote ${relative(root, outputRoot)}/report.md`);
    console.log(`Wrote ${relative(root, join(outputRoot, "bundles"))}/`);
  }
}

function contractSummary(candidate) {
  if (candidate.contract?.ok === false) {
    return `rejected: ${candidate.contract.reason}`;
  }
  if ((candidate.contract?.risks ?? []).length > 0) {
    return "risk: delivery contract";
  }
  return "ok";
}

function formatBytes(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSigned(value) {
  const formatted = formatBytes(Math.abs(value));
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

function resolvePathOption(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return resolve(root, value);
}

function resolveValueOption(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function resolveListOption(name) {
  const value = resolveValueOption(name, "");
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function printStepList() {
  console.log("Available bundle optimizer steps:");
  for (const step of optimizerSteps.values()) {
    console.log(`${step.name}\t${step.risk ?? "safe"}\t${step.description}`);
  }
  console.log("");
  console.log("Available pipelines:");
  for (const pipeline of createOptimizerPipelines().values()) {
    console.log(`${pipeline.name}\t${pipeline.steps.join(" -> ") || "(baseline)"}`);
  }
}
