import { attributeName } from "./attributes.js";
import { escapeHtml, rawHtml, renderTemplate } from "./html.js";
import { attachRegistryInspection, createRegistryStore } from "./registry-store.js";

const componentKind = Symbol.for("@async/framework.component");
let componentCounter = 0;

export function defineComponent(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("defineComponent(fn) requires a function.");
  }
  Object.defineProperty(fn, componentKind, {
    configurable: true,
    value: true
  });
  return fn;
}

export const component = defineComponent;

export function createComponentRegistry(initialMap = {}, options = {}) {
  const registryStore = options.registry ?? createRegistryStore();
  const type = options.type ?? "component";
  const entries = registryStore._map(type);

  const registry = attachRegistryInspection({
    register(id, Component) {
      if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Component id must be a non-empty string.");
      }
      if (!isComponent(Component) && typeof Component !== "function") {
        throw new TypeError(`Component "${id}" must be a component function.`);
      }
      if (entries.has(id)) {
        throw new Error(`Component "${id}" is already registered.`);
      }
      entries.set(id, Component);
      return id;
    },

    registerMany(map) {
      for (const [id, Component] of Object.entries(map ?? {})) {
        registry.register(id, Component);
      }
      return registry;
    },

    unregister(id) {
      if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Component id must be a non-empty string.");
      }
      return entries.delete(id);
    },

    resolve(id) {
      if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Component id must be a non-empty string.");
      }
      return entries.get(id);
    },

    _adoptMany() {
      return registry;
    }
  }, registryStore, type);

  registry.registerMany(initialMap);
  return registry;
}

export function isComponent(value) {
  return Boolean(value?.[componentKind]);
}

export function renderComponent(Component, props = {}, runtime, parentScope = "component") {
  if (!isComponent(Component) && typeof Component !== "function") {
    throw new TypeError("renderComponent(Component) requires a component function.");
  }

  const scope = `${parentScope}.${componentName(Component)}.${++componentCounter}`;
  const cleanups = [];
  const attachHooks = [];
  const visibleHooks = [];
  const destroyHooks = [];
  const bindingIds = [];
  const templateOptions = {
    attributes: runtime.attributes,
    signals: runtime.signals,
    bind(value) {
      const id = runtime.loader?._registerBinding?.(value);
      if (!id) {
        throw new Error("Inline template bindings require a Loader.");
      }
      bindingIds.push(id);
      return id;
    }
  };
  const renderScopedTemplate = (value) => renderTemplate(value, templateOptions);
  const context = createComponentContext({
    runtime,
    scope,
    cleanups,
    attachHooks,
    visibleHooks,
    destroyHooks,
    renderScopedTemplate
  });

  const output = Component.call(context, props);
  const html = renderScopedTemplate(output);

  return {
    html,
    attach(target) {
      for (const hook of attachHooks) {
        runtime.scheduler?.enqueue("lifecycle", () => {
          const cleanup = hook(target);
          if (typeof cleanup === "function") {
            cleanups.push(cleanup);
          }
        }, {
          scope,
          key: `attach:${attachHooks.indexOf(hook)}`
        }) ?? runAttachHook(hook, target);
      }
    },
    mount(target) {
      this.attach(target);
    },
    visible(target, observeVisible) {
      for (const hook of visibleHooks) {
        const cleanup = observeVisible(target, () => {
          runtime.scheduler?.enqueue("lifecycle", () => {
            const hookCleanup = hook(target);
            if (typeof hookCleanup === "function") {
              cleanups.push(hookCleanup);
            }
          }, {
            scope,
            key: `visible:${visibleHooks.indexOf(hook)}`
          }) ?? runVisibleHook(hook, target);
        });
        if (typeof cleanup === "function") {
          cleanups.push(cleanup);
        }
      }
    },
    cleanup() {
      while (destroyHooks.length > 0) {
        destroyHooks.pop()?.();
      }
      runtime.scheduler?.markScopeDestroyed(scope);
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
      while (bindingIds.length > 0) {
        runtime.loader?._releaseBinding?.(bindingIds.pop());
      }
    }
  };

  function runAttachHook(hook, target) {
    const cleanup = hook(target);
    if (typeof cleanup === "function") {
      cleanups.push(cleanup);
    }
  }

  function runVisibleHook(hook, target) {
    const cleanup = hook(target);
    if (typeof cleanup === "function") {
      cleanups.push(cleanup);
    }
  }
}

function createComponentContext({ runtime, scope, cleanups, attachHooks, visibleHooks, destroyHooks, renderScopedTemplate }) {
  const { signals, handlers, loader, server, router, cache, scheduler } = runtime;
  const generatedHandlers = new WeakMap();
  let generatedHandlerCounter = 0;
  let generatedSignalCounter = 0;
  const context = {
    scope,
    signals,
    handlers,
    loader,
    server,
    router,
    cache,
    scheduler,

    signal(name, initial) {
      if (arguments.length === 1) {
        const id = scoped(scope, `signal.${++generatedSignalCounter}`);
        const ref = signals.ensure(id, name);
        cleanups.push(() => signals.unregister?.(id));
        return ref;
      }
      const id = scoped(scope, name);
      const created = !signals.has(id);
      const ref = signals.ensure(id, initial);
      if (created) {
        cleanups.push(() => signals.unregister?.(id));
      }
      return ref;
    },

    computed(name, fn) {
      const id = scoped(scope, name);
      const created = !signals.has(id);
      const ref = signals.ensure(id, undefined);
      if (created) {
        cleanups.push(() => signals.unregister?.(id));
      }
      const cleanup = signals.effect(() => {
        signals.set(id, fn.call(context));
      });
      cleanups.push(cleanup);
      return ref;
    },

    asyncSignal(name, fn) {
      const id = scoped(scope, name);
      const created = !signals.has(id);
      if (!signals.has(id)) {
        signals.asyncSignal(id, fn);
      }
      if (created) {
        cleanups.push(() => signals.unregister?.(id));
      }
      return signals.ref(id);
    },

    effect(fn) {
      const cleanup = signals.effect(() => fn.call(context), {
        scheduler,
        phase: "effect",
        scope
      });
      cleanups.push(cleanup);
      return cleanup;
    },

    handler(name, fn) {
      if (typeof name === "function" && fn === undefined) {
        const inlineFn = name;
        if (generatedHandlers.has(inlineFn)) {
          return generatedHandlers.get(inlineFn);
        }
        const id = registerScopedHandler(`handler.${++generatedHandlerCounter}`, inlineFn);
        generatedHandlers.set(inlineFn, id);
        return id;
      }
      if (typeof fn !== "function") {
        throw new TypeError("this.handler(name, fn) or this.handler(fn) requires a function.");
      }
      return registerScopedHandler(name, fn);
    },

    render(Child, childProps = {}) {
      const child = renderComponent(Child, childProps, runtime, scope);
      cleanups.push(child.cleanup);
      attachHooks.push((target) => child.attach(target));
      visibleHooks.push((target) => child.visible(target, loader._observeVisible));
      return rawHtml(child.html);
    },

    suspense(signalRef, views) {
      const id = signalRef?.id;
      if (!id) {
        throw new TypeError("this.suspense(signalRef, views) requires a signal ref.");
      }

      const normalized = normalizeSuspenseViews(views);
      const chunks = [];
      for (const state of ["loading", "ready", "error"]) {
        const view = normalized[state];
        if (!view) {
          continue;
        }
        const attr = attributeName(runtime.attributes, "async", state);
        const body = renderScopedTemplate(view.call(context, signalRef));
        chunks.push(`<template ${attr}="${escapeHtml(id)}">${body}</template>`);
      }
      return rawHtml(chunks.join(""));
    },

    on(eventName, fn) {
      if (typeof eventName !== "string" || eventName.length === 0) {
        throw new TypeError("Component lifecycle event must be a non-empty string.");
      }
      if (typeof fn !== "function") {
        throw new TypeError(`Component lifecycle "${eventName}" requires a function.`);
      }
      const event = eventName === "mount" ? "attach" : eventName;
      if (event === "attach") {
        attachHooks.push((target) => fn.call(context, target));
        return;
      }
      if (event === "visible") {
        visibleHooks.push((target) => fn.call(context, target));
        return;
      }
      if (event === "destroy") {
        destroyHooks.push(() => fn.call(context));
        return;
      }
      throw new Error(`Unsupported component lifecycle event "${eventName}".`);
    },

    onMount(fn) {
      context.on("attach", fn);
    },

    onVisible(fn) {
      context.on("visible", fn);
    }
  };

  return context;

  function registerScopedHandler(name, fn) {
    const id = scoped(scope, name);
    handlers.register(id, function runComponentHandler(handlerContext) {
      return fn.call({ ...context, ...handlerContext }, handlerContext);
    });
    cleanups.push(() => handlers.unregister?.(id));
    return id;
  }
}

function scoped(scope, name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("Scoped signal or handler name must be a non-empty string.");
  }
  return `${scope}.${name}`;
}

function normalizeSuspenseViews(views) {
  const normalized = typeof views === "function" ? { ready: views } : views;
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) {
    throw new TypeError("this.suspense(signalRef, views) requires views to be a function or object.");
  }

  for (const state of ["loading", "ready", "error"]) {
    if (Object.hasOwn(normalized, state) && normalized[state] !== undefined && typeof normalized[state] !== "function") {
      throw new TypeError(`this.suspense(signalRef, views) view "${state}" must be a function.`);
    }
  }

  return normalized;
}

function componentName(Component) {
  return Component.displayName || Component.name || "anonymous";
}
