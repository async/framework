import { rawHtml, renderTemplate } from "./html.js";

const componentKind = Symbol.for("@async/framework.component");
let componentCounter = 0;

export function component(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("component(fn) requires a function.");
  }
  Object.defineProperty(fn, componentKind, {
    configurable: true,
    value: true
  });
  return fn;
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
  const { signals, handlers, loader } = runtime;
  const context = {
    scope,
    signals,
    handlers,
    loader,

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
