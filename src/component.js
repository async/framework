import { rawHtml, renderTemplate } from "./html.js";

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

export function createComponentRegistry(initialMap = {}) {
  const entries = new Map();

  const registry = {
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

    resolve(id) {
      if (typeof id !== "string" || id.length === 0) {
        throw new TypeError("Component id must be a non-empty string.");
      }
      return entries.get(id);
    }
  };

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
  const mountHooks = [];
  const visibleHooks = [];
  const context = createComponentContext({
    runtime,
    scope,
    cleanups,
    mountHooks,
    visibleHooks
  });

  const output = Component.call(context, props);
  const html = renderTemplate(output);

  return {
    html,
    mount(target) {
      for (const hook of mountHooks) {
        const cleanup = hook(target);
        if (typeof cleanup === "function") {
          cleanups.push(cleanup);
        }
      }
    },
    visible(target, observeVisible) {
      for (const hook of visibleHooks) {
        const cleanup = observeVisible(target, hook);
        if (typeof cleanup === "function") {
          cleanups.push(cleanup);
        }
      }
    },
    cleanup() {
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
    }
  };
}

function createComponentContext({ runtime, scope, cleanups, mountHooks, visibleHooks }) {
  const { signals, handlers, loader, server, router, cache } = runtime;
  const context = {
    scope,
    signals,
    handlers,
    loader,
    server,
    router,
    cache,

    signal(name, initial) {
      return signals.ensure(scoped(scope, name), initial);
    },

    computed(name, fn) {
      const id = scoped(scope, name);
      const ref = signals.ensure(id, undefined);
      const cleanup = signals.effect(() => {
        signals.set(id, fn.call(context));
      });
      cleanups.push(cleanup);
      return ref;
    },

    asyncSignal(name, fn) {
      const id = scoped(scope, name);
      if (!signals.has(id)) {
        signals.asyncSignal(id, fn);
      }
      return signals.ref(id);
    },

    effect(fn) {
      const cleanup = signals.effect(() => fn.call(context));
      cleanups.push(cleanup);
      return cleanup;
    },

    handler(name, fn) {
      const id = scoped(scope, name);
      handlers.register(id, function runComponentHandler(handlerContext) {
        return fn.call({ ...context, ...handlerContext }, handlerContext);
      });
      return id;
    },

    render(Child, childProps = {}) {
      const child = renderComponent(Child, childProps, runtime, scope);
      cleanups.push(child.cleanup);
      mountHooks.push((target) => child.mount(target));
      visibleHooks.push((target) => child.visible(target, loader._observeVisible));
      return rawHtml(child.html);
    },

    onMount(fn) {
      mountHooks.push((target) => fn.call(context, target));
    },

    onVisible(fn) {
      visibleHooks.push((target) => fn.call(context, target));
    }
  };

  return context;
}

function scoped(scope, name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("Scoped signal or handler name must be a non-empty string.");
  }
  return `${scope}.${name}`;
}

function componentName(Component) {
  return Component.displayName || Component.name || "anonymous";
}
