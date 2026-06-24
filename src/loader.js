import { renderComponent } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { childrenFragment, isTemplateResult, rawHtml, renderTemplate } from "./html.js";
import { createScheduler } from "./scheduler.js";
import { createSignalRegistry, isSignalRef } from "./signals.js";
import { matchAttribute, normalizeAttributeConfig, readAttribute } from "./attributes.js";

const inlineBindingPrefix = "__async:inline:";

export function Loader({ root, signals, handlers, server, router, cache, components, attributes, scheduler } = {}) {
  const documentRef = root?.ownerDocument ?? root ?? globalThis.document;
  const rootNode = root ?? documentRef;
  const signalRegistry = signals ?? createSignalRegistry();
  const handlerRegistry = handlers ?? createHandlerRegistry();
  const schedulerInstance = scheduler ?? createScheduler();
  const ownsScheduler = !scheduler;
  const attributeConfig = normalizeAttributeConfig(attributes);
  const cleanups = new Set();
  const eventBindings = new WeakMap();
  const signalBindings = new WeakMap();
  const mountedElements = new WeakSet();
  const visibleElements = new WeakSet();
  const intersectionBindings = new WeakMap();
  const boundaryState = new WeakMap();
  const swapSnapshots = new WeakMap();
  const renderingBoundaries = new WeakSet();
  const componentBindings = new WeakSet();
  const inlineBindings = new Map();
  const scopedCleanups = new WeakMap();
  let inlineBindingCounter = 0;
  let boundaryBindingCounter = 0;
  let destroyed = false;
  let mountPseudoEventWarned = false;

  const api = {
    root: rootNode,
    signals: signalRegistry,
    handlers: handlerRegistry,
    server,
    router,
    cache,
    components,
    scheduler: schedulerInstance,
    attributes: attributeConfig,

    start() {
      assertActive();
      api.scan(rootNode);
      return api;
    },

    scan(rootOrFragment = rootNode) {
      assertActive();
      scanScope(rootOrFragment);
      return api;
    },

    swap(boundaryIdOrConfig, fragmentOrTemplate, options) {
      assertActive();
      if (isSwapConfig(boundaryIdOrConfig)) {
        return runSwapConfig(boundaryIdOrConfig);
      }
      const swapOptions = normalizeSwapOptions(options);
      const boundary = requireBoundary(boundaryIdOrConfig);
      applyBoundarySwap(boundary, fragmentOrTemplate, swapOptions);
      return boundary;
    },

    mount(target, Component, props = {}) {
      assertActive();
      const rendered = renderComponent(Component, props, {
        signals: signalRegistry,
        handlers: handlerRegistry,
        loader: api,
        server: api.server,
        router: api.router,
        cache: api.cache,
        components: api.components,
        scheduler: schedulerInstance,
        attributes: attributeConfig
      });
      cleanupChildren(target);
      target.replaceChildren(toFragment(rendered.html, target.ownerDocument));
      api.scan(target);
      rendered.mount(target);
      rendered.visible(target, api._observeVisible);
      rendered.intersection(target, api._observeIntersection);
      addCleanup(rendered.cleanup, target, "children");
      return rendered;
    },

    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      markDestroyedScopes(rootNode);
      for (const cleanup of [...cleanups]) {
        runCleanup(cleanup);
      }
      cleanups.clear();
      if (ownsScheduler) {
        schedulerInstance.destroy();
      }
    },

    _observeVisible(target, fn) {
      return observeVisible(target, fn);
    },

    _observeIntersection(target, fn, options = {}) {
      return observeIntersection(target, fn, options);
    },

    _resolveFragmentTarget(target, marker) {
      return resolveFragmentTarget(target, marker);
    },

    _registerBinding(value) {
      const id = `${inlineBindingPrefix}${++inlineBindingCounter}`;
      inlineBindings.set(id, value);
      return id;
    },

    _releaseBinding(id) {
      inlineBindings.delete(id);
    }
  };

  signalRegistry._setContext?.({ server: api.server, router: api.router, loader: api, cache: api.cache, scheduler: schedulerInstance });
  api.server?._setContext?.({
    signals: signalRegistry,
    handlers: handlerRegistry,
    loader: api,
    router: api.router,
    cache: api.cache,
    scheduler: schedulerInstance
  });

  function requireBoundary(boundaryId) {
    const boundary = findBoundary(rootNode, boundaryId, attributeConfig);
    if (!boundary) {
      throw new Error(`Boundary "${boundaryId}" was not found.`);
    }
    return boundary;
  }

  function runSwapConfig(config) {
    const type = normalizeSwapConfigType(config);
    if (type === "many") {
      if (!Object.hasOwn(config, "updates")) {
        throw new TypeError('loader.swap({ type: "many" }) requires an "updates" value.');
      }
      return applyManySwap(config.updates, config);
    }
    const boundaryId = boundaryIdFromSwapConfig(config);
    if (type === "bind") {
      return bindSwapBoundary(boundaryId, config.render, config);
    }
    const value = valueFromSwapConfig(config, type);
    if (type === "ifChanged") {
      return applyChangedSwap(boundaryId, value, config);
    }
    const swapOptions = normalizeSwapOptions(config);
    const boundary = requireBoundary(boundaryId);
    applyBoundarySwap(boundary, value, swapOptions);
    return boundary;
  }

  function applyChangedSwap(boundaryId, fragmentOrTemplateOrFn, options) {
    const swapOptions = normalizeSwapOptions(options);
    const boundary = requireBoundary(boundaryId);
    const fragmentOrTemplate = typeof fragmentOrTemplateOrFn === "function"
      ? fragmentOrTemplateOrFn.call(api, boundaryRenderContext(boundaryId, boundary))
      : fragmentOrTemplateOrFn;
    const snapshot = snapshotSwapValue(fragmentOrTemplate, documentRef, templateRenderOptions());
    if (snapshot != null && swapSnapshots.get(boundary) === snapshot) {
      return boundary;
    }
    applyBoundarySwap(boundary, fragmentOrTemplate, swapOptions, { snapshot });
    return boundary;
  }

  function applyManySwap(updates, options) {
    const swapOptions = normalizeSwapManyOptions(options);
    const results = [];
    for (const [boundaryId, fragmentOrTemplate] of normalizeSwapManyEntries(updates)) {
      const boundary = requireBoundary(boundaryId);
      const snapshot = snapshotSwapValue(fragmentOrTemplate, documentRef, templateRenderOptions());
      const scanRoots = applyBoundarySwap(boundary, fragmentOrTemplate, {
        ...swapOptions,
        scan: "none"
      }, {
        snapshot
      });
      results.push({
        boundary,
        strategy: swapOptions.strategy,
        scanRoots
      });
    }
    scanSwapResults(results, swapOptions.scan === "once" ? "auto" : swapOptions.scan);
    return results.map((result) => result.boundary);
  }

  function bindSwapBoundary(boundaryId, renderFn, options) {
    if (typeof renderFn !== "function") {
      throw new TypeError('loader.swap({ type: "bind", render }) requires a render function.');
    }
    const swapOptions = normalizeSwapOptions(options);
    const boundary = requireBoundary(boundaryId);
    const bindingKey = `swap:bind:${String(boundaryId)}:${++boundaryBindingCounter}`;
    let stopped = false;
    let dependencyCleanups = [];

    const cleanupDependencies = () => {
      for (const cleanup of dependencyCleanups) {
        cleanup();
      }
      dependencyCleanups = [];
    };

    const scheduleRun = () => {
      schedulerInstance.enqueue("effect", run, {
        scope: boundary,
        key: bindingKey
      });
    };

    const run = () => {
      if (stopped) {
        return;
      }
      cleanupDependencies();
      const outcome = signalRegistry._collectDependencies(() => {
        const fragmentOrTemplate = renderFn.call(api, boundaryRenderContext(boundaryId, boundary));
        return {
          fragmentOrTemplate,
          snapshot: snapshotSwapValue(fragmentOrTemplate, documentRef, templateRenderOptions())
        };
      });
      dependencyCleanups = outcome.dependencies.map((dependency) => signalRegistry.subscribe(dependency, scheduleRun));
      const { fragmentOrTemplate, snapshot } = outcome.value;
      if (snapshot != null && swapSnapshots.get(boundary) === snapshot) {
        return;
      }
      applyBoundarySwap(boundary, fragmentOrTemplate, swapOptions, { snapshot });
    };

    run();
    const cleanup = addCleanup(() => {
      stopped = true;
      cleanupDependencies();
    }, boundary);
    return () => runCleanup(cleanup);
  }

  function applyBoundarySwap(boundary, fragmentOrTemplate, swapOptions, metadata = {}) {
    const snapshot = Object.hasOwn(metadata, "snapshot")
      ? metadata.snapshot
      : snapshotSwapValue(fragmentOrTemplate, documentRef, templateRenderOptions());
    const scanRoots = swapOptions.strategy === "morph"
      ? morphChildren(boundary, toFragment(fragmentOrTemplate, documentRef, templateRenderOptions()))
      : replaceBoundaryChildren(boundary, fragmentOrTemplate);
    if (snapshot != null) {
      swapSnapshots.set(boundary, snapshot);
    } else {
      swapSnapshots.delete(boundary);
    }
    scanSwapResults([{ boundary, strategy: swapOptions.strategy, scanRoots }], swapOptions.scan);
    return scanRoots;
  }

  function scanSwapResults(results, scan) {
    if (scan === "none") {
      return;
    }
    for (const result of results) {
      if (scan === "full") {
        scanScope(result.boundary);
      } else if (result.strategy === "morph") {
        scanChangedRoots(result.scanRoots);
      } else {
        scanScope(result.boundary, { includeRoot: false });
      }
    }
  }

  function templateRenderOptions() {
    return {
      attributes: attributeConfig,
      signals: signalRegistry,
      bind: api._registerBinding?.bind(api)
    };
  }

  function boundaryRenderContext(boundaryId, boundary) {
    return {
      boundary,
      boundaryId: String(boundaryId),
      loader: api,
      signals: signalRegistry,
      handlers: handlerRegistry,
      server: api.server,
      router: api.router,
      cache: api.cache,
      scheduler: schedulerInstance
    };
  }

  function scanScope(scope, scanOptions = {}) {
    reviveScopes(scope, scanOptions);
    bindSignalAttributes(scope, scanOptions);
    bindClassAttributes(scope, scanOptions);
    bindEventAttributes(scope, scanOptions);
    bindBoundaries(scope, scanOptions);
    bindComponentAttributes(scope, scanOptions);
    runPseudoEvents(scope, scanOptions);
  }

  function bindEventAttributes(scope, scanOptions) {
    for (const element of elementsIn(scope, scanOptions)) {
      if (typeof element.getAttributeNames !== "function") {
        continue;
      }
      for (const name of element.getAttributeNames()) {
        const eventName = matchAttribute(name, attributeConfig, "on");
        if (!eventName) {
          continue;
        }
        if (eventName === "attach" || eventName === "mount" || eventName === "visible" || eventName === "intersect") {
          continue;
        }
        bindEvent(element, eventName, element.getAttribute(name));
      }
    }
  }

  function bindEvent(element, eventName, ref) {
    const key = `${eventName}:${ref}`;
    const bound = eventBindings.get(element) ?? new Set();
    if (bound.has(key)) {
      return;
    }
    bound.add(key);
    eventBindings.set(element, bound);

    const listener = async (event) => {
      try {
        await schedulerInstance.batch(() => handlerRegistry.run(ref, {
          signals: signalRegistry,
          handlers: handlerRegistry,
          loader: api,
          server: api.server,
          router: api.router,
          cache: api.cache,
          scheduler: schedulerInstance,
          event,
          element,
          el: element,
          root: rootNode
        }));
      } catch (error) {
        dispatchAsyncError(element, error);
      }
    };

    element.addEventListener(eventName, listener);
    addCleanup(() => element.removeEventListener(eventName, listener), element);
  }

  function bindSignalAttributes(scope, scanOptions) {
    for (const element of elementsIn(scope, scanOptions)) {
      for (const name of element.getAttributeNames?.() ?? []) {
        const signalName = matchAttribute(name, attributeConfig, "signal");
        if (!signalName) {
          continue;
        }
        if (signalName === "text") {
          const path = element.getAttribute(name);
          bindSignal(element, `text:${path}`, path, (value) => {
            element.textContent = value ?? "";
          });
          continue;
        }
        if (signalName === "value") {
          const path = element.getAttribute(name);
          bindSignal(element, `value:${path}`, path, (value) => {
            if ("value" in element && element.value !== String(value ?? "")) {
              element.value = value ?? "";
            } else if (!("value" in element)) {
              element.setAttribute("value", value ?? "");
            }
          });
          bindValueWriter(element, path);
          continue;
        }
        if (signalName.startsWith("attr:")) {
          const attr = signalName.slice("attr:".length);
          const path = element.getAttribute(name);
          bindSignal(element, `attr:${attr}:${path}`, path, (value) => updateAttribute(element, attr, value));
          continue;
        }
        if (signalName.startsWith("prop:")) {
          const prop = signalName.slice("prop:".length);
          const path = element.getAttribute(name);
          bindSignal(element, `prop:${prop}:${path}`, path, (value) => updateProperty(element, prop, value));
          continue;
        }
        if (signalName.startsWith("class:")) {
          const className = signalName.slice("class:".length);
          const path = element.getAttribute(name);
          if (className === "" || className === "{}") {
            bindClass(element, className, path);
          } else {
            bindSignal(element, `class:${className}:${path}`, path, (value) => {
              element.classList.toggle(className, Boolean(value));
            });
          }
          continue;
        }
        if (signalName === "class") {
          const path = element.getAttribute(name);
          bindClass(element, "{}", path);
        }
      }
    }
  }

  function bindClassAttributes(scope, scanOptions) {
    for (const element of elementsIn(scope, scanOptions)) {
      for (const name of element.getAttributeNames?.() ?? []) {
        const className = matchAttribute(name, attributeConfig, "class");
        if (className == null) {
          continue;
        }
        bindClass(element, className, element.getAttribute(name));
      }
    }
  }

  function bindClass(element, className, path) {
    if (className === "" || className === "{}") {
      const staticClasses = readClassTokens(element);
      let previous = new Set();
      bindSignal(element, `class:{}:${path}`, path, (value) => {
        const next = normalizeClassTokens(value);
        const current = readClassTokens(element);
        for (const token of previous) {
          if (!next.has(token) && !staticClasses.has(token)) {
            current.delete(token);
          }
        }
        for (const token of next) {
          current.add(token);
        }
        writeClassTokens(element, current);
        previous = next;
      }, { rawInline: true });
      return;
    }

    bindSignal(element, `class:${className}:${path}`, path, (value) => {
      updateClassToken(element, className, Boolean(value));
    });
  }

  function bindSignal(element, key, path, apply, options = {}) {
    const bound = signalBindings.get(element) ?? new Set();
    if (bound.has(key)) {
      return;
    }
    bound.add(key);
    signalBindings.set(element, bound);

    const read = () => readBinding(path, options);
    apply(read());
    addCleanup(subscribeBinding(path, () => {
      schedulerInstance.enqueue("binding", () => apply(read()), {
        scope: element,
        key
      });
    }), element);
  }

  function bindValueWriter(element, path) {
    bindEvent(element, "input", `__async:set:${path}`);
    bindEvent(element, "change", `__async:set:${path}`);
    if (!handlerRegistry.resolve(`__async:set:${path}`)) {
      handlerRegistry.register(`__async:set:${path}`, function writeValue({ element }) {
        writeBinding(path, element.value);
      });
    }
  }

  function readBinding(path, options = {}) {
    if (isInlineBinding(path)) {
      const value = inlineBindings.get(path);
      return options.rawInline ? value : resolveInlineValue(value);
    }
    return signalRegistry.get(path);
  }

  function writeBinding(path, value) {
    if (!isInlineBinding(path)) {
      return signalRegistry.set(path, value);
    }
    const binding = inlineBindings.get(path);
    if (isSignalRef(binding)) {
      return binding.set(value);
    }
    throw new Error(`Inline binding "${path}" is not writable.`);
  }

  function subscribeBinding(path, fn) {
    if (!isInlineBinding(path)) {
      return signalRegistry.subscribe(path, fn);
    }
    const cleanups = collectSignalRefs(inlineBindings.get(path)).map((ref) => ref.subscribe(fn));
    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  function bindBoundaries(scope, scanOptions) {
    for (const boundary of elementsIn(scope, scanOptions)) {
      if (renderingBoundaries.has(boundary)) {
        continue;
      }
      const id = boundaryIdFor(boundary, attributeConfig);
      if (id == null) {
        continue;
      }
      if (!boundaryState.has(boundary)) {
        const templates = collectBoundaryTemplates(boundary, id, attributeConfig);
        if (Object.keys(templates).length === 0 || !signalRegistry.has(id)) {
          continue;
        }
        const state = {
          id,
          templates,
          cleanup: signalRegistry.subscribe(`${id}.$status`, () => {
            schedulerInstance.enqueue("binding", () => renderBoundary(boundary), {
              scope: boundary,
              key: `boundary:${id}`
            });
          })
        };
        boundaryState.set(boundary, state);
        addCleanup(state.cleanup, boundary);
      }
      renderBoundary(boundary);
    }
  }

  function bindComponentAttributes(scope, scanOptions) {
    for (const element of elementsIn(scope, scanOptions)) {
      const id = readAttribute(element, attributeConfig, "async", "component");
      if (id == null) {
        continue;
      }
      if (componentBindings.has(element)) {
        continue;
      }
      if (!components?.resolve) {
        throw new Error(`Component "${id}" cannot be mounted because no component registry is available.`);
      }
      const Component = components.resolve(id);
      if (!Component) {
        throw new Error(`Component "${id}" was not found.`);
      }
      const props = componentHostProps(element, attributeConfig);
      componentBindings.add(element);
      try {
        api.mount(element, Component, props);
      } catch (error) {
        componentBindings.delete(element);
        throw error;
      }
    }
  }

  function renderBoundary(boundary) {
    const state = boundaryState.get(boundary);
    if (!state) {
      return;
    }
    const status = signalRegistry.get(`${state.id}.$status`);
    const template = chooseBoundaryTemplate(state.templates, status);
    if (!template) {
      return;
    }
    cleanupChildren(boundary);
    boundary.replaceChildren(template.content.cloneNode(true));
    renderingBoundaries.add(boundary);
    try {
      api.scan(boundary);
    } finally {
      renderingBoundaries.delete(boundary);
    }
  }

  function replaceBoundaryChildren(boundary, fragmentOrTemplate) {
    cleanupChildren(boundary);
    boundary.replaceChildren(toFragment(fragmentOrTemplate, documentRef, templateRenderOptions()));
    return [];
  }

  function morphChildren(boundary, fragment) {
    const scanRoots = new Set();
    morphChildList(boundary, [...fragment.childNodes], scanRoots);
    return [...scanRoots].filter((node) => node.isConnected !== false);
  }

  function morphChildList(parent, nextNodes, scanRoots) {
    let current = parent.firstChild;
    const keyedChildren = collectKeyedChildren(parent);
    const used = new WeakSet();

    for (const nextNode of nextNodes) {
      const keyed = keyedMatch(nextNode, keyedChildren, used);
      if (keyed && keyed !== current) {
        parent.insertBefore(keyed, current ?? null);
      }

      const oldNode = keyed ?? current;
      if (oldNode && canMorphNode(oldNode, nextNode)) {
        morphNode(oldNode, nextNode, scanRoots);
        used.add(oldNode);
        current = oldNode.nextSibling;
        continue;
      }

      parent.insertBefore(nextNode, current ?? null);
      addScanRoot(scanRoots, nextNode);
      if (current) {
        const removed = current;
        current = current.nextSibling;
        cleanupNode(removed);
        removed.remove();
      } else {
        current = nextNode.nextSibling;
      }
    }

    while (current) {
      const removed = current;
      current = current.nextSibling;
      cleanupNode(removed);
      removed.remove();
    }
  }

  function morphNode(current, next, scanRoots) {
    if (current.nodeType === 3 || current.nodeType === 8) {
      if (current.nodeValue !== next.nodeValue) {
        current.nodeValue = next.nodeValue;
      }
      return;
    }

    const attributes = syncElementAttributes(current, next);
    if (attributes.bindingsChanged) {
      resetElementBindings(current);
    }
    if (attributes.changed) {
      addScanRoot(scanRoots, current);
    }

    if (componentIdFor(current) != null) {
      return;
    }

    morphChildList(current, [...next.childNodes], scanRoots);
  }

  function syncElementAttributes(current, next) {
    let changed = false;
    let bindingsChanged = false;
    const currentNames = current.getAttributeNames?.() ?? [];
    const nextNames = next.getAttributeNames?.() ?? [];
    const nextNameSet = new Set(nextNames);

    for (const name of currentNames) {
      if (nextNameSet.has(name)) {
        continue;
      }
      if (isProtocolBindingAttribute(name)) {
        bindingsChanged = true;
      }
      changed = true;
      current.removeAttribute(name);
    }

    for (const name of nextNames) {
      const value = next.getAttribute(name);
      if (current.getAttribute(name) === value) {
        continue;
      }
      if (isProtocolBindingAttribute(name)) {
        bindingsChanged = true;
      }
      changed = true;
      current.removeAttribute(name);
      current.setAttribute(name, value);
    }

    return {
      changed,
      bindingsChanged
    };
  }

  function resetElementBindings(element) {
    runScopedCleanups(element, "self");
    eventBindings.delete(element);
    signalBindings.delete(element);
    mountedElements.delete(element);
    visibleElements.delete(element);
    intersectionBindings.delete(element);
    boundaryState.delete(element);
    schedulerInstance.markScopeDestroyed(element);
  }

  function scanChangedRoots(roots) {
    for (const root of roots) {
      scanScope(root);
    }
  }

  function addScanRoot(roots, node) {
    if (node?.nodeType === 1 || node?.nodeType === 11) {
      roots.add(node);
    }
  }

  function collectKeyedChildren(parent) {
    const keyed = new Map();
    for (const child of parent.childNodes ?? []) {
      const key = identityKeyFor(child);
      if (key != null && !keyed.has(key)) {
        keyed.set(key, child);
      }
    }
    return keyed;
  }

  function keyedMatch(nextNode, keyedChildren, used) {
    const key = identityKeyFor(nextNode);
    if (key == null) {
      return null;
    }
    const candidate = keyedChildren.get(key);
    if (!candidate || used.has(candidate)) {
      return null;
    }
    return canMorphNode(candidate, nextNode) ? candidate : null;
  }

  function canMorphNode(current, next) {
    if (!current || current.nodeType !== next.nodeType) {
      return false;
    }
    if (current.nodeType === 3 || current.nodeType === 8) {
      return true;
    }
    if (current.nodeType !== 1 || current.tagName !== next.tagName) {
      return false;
    }

    const currentKey = identityKeyFor(current);
    const nextKey = identityKeyFor(next);
    if (currentKey != null || nextKey != null) {
      return currentKey === nextKey;
    }

    const currentBoundary = boundaryIdFor(current, attributeConfig);
    const nextBoundary = boundaryIdFor(next, attributeConfig);
    if (currentBoundary != null || nextBoundary != null) {
      return currentBoundary === nextBoundary;
    }

    const currentComponent = componentIdFor(current);
    const nextComponent = componentIdFor(next);
    if (currentComponent != null || nextComponent != null) {
      return currentComponent === nextComponent;
    }

    return true;
  }

  function identityKeyFor(node) {
    if (node?.nodeType !== 1) {
      return null;
    }
    return readAttribute(node, attributeConfig, "async", "key")
      ?? node.getAttribute("data-key")
      ?? node.id
      ?? null;
  }

  function componentIdFor(element) {
    return readAttribute(element, attributeConfig, "async", "component");
  }

  function isProtocolBindingAttribute(name) {
    return matchAttribute(name, attributeConfig, "signal") != null
      || matchAttribute(name, attributeConfig, "class") != null
      || matchAttribute(name, attributeConfig, "on") != null
      || matchAttribute(name, attributeConfig, "intersect") != null
      || isAsyncBindingAttribute(name);
  }

  function isAsyncBindingAttribute(name) {
    const asyncName = matchAttribute(name, attributeConfig, "async");
    return asyncName != null && asyncName !== "key";
  }

  function runPseudoEvents(scope, scanOptions) {
    for (const element of elementsIn(scope, scanOptions)) {
      if (readAttribute(element, attributeConfig, "on", "mount") != null) {
        warnMountPseudoEventAlias();
      }
      const refs = readPseudoRefs(element, ["attach", "mount"]);
      if (refs.length === 0) {
        continue;
      }
      if (mountedElements.has(element)) {
        continue;
      }
      mountedElements.add(element);
      for (const ref of refs) {
        scheduleLifecycle(element, () => runPseudo(element, ref), `attach:${ref}`);
      }
    }

    for (const element of elementsIn(scope, scanOptions)) {
      const ref = readAttribute(element, attributeConfig, "on", "visible");
      if (ref == null) {
        continue;
      }
      if (visibleElements.has(element)) {
        continue;
      }
      visibleElements.add(element);
      addCleanup(observeVisible(element, () => scheduleLifecycle(element, () => runPseudo(element, ref), `visible:${ref}`)), element);
    }

    for (const element of elementsIn(scope, scanOptions)) {
      const ref = readAttribute(element, attributeConfig, "on", "intersect");
      if (ref == null) {
        continue;
      }
      const options = readIntersectionOptions(element);
      const key = `intersect:${ref}:${serializeIntersectionOptions(options)}`;
      const bound = intersectionBindings.get(element) ?? new Set();
      if (bound.has(key)) {
        continue;
      }
      bound.add(key);
      intersectionBindings.set(element, bound);
      addCleanup(observeIntersection(element, (event) => runPseudo(element, ref, event), {
        ...options,
        key
      }), element);
    }
  }

  function readPseudoRefs(element, names) {
    const refs = [];
    for (const name of names) {
      const ref = readAttribute(element, attributeConfig, "on", name);
      if (ref != null) {
        refs.push(ref);
      }
    }
    return refs;
  }

  function warnMountPseudoEventAlias() {
    if (mountPseudoEventWarned) {
      return;
    }
    mountPseudoEventWarned = true;
    console.warn?.('on:mount has been renamed to on:attach. The old name remains as a compatibility alias.');
  }

  async function runPseudo(element, ref, context = {}) {
    try {
      const results = await handlerRegistry.run(ref, {
        signals: signalRegistry,
        handlers: handlerRegistry,
        loader: api,
        server: api.server,
        router: api.router,
        cache: api.cache,
        scheduler: schedulerInstance,
        element,
        el: element,
        root: rootNode,
        ...context
      });
      for (const result of results) {
        if (typeof result === "function") {
          addCleanup(result, element);
        }
      }
    } catch (error) {
      dispatchAsyncError(element, error);
    }
  }

  function observeVisible(target, fn) {
    return observeIntersection(target, (event) => {
      if (event.isIntersecting) {
        fn(target);
      }
    }, {
      once: true,
      threshold: 0
    });
  }

  function observeIntersection(target, fn, options = {}) {
    if (typeof fn !== "function") {
      throw new TypeError("observeIntersection(target, fn) requires a callback.");
    }
    const normalized = normalizeIntersectionOptions(target, options);
    const ownerWindow = target.ownerDocument?.defaultView ?? globalThis;
    const Observer = ownerWindow.IntersectionObserver ?? globalThis.IntersectionObserver;
    if (!Observer) {
      let cleaned = false;
      const event = createIntersectionEvent({
        target,
        root: normalized.root,
        entry: createFallbackIntersectionEntry(target),
        observer: null,
        unsupported: true
      });
      const cancel = schedulerInstance.enqueue("lifecycle", () => {
        if (!cleaned && !destroyed) {
          fn(event);
        }
      }, {
        scope: normalized.scope,
        key: normalized.key ?? "intersect:fallback"
      });
      return () => {
        cleaned = true;
        cancel?.();
      };
    }

    let cleaned = false;
    let stopped = false;
    const observer = new Observer((entries) => {
      if (cleaned || stopped || destroyed) {
        return;
      }
      const observedEntries = entries.filter((entry) => entry.target === target);
      const targetEntries = observedEntries.length > 0 ? observedEntries : entries;
      const entry = targetEntries[0];
      if (!entry) {
        return;
      }
      const event = createIntersectionEvent({
        target,
        root: normalized.root,
        entry,
        entries: targetEntries,
        observer,
        unsupported: false
      });
      if (normalized.once && event.isIntersecting) {
        stopped = true;
        observer.disconnect();
      }
      runIntersectionCallback(fn, event, normalized, () => !cleaned);
    }, {
      root: normalized.root,
      rootMargin: normalized.rootMargin,
      threshold: normalized.threshold
    });
    observer.observe(target);
    return () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      stopped = true;
      observer.disconnect();
    };
  }

  function readIntersectionOptions(element) {
    const options = {};
    const threshold = readAttribute(element, attributeConfig, "intersect", "threshold");
    if (threshold != null) {
      options.threshold = parseIntersectionThreshold(threshold);
    }
    const rootMargin = readAttribute(element, attributeConfig, "intersect", "root-margin")
      ?? readAttribute(element, attributeConfig, "intersect", "rootMargin");
    if (rootMargin != null) {
      options.rootMargin = rootMargin;
    }
    const once = readAttribute(element, attributeConfig, "intersect", "once");
    if (once != null) {
      options.once = parseBooleanAttribute(once);
    }
    return options;
  }

  function parseIntersectionThreshold(value) {
    const parts = String(value).split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      throw new TypeError("intersect:threshold must include a number from 0 to 1.");
    }
    const thresholds = parts.map((part) => {
      const number = Number(part);
      return validateIntersectionThreshold(number);
    });
    return thresholds.length === 1 ? thresholds[0] : thresholds;
  }

  function parseBooleanAttribute(value) {
    const normalized = String(value).trim().toLowerCase();
    return normalized === "" || normalized === "true" || normalized === "1";
  }

  function serializeIntersectionOptions(options) {
    return JSON.stringify({
      rootMargin: options.rootMargin ?? "0px",
      threshold: options.threshold ?? 0,
      once: Boolean(options.once)
    });
  }

  function normalizeIntersectionOptions(target, options) {
    const ownerWindow = target?.ownerDocument?.defaultView ?? globalThis;
    if (!isElement(target, ownerWindow)) {
      throw new TypeError("Intersection target must be an Element.");
    }
    const root = options.root ?? null;
    if (root !== null && !isElement(root, ownerWindow) && !isDocument(root, ownerWindow)) {
      throw new TypeError("Intersection root must be an Element, Document, or null.");
    }
    const rootMargin = options.rootMargin ?? "0px";
    if (typeof rootMargin !== "string") {
      throw new TypeError("Intersection rootMargin must be a string.");
    }
    const threshold = normalizeIntersectionThreshold(options.threshold ?? 0);
    const schedule = options.schedule ?? "lifecycle";
    if (schedule !== "lifecycle" && schedule !== "sync") {
      throw new TypeError('Intersection schedule must be "lifecycle" or "sync".');
    }
    return {
      root,
      rootMargin,
      threshold,
      once: Boolean(options.once),
      schedule,
      scope: options.scope ?? target,
      key: options.key
    };
  }

  function normalizeIntersectionThreshold(threshold) {
    if (Array.isArray(threshold)) {
      return threshold.map(validateIntersectionThreshold);
    }
    return validateIntersectionThreshold(threshold);
  }

  function validateIntersectionThreshold(value) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new TypeError("Intersection threshold must be a number from 0 to 1.");
    }
    return value;
  }

  function runIntersectionCallback(fn, event, options, isActive = () => true) {
    if (options.schedule === "sync") {
      if (isActive()) {
        fn(event);
      }
      return;
    }
    schedulerInstance.enqueue("lifecycle", () => {
      if (!destroyed && isActive()) {
        fn(event);
      }
    }, {
      scope: options.scope,
      key: options.key
    });
  }

  function createIntersectionEvent({ target, root, entry, entries = [entry], observer, unsupported }) {
    const isIntersecting = Boolean(entry?.isIntersecting);
    const intersectionRatio = typeof entry?.intersectionRatio === "number"
      ? entry.intersectionRatio
      : (isIntersecting ? 1 : 0);
    return {
      target,
      element: target,
      el: target,
      root: root ?? rootNode,
      entry,
      entries,
      observer,
      isIntersecting,
      intersectionRatio,
      unsupported: Boolean(unsupported)
    };
  }

  function createFallbackIntersectionEntry(target) {
    const rect = target.getBoundingClientRect?.() ?? null;
    return {
      target,
      isIntersecting: true,
      intersectionRatio: 1,
      time: 0,
      rootBounds: null,
      boundingClientRect: rect,
      intersectionRect: rect
    };
  }

  function resolveFragmentTarget(target, marker) {
    if (!target || typeof marker !== "string" || marker.length === 0) {
      return target;
    }
    const bounds = findFragmentBounds(target, marker);
    if (!bounds || bounds.start.parentNode !== bounds.end.parentNode) {
      return target;
    }
    return singleElementRootBetween(bounds.start, bounds.end)
      ?? containingElementFor(bounds.start)
      ?? target;
  }

  function findFragmentBounds(target, marker) {
    const startData = `async:${marker}:start`;
    const endData = `async:${marker}:end`;
    let start = null;
    const comments = commentNodesIn(target);
    for (const comment of comments) {
      if (!start) {
        if (comment.data === startData) {
          start = comment;
        }
        continue;
      }
      if (comment.data === endData) {
        return { start, end: comment };
      }
    }
    return null;
  }

  function commentNodesIn(target) {
    const comments = [];
    if (target.nodeType === 8) {
      comments.push(target);
    }
    const walker = documentRef.createTreeWalker?.(target, 128);
    if (walker) {
      let current = walker.nextNode();
      while (current) {
        comments.push(current);
        current = walker.nextNode();
      }
      return comments;
    }
    collectCommentNodes(target, comments);
    return comments;
  }

  function collectCommentNodes(node, comments) {
    for (const child of node.childNodes ?? []) {
      if (child.nodeType === 8) {
        comments.push(child);
      }
      collectCommentNodes(child, comments);
    }
  }

  function singleElementRootBetween(start, end) {
    let root = null;
    for (let node = start.nextSibling; node && node !== end; node = node.nextSibling) {
      if (node.nodeType === 1) {
        if (root) {
          return null;
        }
        root = node;
        continue;
      }
      if (node.nodeType === 3 && node.textContent.trim().length > 0) {
        return null;
      }
      if (node.nodeType !== 3 && node.nodeType !== 8) {
        return null;
      }
    }
    return root;
  }

  function containingElementFor(node) {
    if (node.parentElement) {
      return node.parentElement;
    }
    return node.parentNode?.nodeType === 1 ? node.parentNode : null;
  }

  function isElement(value, ownerWindow = globalThis) {
    const ElementRef = ownerWindow.Element ?? globalThis.Element;
    return Boolean(ElementRef && value instanceof ElementRef);
  }

  function isDocument(value, ownerWindow = globalThis) {
    const DocumentRef = ownerWindow.Document ?? globalThis.Document;
    return Boolean(DocumentRef && value instanceof DocumentRef);
  }

  function assertActive() {
    if (destroyed) {
      throw new Error("Loader has been destroyed.");
    }
  }

  function addCleanup(cleanup, owner, mode = "self") {
    if (typeof cleanup !== "function") {
      return cleanup;
    }
    cleanups.add(cleanup);
    if (owner) {
      const records = scopedCleanups.get(owner) ?? [];
      records.push({ cleanup, mode });
      scopedCleanups.set(owner, records);
    }
    return cleanup;
  }

  function runCleanup(cleanup) {
    if (typeof cleanup !== "function" || !cleanups.has(cleanup)) {
      return;
    }
    cleanups.delete(cleanup);
    cleanup();
  }

  function cleanupChildren(container) {
    runScopedCleanups(container, "children");
    for (const child of [...(container.childNodes ?? [])]) {
      cleanupNode(child);
    }
  }

  function cleanupNode(node) {
    if (node.nodeType !== 1) {
      return;
    }
    for (const element of elementsIn(node)) {
      runScopedCleanups(element);
      schedulerInstance.markScopeDestroyed(element);
    }
  }

  function runScopedCleanups(element, mode) {
    const records = scopedCleanups.get(element);
    if (!records) {
      return;
    }
    const remaining = [];
    for (const record of records) {
      if (mode && record.mode !== mode) {
        remaining.push(record);
        continue;
      }
      runCleanup(record.cleanup);
    }
    if (remaining.length > 0) {
      scopedCleanups.set(element, remaining);
    } else {
      scopedCleanups.delete(element);
    }
  }

  function scheduleLifecycle(element, fn, key) {
    schedulerInstance.enqueue("lifecycle", fn, {
      scope: element,
      key
    });
  }

  function markDestroyedScopes(scope) {
    for (const element of elementsIn(scope)) {
      schedulerInstance.markScopeDestroyed(element);
    }
  }

  function reviveScopes(scope, scanOptions) {
    for (const element of elementsIn(scope, scanOptions)) {
      schedulerInstance.reviveScope?.(element);
    }
  }

  return api;
}

export const AsyncLoader = Loader;

function normalizeClassTokens(value, tokens = new Set()) {
  if (value == null || value === false) {
    return tokens;
  }
  if (isSignalRef(value)) {
    const signalValue = value.value;
    if (signalValue === true) {
      tokens.add(signalClassName(value.id));
      return tokens;
    }
    return normalizeClassTokens(signalValue, tokens);
  }
  if (typeof value === "string") {
    for (const token of value.split(/\s+/).filter(Boolean)) {
      tokens.add(token);
    }
    return tokens;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      normalizeClassTokens(item, tokens);
    }
    return tokens;
  }
  if (typeof value === "object") {
    for (const [token, enabled] of Object.entries(value)) {
      const value = isSignalRef(enabled) ? enabled.value : enabled;
      if (value) {
        normalizeClassTokens(token, tokens);
      }
    }
    return tokens;
  }
  if (value !== true) {
    tokens.add(String(value));
  }
  return tokens;
}

function resolveInlineValue(value) {
  if (isSignalRef(value)) {
    return value.value;
  }
  if (Array.isArray(value)) {
    return value.map(resolveInlineValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, resolveInlineValue(entry)]));
  }
  return value;
}

function collectSignalRefs(value, refs = new Map()) {
  if (isSignalRef(value)) {
    refs.set(value.id, value);
    return [...refs.values()];
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSignalRefs(item, refs);
    }
    return [...refs.values()];
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectSignalRefs(item, refs);
    }
  }
  return [...refs.values()];
}

function isInlineBinding(value) {
  return typeof value === "string" && value.startsWith(inlineBindingPrefix);
}

function signalClassName(id) {
  return id.split(".").at(-1);
}

function updateClassToken(element, className, enabled) {
  const tokens = readClassTokens(element);
  for (const token of normalizeClassTokens(className)) {
    if (enabled) {
      tokens.add(token);
    } else {
      tokens.delete(token);
    }
  }
  writeClassTokens(element, tokens);
}

function readClassTokens(element) {
  return normalizeClassTokens(element.getAttribute("class") ?? "");
}

function writeClassTokens(element, tokens) {
  const value = [...tokens].join(" ");
  if (value.length === 0) {
    element.removeAttribute("class");
    return;
  }
  element.setAttribute("class", value);
}

function collectBoundaryTemplates(boundary, id, attributeConfig) {
  const templates = {};
  for (const template of [...boundary.children].filter((child) => child.tagName === "TEMPLATE")) {
    if (templateMatchesState(template, "loading", id, boundary, attributeConfig)) {
      templates.loading = template;
    }
    if (templateMatchesState(template, "ready", id, boundary, attributeConfig)) {
      templates.ready = template;
    }
    if (templateMatchesState(template, "error", id, boundary, attributeConfig)) {
      templates.error = template;
    }
  }
  return templates;
}

function templateMatchesState(template, state, id, boundary, attributeConfig) {
  if (readAttribute(template, attributeConfig, "async", state) === id) {
    return true;
  }
  return isAsyncSuspense(boundary) && template.hasAttribute?.(state);
}

function chooseBoundaryTemplate(templates, status) {
  if (status === "ready") {
    return templates.ready ?? templates.loading ?? templates.error;
  }
  if (status === "error") {
    return templates.error ?? templates.ready ?? templates.loading;
  }
  return templates.loading ?? templates.ready ?? templates.error;
}

function updateAttribute(element, attr, value) {
  if (value === false || value == null) {
    element.removeAttribute(attr);
    if (attr in element) {
      element[attr] = false;
    }
    return;
  }
  element.setAttribute(attr, value === true ? "" : String(value));
  if (attr in element) {
    element[attr] = value;
  }
}

function componentHostProps(element, attributeConfig) {
  const childrenTemplates = [];
  for (const child of [...element.children]) {
    const isChildren = readAttribute(child, attributeConfig, "async", "children") != null;
    if (!isChildren) {
      continue;
    }
    if (child.tagName !== "TEMPLATE") {
      throw new Error("async:children must be placed on a direct child <template> of an async:component host.");
    }
    childrenTemplates.push(child);
  }
  if (childrenTemplates.length > 1) {
    throw new Error("async:component hosts can have only one direct child <template async:children>.");
  }
  if (childrenTemplates.length === 0) {
    return {};
  }
  const html = childrenTemplates[0].innerHTML;
  return {
    children: childrenFragment(() => rawHtml(html))
  };
}

function updateProperty(element, prop, value) {
  if (value == null) {
    element[prop] = "";
    return;
  }
  element[prop] = value;
}

function selectAll(scope, selector, options = {}) {
  const elements = [];
  if (options.includeRoot !== false && scope?.nodeType === 1 && scope.matches?.(selector)) {
    elements.push(scope);
  }
  elements.push(...(scope?.querySelectorAll?.(selector) ?? []));
  return elements;
}

function elementsIn(scope, options) {
  return selectAll(scope, "*", options);
}

function findBoundary(root, boundaryId, attributeConfig) {
  for (const element of elementsIn(root)) {
    if (boundaryIdFor(element, attributeConfig) === String(boundaryId)) {
      return element;
    }
  }
  return null;
}

function boundaryIdFor(element, attributeConfig) {
  if (isAsyncSuspense(element) && element.hasAttribute?.("for")) {
    return element.getAttribute("for");
  }
  return readAttribute(element, attributeConfig, "async", "boundary");
}

function isAsyncSuspense(element) {
  return element?.tagName === "ASYNC-SUSPENSE";
}

function toFragment(value, documentRef, renderOptions = {}) {
  if (value?.nodeType === 11) {
    return value;
  }
  if (value?.tagName === "TEMPLATE") {
    return value.content.cloneNode(true);
  }
  if (value?.nodeType) {
    const fragment = documentRef.createDocumentFragment();
    fragment.append(value);
    return fragment;
  }
  const template = documentRef.createElement("template");
  template.innerHTML = renderSwapHtml(value, renderOptions);
  return template.content.cloneNode(true);
}

function snapshotSwapValue(value, documentRef, renderOptions = {}) {
  if (value?.nodeType === 11) {
    return [...(value.childNodes ?? [])].map((node) => serializeNode(node)).join("");
  }
  if (value?.tagName === "TEMPLATE") {
    return value.innerHTML;
  }
  if (value?.nodeType) {
    return serializeNode(value);
  }
  return renderSwapHtml(value, renderOptions);
}

function renderSwapHtml(value, renderOptions = {}) {
  if (typeof value === "string") {
    return value;
  }
  if (isTemplateResult(value)) {
    return renderTemplate(value, renderOptions);
  }
  return renderTemplate(value, renderOptions);
}

function serializeNode(node) {
  if (node?.nodeType === 1) {
    return node.outerHTML;
  }
  if (node?.nodeType === 3 || node?.nodeType === 8) {
    return node.textContent ?? "";
  }
  if (node?.nodeType === 11) {
    return [...(node.childNodes ?? [])].map((child) => serializeNode(child)).join("");
  }
  return null;
}

function normalizeSwapOptions(options = {}) {
  const normalized = options ?? {};
  if (typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new TypeError("Loader swap options must be an object.");
  }
  const scan = normalized.scan ?? "auto";
  if (scan !== "auto" && scan !== "full" && scan !== "none") {
    throw new TypeError('Loader swap scan option must be "auto", "full", or "none".');
  }
  const strategy = normalized.strategy ?? "replace";
  if (strategy !== "replace" && strategy !== "morph") {
    throw new TypeError('Loader swap strategy option must be "replace" or "morph".');
  }
  return {
    scan,
    strategy
  };
}

function normalizeSwapManyOptions(options = {}) {
  const normalized = options ?? {};
  if (typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new TypeError('loader.swap({ type: "many" }) options must be an object.');
  }
  const scan = normalized.scan ?? "auto";
  if (scan !== "auto" && scan !== "full" && scan !== "none" && scan !== "once") {
    throw new TypeError('loader.swap({ type: "many" }) scan option must be "auto", "full", "none", or "once".');
  }
  const strategy = normalized.strategy ?? "replace";
  if (strategy !== "replace" && strategy !== "morph") {
    throw new TypeError('Loader swap strategy option must be "replace" or "morph".');
  }
  return {
    scan,
    strategy
  };
}

function normalizeSwapManyEntries(updates) {
  if (!updates) {
    return [];
  }
  if (updates instanceof Map) {
    return [...updates.entries()];
  }
  if (typeof updates[Symbol.iterator] === "function" && !Array.isArray(updates)) {
    return [...updates];
  }
  if (Array.isArray(updates)) {
    return updates;
  }
  if (typeof updates === "object") {
    return Object.entries(updates);
  }
  throw new TypeError('loader.swap({ type: "many", updates }) requires an object, Map, or iterable of [boundaryId, html] entries.');
}

function isSwapConfig(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !value.nodeType &&
      (Object.hasOwn(value, "type") ||
        Object.hasOwn(value, "boundary") ||
        Object.hasOwn(value, "boundaryId") ||
        Object.hasOwn(value, "updates") ||
        Object.hasOwn(value, "html") ||
        Object.hasOwn(value, "render") ||
        Object.hasOwn(value, "ifChanged"))
  );
}

function normalizeSwapConfigType(config) {
  const type = config.type ??
    (Object.hasOwn(config, "updates")
      ? "many"
      : config.ifChanged
        ? "ifChanged"
        : "replace");
  if (type === "replace" || type === "ifChanged" || type === "many" || type === "bind") {
    return type;
  }
  throw new TypeError('loader.swap({ type }) must be "replace", "ifChanged", "many", or "bind".');
}

function boundaryIdFromSwapConfig(config) {
  const boundaryId = config.boundaryId ?? config.boundary;
  if (typeof boundaryId !== "string" || boundaryId.length === 0) {
    throw new TypeError("loader.swap({ boundary, ... }) requires a non-empty boundary string.");
  }
  return boundaryId;
}

function valueFromSwapConfig(config, type) {
  if (Object.hasOwn(config, "html")) {
    return config.html;
  }
  if (type === "ifChanged" && Object.hasOwn(config, "render")) {
    return config.render;
  }
  throw new TypeError('loader.swap({ html }) requires an "html" value.');
}

function dispatchAsyncError(element, error) {
  const EventCtor = element.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  element.dispatchEvent(
    new EventCtor("async:error", {
      bubbles: true,
      detail: { error }
    })
  );
}
