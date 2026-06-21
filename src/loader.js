import { renderComponent } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { childrenFragment, rawHtml } from "./html.js";
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
  const renderingBoundaries = new WeakSet();
  const componentBindings = new WeakSet();
  const inlineBindings = new Map();
  const scopedCleanups = new WeakMap();
  let inlineBindingCounter = 0;
  let destroyed = false;

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
      reviveScopes(rootOrFragment);
      bindSignalAttributes(rootOrFragment);
      bindClassAttributes(rootOrFragment);
      bindEventAttributes(rootOrFragment);
      bindBoundaries(rootOrFragment);
      bindComponentAttributes(rootOrFragment);
      runPseudoEvents(rootOrFragment);
      return api;
    },

    swap(boundaryId, fragmentOrTemplate) {
      assertActive();
      const boundary = findBoundary(rootNode, boundaryId, attributeConfig);
      if (!boundary) {
        throw new Error(`Boundary "${boundaryId}" was not found.`);
      }
      cleanupChildren(boundary);
      boundary.replaceChildren(toFragment(fragmentOrTemplate, documentRef));
      api.scan(boundary);
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

  function bindEventAttributes(scope) {
    for (const element of elementsIn(scope)) {
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

  function bindSignalAttributes(scope) {
    for (const element of elementsIn(scope)) {
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

  function bindClassAttributes(scope) {
    for (const element of elementsIn(scope)) {
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

  function bindBoundaries(scope) {
    for (const boundary of elementsIn(scope)) {
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

  function bindComponentAttributes(scope) {
    for (const element of elementsIn(scope)) {
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

  function runPseudoEvents(scope) {
    for (const element of elementsIn(scope)) {
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

    for (const element of elementsIn(scope)) {
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

    for (const element of elementsIn(scope)) {
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

  function reviveScopes(scope) {
    for (const element of elementsIn(scope)) {
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

function selectAll(scope, selector) {
  const elements = [];
  if (scope?.nodeType === 1 && scope.matches?.(selector)) {
    elements.push(scope);
  }
  elements.push(...(scope?.querySelectorAll?.(selector) ?? []));
  return elements;
}

function elementsIn(scope) {
  return selectAll(scope, "*");
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

function toFragment(value, documentRef) {
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
  template.innerHTML = String(value ?? "");
  return template.content.cloneNode(true);
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
