import { renderComponent } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { createScheduler } from "./scheduler.js";
import { createSignalRegistry, isSignalRef } from "./signals.js";
import { matchAttribute, normalizeAttributeConfig, readAttribute } from "./attributes.js";

const inlineBindingPrefix = "__async:inline:";

export function Loader({ root, signals, handlers, server, router, cache, attributes, scheduler } = {}) {
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
  const boundaryState = new WeakMap();
  const renderingBoundaries = new WeakSet();
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
    scheduler: schedulerInstance,
    attributes: attributeConfig,

    start() {
      assertActive();
      api.scan(rootNode);
      return api;
    },

    scan(rootOrFragment = rootNode) {
      assertActive();
      bindSignalAttributes(rootOrFragment);
      bindClassAttributes(rootOrFragment);
      bindEventAttributes(rootOrFragment);
      bindBoundaries(rootOrFragment);
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
        scheduler: schedulerInstance,
        attributes: attributeConfig
      });
      cleanupChildren(target);
      target.replaceChildren(toFragment(rendered.html, target.ownerDocument));
      api.scan(target);
      rendered.mount(target);
      rendered.visible(target, api._observeVisible);
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
        if (eventName === "attach" || eventName === "mount" || eventName === "visible") {
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

  async function runPseudo(element, ref) {
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
        root: rootNode
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
    const ownerWindow = target.ownerDocument?.defaultView ?? globalThis;
    const Observer = ownerWindow.IntersectionObserver ?? globalThis.IntersectionObserver;
    if (!Observer) {
      schedulerInstance.enqueue("lifecycle", () => {
        if (!destroyed) {
          fn(target);
        }
      }, {
        scope: target,
        key: "visible:fallback"
      });
      return () => {};
    }

    const observer = new Observer((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        fn(target);
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
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
