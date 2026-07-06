export const OPTIMIZER_ARTIFACT_VERSION = 1;

export const OPTIMIZER_PASSES = Object.freeze([
  "source-inventory",
  "jsx-semantic-graph",
  "event-normalization",
  "jsx-children-fragment-lowering",
  "signal-source-classification",
  "signal-ownership-lifetime",
  "event-symbol-extraction",
  "suspense-reveal-lowering",
  "runtime-slice-selection",
  "handler-emission",
  "plan-bootstrap-emit"
]);

export const RUNTIME_ENTRYPOINTS = Object.freeze({
  runtime: "@async/framework/runtime",
  signals: "@async/framework/runtime/signals",
  events: "@async/framework/runtime/events"
});

export const RUNTIME_SLICE_NAMES = Object.freeze([
  "signals",
  "events",
  "async-signals",
  "stream"
]);

// Slices with a shipped runtime entrypoint (see
// specs/framework/11-runtime-slice-entrypoints.md). "async-signals" and
// "stream" are planned: the optimizer records the requirement, but
// `@async/framework/runtime` cannot activate them yet.
export const AVAILABLE_RUNTIME_SLICE_NAMES = Object.freeze([
  "signals",
  "events"
]);

const omittedRuntimeSystems = Object.freeze([
  "no-build-loader",
  "router",
  "server",
  "cache",
  "partials",
  "components",
  "boundary-receiver"
]);

const validRevealOrders = new Set(["as-ready", "forwards", "backwards", "together"]);
const validRevealTails = new Set(["visible", "collapsed", "hidden"]);
const validHandlerModes = new Set(["inline", "direct-import", "eager-chunk", "lazy-chunk"]);

export function createOptimizerArtifactSet(input = {}) {
  const diagnostics = [];
  const sourceInventory = createSourceInventoryArtifact(input.sourceInventory, { diagnostics });
  const jsxSemanticGraph = createJsxSemanticGraphArtifact(input.semanticGraph, { diagnostics });
  const eventNormalization = normalizeEventProtocol(jsxSemanticGraph.eventProps, {
    diagnostics,
    profile: input.jsxProfile ?? input.profile ?? jsxSemanticGraph.jsxProfile ?? jsxSemanticGraph.profile
  }).artifact;
  const childrenFragments = lowerJsxChildren(jsxSemanticGraph, { diagnostics }).artifact;
  const signalSources = classifySignalSources(jsxSemanticGraph.signals, { diagnostics }).artifact;
  const signalOwnership = inferSignalOwnership(jsxSemanticGraph.signals, { diagnostics }).artifact;
  const eventSymbols = extractEventSymbols(eventNormalization.events, { diagnostics, normalized: true }).artifact;
  const streamBoundaries = lowerSuspenseReveal(jsxSemanticGraph, { diagnostics }).artifact;
  const runtimeSelection = selectRuntimeSlices({
    sourceInventory,
    signalSources,
    eventSymbols,
    streamBoundaries
  }, { diagnostics }).artifact;
  const handlerEmission = planHandlerEmission(eventSymbols.handlers, { diagnostics }).artifact;
  const report = createOptimizerReport({
    sourceInventory,
    signalSources,
    signalOwnership,
    eventNormalization,
    eventSymbols,
    streamBoundaries,
    runtimeSelection,
    handlerEmission,
    jsxSemanticGraph,
    childrenFragments
  });
  const buildEmit = {
    bootstrap: {
      mode: "fixture",
      entrypoint: runtimeSelection.entrypoint,
      slices: runtimeSelection.slices.map((slice) => slice.name)
    },
    manifest: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      passes: OPTIMIZER_PASSES
    },
    report
  };

  return {
    version: OPTIMIZER_ARTIFACT_VERSION,
    passes: OPTIMIZER_PASSES,
    artifacts: {
      sourceInventory,
      jsxSemanticGraph,
      childrenFragments,
      eventNormalization,
      signalSources,
      signalOwnership,
      eventSymbols,
      streamBoundaries,
      runtimeSelection,
      handlerEmission,
      buildEmit
    },
    diagnostics,
    report
  };
}

export function createSourceInventoryArtifact(input = {}, options = {}) {
  const diagnostics = getDiagnostics(options);
  const config = input.config ?? {};
  const host = config.host ?? {};
  const hostName = host.name ?? config.hostName;
  const hostVersion = Number(host.major ?? host.versionMajor ?? parseVersionMajor(host.version));
  const hostEngine = host.engine ?? config.engine;

  if (hostName && hostName !== "vite") {
    addDiagnostic(diagnostics, "unsupported-build-host", "Only Vite 8+ with Rolldown is supported by the build optimizer.", {
      pass: "source-inventory",
      value: hostName
    });
  }
  if (hostName === "vite" && hostVersion && hostVersion < 8) {
    addDiagnostic(diagnostics, "unsupported-build-host", "Vite hosts must be version 8 or newer.", {
      pass: "source-inventory",
      value: host.version ?? hostVersion
    });
  }
  if (hostName === "vite" && hostEngine && hostEngine !== "rolldown") {
    addDiagnostic(diagnostics, "unsupported-build-host", "The initial build optimizer supports the Rolldown engine only.", {
      pass: "source-inventory",
      value: hostEngine
    });
  }

  const frameworkImports = arrayOf(input.frameworkImports);
  for (const frameworkImport of frameworkImports) {
    if (frameworkImport.supported === false) {
      addDiagnostic(diagnostics, "unsupported-framework-import-shape", "Framework import shape is not supported by the build optimizer.", {
        pass: "source-inventory",
        sourceId: frameworkImport.sourceId ?? frameworkImport.module
      });
    }
  }

  const serverModules = arrayOf(input.serverModules);
  const serverIds = new Set(serverModules.map((module) => module.id).filter(Boolean));
  const entries = arrayOf(input.entries);
  for (const entry of entries) {
    if (entry.target !== "browser") {
      continue;
    }
    for (const imported of arrayOf(entry.imports)) {
      if (serverIds.has(imported)) {
        addDiagnostic(diagnostics, "browser-imports-server-only-code", "Browser output cannot import server-only modules.", {
          pass: "source-inventory",
          sourceId: entry.id,
          value: imported
        });
      }
    }
  }

  return {
    version: OPTIMIZER_ARTIFACT_VERSION,
    entries,
    frameworkImports,
    jsxModules: arrayOf(input.jsxModules),
    serverModules,
    config
  };
}

export function createJsxSemanticGraphArtifact(input = {}) {
  return {
    version: OPTIMIZER_ARTIFACT_VERSION,
    profile: input.profile ?? input.jsxProfile,
    jsxProfile: input.jsxProfile ?? input.profile,
    components: arrayOf(input.components),
    signals: arrayOf(input.signals),
    eventProps: arrayOf(input.eventProps),
    children: arrayOf(input.children),
    suspense: arrayOf(input.suspense),
    revealPolicies: arrayOf(input.revealPolicies),
    serverCalls: arrayOf(input.serverCalls),
    routes: arrayOf(input.routes),
    locators: arrayOf(input.locators)
  };
}

export function normalizeEventProtocol(eventProps = [], options = {}) {
  const diagnostics = getDiagnostics(options);
  const events = [];
  const seenCanonical = new Map();
  const defaultProfile = normalizeEventProfile(options.profile ?? options.jsxProfile);

  for (const [index, feature] of arrayOf(eventProps).entries()) {
    const sourceProp = feature.sourceProp ?? feature.propName ?? feature.name;
    const eventId = feature.eventId ?? `event:${index}`;
    const elementId = feature.elementId;
    const profile = normalizeEventProfile(feature.profile ?? feature.jsxProfile ?? defaultProfile);
    const sourceSyntax = eventSourceSyntax(sourceProp, feature.syntax);
    const canonical = canonicalEventForProp(sourceProp, sourceSyntax);
    const handlerId = feature.handlerId ?? feature.handler ?? `${eventId}:handler`;

    if (!sourceSyntax || !canonical) {
      addDiagnostic(diagnostics, "event-command-unlowerable", "Event command cannot be statically lowered.", {
        pass: "event-normalization",
        sourceId: eventId,
        sourceProp,
        selectedProfile: profile
      });
      continue;
    }

    if (!eventProfileAllowsSyntax(profile, sourceSyntax)) {
      addDiagnostic(diagnostics, eventSyntaxDiagnosticCode(profile, sourceSyntax), eventSyntaxDiagnosticMessage(profile, sourceSyntax), {
        pass: "event-normalization",
        sourceId: eventId,
        sourceProp,
        sourceSyntax,
        protocolProp: canonical.protocolProp,
        eventType: canonical.eventType,
        selectedProfile: profile
      });
      continue;
    }

    const duplicateKey = `${elementId ?? ""}\u0000${canonical.protocolProp}`;
    const duplicateOf = seenCanonical.get(duplicateKey);
    if (duplicateOf) {
      addDiagnostic(diagnostics, "duplicate-canonical-event", "Each element may declare a canonical event only once.", {
        pass: "event-normalization",
        sourceId: eventId,
        sourceProp,
        sourceSyntax,
        protocolProp: canonical.protocolProp,
        eventType: canonical.eventType,
        selectedProfile: profile,
        duplicateOf
      });
      continue;
    }
    seenCanonical.set(duplicateKey, eventId);

    events.push({
      eventId,
      elementId,
      sourceProp,
      propName: sourceProp,
      sourceSyntax,
      protocolProp: canonical.protocolProp,
      eventType: canonical.eventType,
      selectedProfile: profile,
      handlerId,
      commands: normalizeCommands(feature.commands, handlerId, feature.syncEventApis),
      module: feature.module,
      exportName: feature.exportName ?? handlerId,
      emissionMode: feature.emissionMode,
      chunk: feature.chunk,
      preload: Boolean(feature.preload),
      syncEventApis: arrayOf(feature.syncEventApis),
      preserveSyncEventApi: Boolean(feature.preserveSyncEventApi)
    });
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      profile: defaultProfile,
      events
    },
    diagnostics
  };
}

export function lowerJsxChildren(semanticGraph = {}, options = {}) {
  const diagnostics = getDiagnostics(options);
  const fragments = [];

  for (const [index, feature] of arrayOf(semanticGraph.children).entries()) {
    const fragmentId = requireFeatureId(feature, "children-fragment", diagnostics, "jsx-children-fragment-lowering");
    if (!fragmentId) {
      continue;
    }
    const componentId = feature.componentId ?? feature.component ?? feature.ownerComponent;
    const hasNestedChildren = feature.nestedChildren !== false && (
      feature.hasNestedChildren === true ||
      arrayOf(feature.children).length > 0 ||
      arrayOf(feature.nodes).length > 0
    );
    const hasExplicitChildrenProp = feature.explicitChildrenProp === true || feature.source === "children-prop";

    if (hasExplicitChildrenProp && hasNestedChildren) {
      addDiagnostic(diagnostics, "duplicate-jsx-children-source", "JSX children cannot mix explicit children props with nested children.", {
        pass: "jsx-children-fragment-lowering",
        sourceId: fragmentId,
        componentId
      });
      continue;
    }
    if (hasExplicitChildrenProp) {
      addDiagnostic(diagnostics, "author-written-children-prop", "Default JSX children must be nested source content, not an authored children prop.", {
        pass: "jsx-children-fragment-lowering",
        sourceId: fragmentId,
        componentId
      });
      continue;
    }
    if (feature.runtimeRepresentation === "jsx-node-array" || feature.runtimeChildrenKind === "jsx-node-array") {
      addDiagnostic(diagnostics, "runtime-jsx-children-array", "Production runtime children must lower to framework Children fragments, not JSX node arrays.", {
        pass: "jsx-children-fragment-lowering",
        sourceId: fragmentId,
        componentId
      });
      continue;
    }
    if (!hasNestedChildren) {
      fragments.push({
        fragmentId,
        componentId,
        mode: "empty",
        lowersTo: "undefined",
        runtimeRepresentation: "undefined"
      });
      continue;
    }

    const resourcefulness = classifyChildrenResourcefulness(feature);
    if (!resourcefulness) {
      addDiagnostic(diagnostics, "unknown-jsx-children-resourcefulness", "JSX children lowering must prove whether a fragment is static or resourceful before output is trusted.", {
        pass: "jsx-children-fragment-lowering",
        sourceId: fragmentId,
        componentId
      });
      continue;
    }
    const mode = resourcefulness.resourceful ? "lazy" : "static";
    fragments.push({
      fragmentId,
      componentId,
      mode,
      lowersTo: "Children",
      runtimeRepresentation: mode === "lazy" ? "lazy-children-factory" : "html-fragment",
      childIds: arrayOf(feature.children).map((child) => child.id).filter(Boolean),
      reasons: resourcefulness.reasons
    });
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      fragments
    },
    diagnostics
  };
}

function classifyChildrenResourcefulness(feature) {
  if (feature.resourceful === true || feature.mode === "lazy") {
    return { resourceful: true, reasons: arrayOf(feature.reasons).length > 0 ? arrayOf(feature.reasons) : ["marked-resourceful"] };
  }
  if (feature.resourceful === false || feature.mode === "static") {
    return { resourceful: false, reasons: [] };
  }
  const children = [...arrayOf(feature.children), ...arrayOf(feature.nodes)];
  if (children.length === 0) {
    return null;
  }
  const resourcefulKinds = new Set(["component", "handler", "event", "signal", "boundary", "suspense", "reveal", "resourceful"]);
  const reasons = [];
  for (const child of children) {
    const kind = child.kind ?? child.type;
    if (child.resourceful === true || resourcefulKinds.has(kind)) {
      reasons.push(child.id ?? kind);
    }
  }
  return {
    resourceful: reasons.length > 0,
    reasons
  };
}

export function classifySignalSources(signalFeatures = [], options = {}) {
  const diagnostics = getDiagnostics(options);
  const sources = [];

  for (const feature of arrayOf(signalFeatures)) {
    const sourceId = requireFeatureId(feature, "signal", diagnostics, "signal-source-classification");
    if (!sourceId) {
      continue;
    }
    const sourceShape = feature.sourceShape ?? feature.shape ?? feature.sourceKind;
    const dependencies = normalizeReads(feature.reads ?? feature.dependencies);

    if (sourceShape === "value" || sourceShape === "literal" || sourceShape === "non-function") {
      sources.push({
        kind: "writable",
        sourceId,
        initialValue: feature.initialValue
      });
      continue;
    }
    if (sourceShape === "sync-function" || sourceShape === "derived" || sourceShape === "computed") {
      sources.push({
        kind: "computed",
        sourceId,
        dependencies
      });
      continue;
    }
    if (sourceShape === "async-function" || sourceShape === "async" || sourceShape === "promise-wrapper") {
      if (dependencies.length === 0) {
        addDiagnostic(diagnostics, "async-source-missing-tracked-dependencies", "Async signal sources need tracked dependencies.", {
          pass: "signal-source-classification",
          sourceId
        });
      }
      sources.push({
        kind: "asyncSignal",
        sourceId,
        dependencies,
        latest: feature.latest !== false,
        pending: feature.pending !== false,
        error: feature.error !== false,
        versioned: true,
        stream: feature.stream ?? "default"
      });
      continue;
    }
    if (sourceShape === "maybe-promise" || sourceShape === "maybe-promise-function") {
      addDiagnostic(diagnostics, "maybe-promise-signal-source", "Maybe-promise signal sources must be made explicit before optimizer output is trusted.", {
        pass: "signal-source-classification",
        sourceId
      });
      continue;
    }

    addDiagnostic(diagnostics, "signal-source-unclassified", "signal(...) function source cannot be classified from static metadata.", {
      pass: "signal-source-classification",
      sourceId
    });
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      sources
    },
    diagnostics
  };
}

export function inferSignalOwnership(signalFeatures = [], options = {}) {
  const diagnostics = getDiagnostics(options);
  const ownership = [];

  for (const feature of arrayOf(signalFeatures)) {
    const sourceId = requireFeatureId(feature, "signal", diagnostics, "signal-ownership-lifetime");
    if (!sourceId) {
      continue;
    }

    if (feature.createdIn === "event-handler" && !feature.explicitLifetime) {
      addDiagnostic(diagnostics, "invalid-handler-signal-lifetime", "Signals created inside event handlers need explicit lifetime before optimizer output.", {
        pass: "signal-ownership-lifetime",
        sourceId
      });
      continue;
    }

    const owner = normalizeOwner(feature.owner ?? feature.scope);
    if (!owner) {
      addDiagnostic(diagnostics, "ambiguous-signal-owner", "Signal ownership is ambiguous and must not be silently promoted to global.", {
        pass: "signal-ownership-lifetime",
        sourceId
      });
      continue;
    }

    ownership.push({
      sourceId,
      owner,
      reason: feature.ownerReason ?? ownershipReason(owner)
    });
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      ownership
    },
    diagnostics
  };
}

export function extractEventSymbols(eventProps = [], options = {}) {
  const diagnostics = getDiagnostics(options);
  const normalizedEvents = options.normalized === true
    ? arrayOf(eventProps)
    : normalizeEventProtocol(eventProps, { ...options, diagnostics }).artifact.events;
  const events = [];
  const handlers = [];

  for (const feature of normalizedEvents) {
    const eventId = feature.eventId;
    const handlerId = feature.handlerId;
    events.push({
      eventId,
      elementId: feature.elementId,
      propName: feature.sourceProp,
      sourceProp: feature.sourceProp,
      sourceSyntax: feature.sourceSyntax,
      protocolProp: feature.protocolProp,
      eventType: feature.eventType,
      commands: feature.commands,
      handlerId
    });
    handlers.push({
      symbolId: handlerId,
      eventId,
      propName: feature.sourceProp,
      sourceProp: feature.sourceProp,
      sourceSyntax: feature.sourceSyntax,
      protocolProp: feature.protocolProp,
      eventType: feature.eventType,
      module: feature.module,
      exportName: feature.exportName ?? handlerId,
      mode: feature.emissionMode,
      chunk: feature.chunk,
      preload: Boolean(feature.preload),
      syncEventApis: arrayOf(feature.syncEventApis),
      preserveSyncEventApi: Boolean(feature.preserveSyncEventApi)
    });
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      events,
      handlers
    },
    diagnostics
  };
}

export function lowerSuspenseReveal(semanticGraph = {}, options = {}) {
  const diagnostics = getDiagnostics(options);
  const suspenseBoundaries = [];
  const suspenseById = new Map();

  for (const [index, feature] of arrayOf(semanticGraph.suspense).entries()) {
    const boundaryId = feature.boundaryId ?? feature.id;
    if (!boundaryId) {
      addDiagnostic(diagnostics, "unstable-suspense-boundary-id", "Suspense boundary cannot get a stable stream boundary id.", {
        pass: "suspense-reveal-lowering",
        sourceId: `suspense:${index}`
      });
      continue;
    }
    const boundary = {
      boundaryId,
      sourceOrder: Number(feature.sourceOrder ?? index),
      fallbackId: feature.fallbackId,
      finalId: feature.finalId,
      asyncSourceIds: arrayOf(feature.asyncSourceIds)
    };
    suspenseBoundaries.push(boundary);
    suspenseById.set(boundaryId, boundary);
  }

  const revealGroups = [];
  for (const [index, policy] of arrayOf(semanticGraph.revealPolicies).entries()) {
    const order = policy.order ?? "as-ready";
    const tail = policy.tail ?? "visible";
    const groupId = policy.groupId ?? `reveal:${index}`;
    const boundaryIds = arrayOf(policy.boundaryIds);
    if (!validRevealOrders.has(order) || !validRevealTails.has(tail)) {
      addDiagnostic(diagnostics, "invalid-reveal-policy", "Invalid Reveal order or tail policy.", {
        pass: "suspense-reveal-lowering",
        sourceId: groupId,
        value: `${order}/${tail}`
      });
      continue;
    }

    const boundaries = boundaryIds.map((boundaryId) => suspenseById.get(boundaryId));
    if (boundaries.some((boundary) => !boundary)) {
      addDiagnostic(diagnostics, "malformed-reveal-nesting", "Reveal policies must reference known direct Suspense boundaries.", {
        pass: "suspense-reveal-lowering",
        sourceId: groupId
      });
      continue;
    }

    const sourceOrder = boundaries
      .toSorted((left, right) => left.sourceOrder - right.sourceOrder)
      .map((boundary) => boundary.boundaryId);
    const arrivalOrder = arrayOf(policy.arrivalOrder).filter((boundaryId) => boundaryIds.includes(boundaryId));
    revealGroups.push({
      groupId,
      order,
      tail,
      boundaryIds,
      arrivalOrder,
      commitOrder: commitOrderForReveal(order, sourceOrder, arrivalOrder)
    });
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      suspenseBoundaries,
      revealGroups
    },
    diagnostics
  };
}

export function selectRuntimeSlices(featureArtifacts = {}, options = {}) {
  const signalSources = featureArtifacts.signalSources ?? { sources: [] };
  const eventSymbols = featureArtifacts.eventSymbols ?? { events: [], handlers: [] };
  const streamBoundaries = featureArtifacts.streamBoundaries ?? { suspenseBoundaries: [], revealGroups: [] };
  const diagnostics = getDiagnostics(options);
  const signalCounts = countBy(signalSources.sources, "kind");
  const hasSignals = signalSources.sources.length > 0;
  const hasAsyncSignals = signalCounts.asyncSignal > 0;
  const hasEvents = eventSymbols.events.length > 0;
  const hasStream = streamBoundaries.suspenseBoundaries.length > 0 || streamBoundaries.revealGroups.length > 0;
  const slices = [];

  if (hasSignals) {
    slices.push({ name: "signals", status: sliceStatus("signals"), reason: "signal source artifact is non-empty" });
  }
  if (hasEvents) {
    slices.push({ name: "events", status: sliceStatus("events"), reason: "event symbol artifact is non-empty" });
  }
  if (hasAsyncSignals) {
    slices.push({ name: "async-signals", status: sliceStatus("async-signals"), reason: "async signal source records require status/version state" });
  }
  if (hasStream) {
    slices.push({ name: "stream", status: sliceStatus("stream"), reason: "Suspense or Reveal artifacts require stream boundary coordination" });
  }

  for (const slice of slices) {
    if (slice.status === "planned") {
      addDiagnostic(diagnostics, "runtime-slice-planned", `Runtime slice "${slice.name}" is required by the source profile but has no shipped runtime entrypoint yet; its records are reported but not activated by @async/framework/runtime.`, {
        severity: "warning",
        pass: "runtime-slice-selection",
        value: slice.name
      });
    }
  }

  const entrypoint = chooseRuntimeEntrypoint({ hasSignals, hasEvents, hasAsyncSignals, hasStream });
  const selected = new Set(slices.map((slice) => slice.name));
  const omitted = omittedRuntimeSystems.map((system) => ({
    system,
    reason: omittedSystemReason(system)
  }));
  if (!selected.has("async-signals")) {
    omitted.push({ system: "async-signal-status", reason: "no async signal source records" });
  }
  if (!selected.has("stream")) {
    omitted.push({ system: "stream-boundary-coordination", reason: "no Suspense, Reveal, boundary, or patch records" });
  }

  const fallbacks = [];
  if (entrypoint === "no-build-loader") {
    addDiagnostic(diagnostics, "runtime-slice-fallback", "Runtime selection must not silently fall back to the no-build loader.", {
      pass: "runtime-slice-selection"
    });
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      entrypoint,
      slices,
      omitted,
      fallbacks
    },
    diagnostics
  };
}

export function planHandlerEmission(handlers = [], options = {}) {
  const diagnostics = getDiagnostics(options);
  const decisions = [];

  for (const handler of arrayOf(handlers)) {
    const mode = handler.mode ?? (handler.module ? "direct-import" : "inline");
    if (!validHandlerModes.has(mode)) {
      addDiagnostic(diagnostics, "handler-emission-mode-unknown", "Handler emission mode is not supported.", {
        pass: "handler-emission",
        sourceId: handler.symbolId,
        value: mode
      });
      continue;
    }
    if (mode === "lazy-chunk" && handler.syncEventApis.length > 0 && !handler.preserveSyncEventApi) {
      addDiagnostic(diagnostics, "handler-emission-loses-event-semantics", "Lazy handler emission must preserve synchronous event API semantics.", {
        pass: "handler-emission",
        sourceId: handler.symbolId
      });
      continue;
    }

    const decision = { mode, symbolId: handler.symbolId };
    if (mode === "direct-import") {
      decision.module = handler.module;
    }
    if (mode === "eager-chunk" || mode === "lazy-chunk") {
      decision.chunk = handler.chunk;
      if (mode === "lazy-chunk" && handler.preload) {
        decision.preload = true;
      }
    }
    decisions.push(decision);
  }

  return {
    artifact: {
      version: OPTIMIZER_ARTIFACT_VERSION,
      handlers: decisions
    },
    diagnostics
  };
}

export function createOptimizerReport(artifacts) {
  const signalSourceCounts = countBy(artifacts.signalSources.sources, "kind", ["writable", "computed", "asyncSignal"]);
  const signalOwnershipCounts = countBy(artifacts.signalOwnership.ownership, "owner", [
    "app",
    "shared-module",
    "component",
    "owner-relative"
  ]);
  const asyncStatusCounts = {
    latest: countWhere(artifacts.signalSources.sources, (source) => source.kind === "asyncSignal" && source.latest),
    pending: countWhere(artifacts.signalSources.sources, (source) => source.kind === "asyncSignal" && source.pending),
    error: countWhere(artifacts.signalSources.sources, (source) => source.kind === "asyncSignal" && source.error),
    versioned: countWhere(artifacts.signalSources.sources, (source) => source.kind === "asyncSignal" && source.versioned),
    streamDefault: countWhere(artifacts.signalSources.sources, (source) => source.kind === "asyncSignal" && source.stream === "default"),
    streamDefer: countWhere(artifacts.signalSources.sources, (source) => source.kind === "asyncSignal" && source.stream === "defer")
  };
  const handlerEmissionCounts = countBy(artifacts.handlerEmission.handlers, "mode", [
    "inline",
    "direct-import",
    "eager-chunk",
    "lazy-chunk"
  ]);
  const revealOrderCounts = countBy(artifacts.streamBoundaries.revealGroups, "order", [
    "as-ready",
    "forwards",
    "backwards",
    "together"
  ]);
  const revealTailCounts = countBy(artifacts.streamBoundaries.revealGroups, "tail", [
    "visible",
    "collapsed",
    "hidden"
  ]);
  const childrenCounts = countBy(artifacts.childrenFragments.fragments, "mode", [
    "empty",
    "static",
    "lazy"
  ]);

  return {
    version: OPTIMIZER_ARTIFACT_VERSION,
    runtime: {
      entrypoint: artifacts.runtimeSelection.entrypoint,
      slices: artifacts.runtimeSelection.slices,
      omitted: artifacts.runtimeSelection.omitted,
      fallbacks: artifacts.runtimeSelection.fallbacks
    },
    signals: {
      sources: signalSourceCounts,
      ownership: signalOwnershipCounts,
      asyncStatus: asyncStatusCounts
    },
    events: {
      eventCount: artifacts.eventSymbols.events.length,
      handlerCount: artifacts.eventSymbols.handlers.length
    },
    handlers: {
      emission: handlerEmissionCounts
    },
    children: {
      fragments: childrenCounts
    },
    stream: {
      suspenseBoundaryCount: artifacts.streamBoundaries.suspenseBoundaries.length,
      reveal: {
        byOrder: revealOrderCounts,
        byTail: revealTailCounts
      }
    },
    serverOnlyModuleExclusions: artifacts.sourceInventory.serverModules.length,
    generatedLocatorCount: countGraphLocators(artifacts.jsxSemanticGraph)
  };
}

export function hasOptimizerErrors(diagnostics = []) {
  return arrayOf(diagnostics).some((diagnostic) => diagnostic.severity === "error");
}

function parseVersionMajor(version) {
  const match = String(version ?? "").match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function getDiagnostics(options) {
  return Array.isArray(options.diagnostics) ? options.diagnostics : [];
}

function addDiagnostic(diagnostics, code, message, details = {}) {
  diagnostics.push({
    severity: "error",
    code,
    message,
    ...details
  });
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function requireFeatureId(feature, label, diagnostics, pass) {
  const id = feature.sourceId ?? feature.id;
  if (id) {
    return id;
  }
  addDiagnostic(diagnostics, `${label}-id-missing`, `${label} feature is missing a stable id.`, { pass });
  return null;
}

function normalizeReads(reads) {
  return arrayOf(reads).map((read) => {
    if (typeof read === "string") {
      return { sourceId: read };
    }
    return read;
  });
}

function normalizeOwner(owner) {
  if (owner === "global") {
    return "app";
  }
  if (owner === "module") {
    return "shared-module";
  }
  if (owner === "app" || owner === "shared-module" || owner === "component" || owner === "owner-relative") {
    return owner;
  }
  return null;
}

function ownershipReason(owner) {
  if (owner === "app") {
    return "module-level signal is shared across the app graph";
  }
  if (owner === "shared-module") {
    return "module-level signal is shared by imported modules";
  }
  if (owner === "component") {
    return "signal is created inside component instance scope";
  }
  return "signal ownership is relative to the current owner";
}

function sliceStatus(name) {
  return AVAILABLE_RUNTIME_SLICE_NAMES.includes(name) ? "available" : "planned";
}

function normalizeEventProfile(profile) {
  if (profile === "runtime" || profile === "compat" || profile === "buildtime") {
    return profile;
  }
  return "buildtime";
}

function eventSourceSyntax(propName, syntax) {
  if (syntax === "jsx-event-prop" || syntax === "jsx") {
    return "jsx-event-prop";
  }
  if (syntax === "protocol-event-prop" || syntax === "protocol" || syntax === "no-build") {
    return "protocol-event-prop";
  }
  if (typeof propName === "string" && propName.startsWith("on:")) {
    return "protocol-event-prop";
  }
  if (typeof propName === "string" && /^on[A-Z]/.test(propName)) {
    return "jsx-event-prop";
  }
  return null;
}

function canonicalEventForProp(propName, sourceSyntax) {
  if (sourceSyntax === "protocol-event-prop") {
    const eventType = protocolEventType(propName);
    return eventType ? { eventType, protocolProp: `on:${eventType}` } : null;
  }
  if (sourceSyntax === "jsx-event-prop") {
    const eventType = jsxEventType(propName);
    return eventType ? { eventType, protocolProp: `on:${eventType}` } : null;
  }
  return null;
}

function eventProfileAllowsSyntax(profile, sourceSyntax) {
  if (profile === "compat") {
    return true;
  }
  if (profile === "runtime") {
    return sourceSyntax === "protocol-event-prop";
  }
  return sourceSyntax === "jsx-event-prop";
}

function eventSyntaxDiagnosticCode(profile, sourceSyntax) {
  if (profile === "buildtime" && sourceSyntax === "protocol-event-prop") {
    return "no-build-event-syntax-in-jsx";
  }
  if (profile === "runtime" && sourceSyntax === "jsx-event-prop") {
    return "jsx-event-syntax-in-runtime-profile";
  }
  return "event-syntax-profile-mismatch";
}

function eventSyntaxDiagnosticMessage(profile, sourceSyntax) {
  if (profile === "buildtime" && sourceSyntax === "protocol-event-prop") {
    return "JSX build profile uses onClick-style props unless compatibility mode is explicit.";
  }
  if (profile === "runtime" && sourceSyntax === "jsx-event-prop") {
    return "JSX runtime profile uses on: event props unless compatibility mode is explicit.";
  }
  return "Event prop syntax is not accepted by the selected JSX profile.";
}

function protocolEventType(propName) {
  if (typeof propName !== "string" || !/^on:[a-z][a-z0-9-]*$/.test(propName)) {
    return null;
  }
  return propName.slice(3);
}

function jsxEventType(propName) {
  if (typeof propName !== "string" || !/^on[A-Z]/.test(propName)) {
    return null;
  }
  return propName.slice(2).replace(/[A-Z]/g, (letter, index) => {
    const lower = letter.toLowerCase();
    return index === 0 ? lower : `-${lower}`;
  });
}

function normalizeCommands(commands, handlerId, syncEventApis = []) {
  const normalized = arrayOf(commands).map((command) => Array.isArray(command) ? command : [command]);
  if (!normalized.some((command) => command[0] === "handler")) {
    normalized.push(["handler", handlerId]);
  }
  for (const api of arrayOf(syncEventApis)) {
    if (!normalized.some((command) => command[0] === api)) {
      normalized.unshift([api]);
    }
  }
  return normalized;
}

function commitOrderForReveal(order, sourceOrder, arrivalOrder) {
  if (order === "as-ready") {
    return arrivalOrder.length > 0 ? arrivalOrder : sourceOrder;
  }
  if (order === "backwards") {
    return [...sourceOrder].reverse();
  }
  return sourceOrder;
}

function chooseRuntimeEntrypoint(features) {
  if (features.hasSignals && !features.hasEvents && !features.hasAsyncSignals && !features.hasStream) {
    return RUNTIME_ENTRYPOINTS.signals;
  }
  if (features.hasEvents && !features.hasSignals && !features.hasAsyncSignals && !features.hasStream) {
    return RUNTIME_ENTRYPOINTS.events;
  }
  return RUNTIME_ENTRYPOINTS.runtime;
}

function omittedSystemReason(system) {
  if (system === "no-build-loader") {
    return "build profile emits an explicit runtime plan instead of scanning HTML through the no-build loader";
  }
  if (system === "server") {
    return "server-only modules are excluded from browser output";
  }
  return "feature graph does not require this no-build system";
}

function countBy(items, key, knownKeys = []) {
  const counts = Object.fromEntries(knownKeys.map((knownKey) => [knownKey, 0]));
  for (const item of arrayOf(items)) {
    const value = item[key];
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function countWhere(items, predicate) {
  return arrayOf(items).filter(predicate).length;
}

function countGraphLocators(graph) {
  let total = arrayOf(graph.locators).length;
  for (const component of arrayOf(graph.components)) {
    total += arrayOf(component.locators).length;
  }
  return total;
}
