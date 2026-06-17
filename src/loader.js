import { renderComponent } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { createSignalRegistry } from "./signals.js";
import { matchAttribute, normalizeAttributeConfig, readAttribute } from "./attributes.js";

export function AsyncLoader({ root, signals, handlers, server, router, cache, attributes } = {}) {
  const documentRef = root?.ownerDocument ?? root ?? globalThis.document;
  const rootNode = root ?? documentRef;
  const signalRegistry = signals ?? createSignalRegistry();
  const handlerRegistry = handlers ?? createHandlerRegistry();
  const attributeConfig = normalizeAttributeConfig(attributes);
  const cleanups = new Set();
  const eventBindings = new WeakMap();
  const signalBindings = new WeakMap();
  const mountedElements = new WeakSet();
  const visibleElements = new WeakSet();
  const boundaryState = new WeakMap();
  const renderingBoundaries = new WeakSet();
  let destroyed = false;

  const api = {
    root: rootNode,
    signals: signalRegistry,
    handlers: handlerRegistry,
    server,
    router,
    cache,
    attributes: attributeConfig,

    start() {
      assertActive();
      api.scan(rootNode);
      return api;
    },

    scan(rootOrFragment = rootNode) {
      assertActive();
      bindSignalAttributes(rootOrFragment);
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
        attributes: attributeConfig
      });
      target.replaceChildren(toFragment(rendered.html, target.ownerDocument));
      api.scan(target);
      rendered.mount(target);
      rendered.visible(target, api._observeVisible);
      cleanups.add(rendered.cleanup);
      return rendered;
    },

    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const cleanup of [...cleanups]) {
        cleanup();
      }
      cleanups.clear();
    },

    _observeVisible(target, fn) {
      return observeVisible(target, fn);
    }
  };

  signalRegistry._setContext?.({ server: api.server, router: api.router, loader: api, cache: api.cache });

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
        if (eventName === "mount" || eventName === "visible") {
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
        await handlerRegistry.run(ref, {
          signals: signalRegistry,
          handlers: handlerRegistry,
          loader: api,
          server: api.server,
          router: api.router,
          cache: api.cache,
          event,
          element,
          el: element,
          root: rootNode
        });
      } catch (error) {
        dispatchAsyncError(element, error);
      }
    };

    element.addEventListener(eventName, listener);
    cleanups.add(() => element.removeEventListener(eventName, listener));
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
        if (signalName.startsWith("class:")) {
          const className = signalName.slice("class:".length);
          const path = element.getAttribute(name);
          bindSignal(element, `class:${className}:${path}`, path, (value) => {
            element.classList.toggle(className, Boolean(value));
          });
        }
      }
    }
  }

  function bindSignal(element, key, path, apply) {
    const bound = signalBindings.get(element) ?? new Set();
    if (bound.has(key)) {
      return;
    }
    bound.add(key);
    signalBindings.set(element, bound);

    apply(signalRegistry.get(path));
    cleanups.add(signalRegistry.subscribe(path, apply));
  }

  function bindValueWriter(element, path) {
    bindEvent(element, "input", `__async:set:${path}`);
    bindEvent(element, "change", `__async:set:${path}`);
    if (!handlerRegistry.resolve(`__async:set:${path}`)) {
      handlerRegistry.register(`__async:set:${path}`, function writeValue({ element }) {
        signalRegistry.set(path, element.value);
      });
    }
  }

  function bindBoundaries(scope) {
    for (const boundary of elementsIn(scope)) {
      if (renderingBoundaries.has(boundary)) {
        continue;
      }
      const id = readAttribute(boundary, attributeConfig, "async", "boundary");
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
          cleanup: signalRegistry.subscribe(`${id}.$status`, () => renderBoundary(boundary))
        };
        boundaryState.set(boundary, state);
        cleanups.add(state.cleanup);
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
      const ref = readAttribute(element, attributeConfig, "on", "mount");
      if (ref == null) {
        continue;
      }
      if (mountedElements.has(element)) {
        continue;
      }
      mountedElements.add(element);
      runPseudo(element, ref);
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
      cleanups.add(observeVisible(element, () => runPseudo(element, ref)));
    }
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
        element,
        el: element,
        root: rootNode
      });
      for (const result of results) {
        if (typeof result === "function") {
          cleanups.add(result);
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
      queueMicrotask(() => {
        if (!destroyed) {
          fn(target);
        }
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
      throw new Error("AsyncLoader has been destroyed.");
    }
  }

  return api;
}

function collectBoundaryTemplates(boundary, id, attributeConfig) {
  const templates = {};
  for (const template of [...boundary.children].filter((child) => child.tagName === "TEMPLATE")) {
    if (readAttribute(template, attributeConfig, "async", "loading") === id) {
      templates.loading = template;
    }
    if (readAttribute(template, attributeConfig, "async", "ready") === id) {
      templates.ready = template;
    }
    if (readAttribute(template, attributeConfig, "async", "error") === id) {
      templates.error = template;
    }
  }
  return templates;
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
    if (readAttribute(element, attributeConfig, "async", "boundary") === String(boundaryId)) {
      return element;
    }
  }
  return null;
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
