import {
  defineAsyncSignal,
  defineComputed,
  defineFlow,
  defineSignal,
  isFlowDefinition
} from "@async/flow/define";
import { createFlow } from "@async/flow/framework-runtime";
import {
  onError as flowOnError,
  set as flowSet,
  update as flowUpdate,
  when as flowWhen
} from "@async/flow/helpers/core";
import { ASYNC_SIGNAL, COMPUTED, SIGNAL, STATUS } from "@async/flow/protocol";

const frameworkFlowKind = Symbol.for("@async/framework.flow");

export function flow(config) {
  return defineFrameworkFlow(config);
}

export function defineFrameworkFlow(config) {
  const definition = defineFlow(normalizeFrameworkFlowConfig(config));

  return {
    [frameworkFlowKind]: true,
    kind: "flow",
    definition
  };
}

export function signal(initial) {
  return defineSignal(initial);
}

export function computed(optionsOrCompute, maybeCompute) {
  return defineComputed(optionsOrCompute, maybeCompute);
}

export function asyncSignal(optionsOrLoader, maybeLoader) {
  return defineAsyncSignal(optionsOrLoader, maybeLoader);
}

export const onError = flowOnError;
export const set = flowSet;
export const update = flowUpdate;
export const when = flowWhen;

export function isFrameworkFlowDefinition(value) {
  return Boolean(value?.[frameworkFlowKind] || isFlowDefinition(value));
}

export function mountFlowRegistrations(runtime, entries = {}) {
  if (!entries || Object.keys(entries).length === 0) {
    return runtime;
  }

  runtime.flows ??= new Map();

  for (const [namespace, declaration] of Object.entries(entries)) {
    mountFlowRegistration(runtime, namespace, declaration);
  }

  return runtime;
}

function mountFlowRegistration(runtime, namespace, declaration) {
  assertNamespace(namespace);

  if (runtime.flows.has(namespace)) {
    throw new Error(`Flow "${namespace}" is already registered.`);
  }

  const definition = normalizeFlowDefinition(declaration);
  const instance = createFlow(definition, {
    scheduler: createFrameworkFlowScheduler(runtime.scheduler)
  });
  const mounted = {
    namespace,
    instance,
    handlers: [],
    signals: []
  };

  try {
    for (const [name, ref] of Object.entries(instance.refs)) {
      const path = `${namespace}.${name}`;
      registerMountedFlowSignal(runtime, mounted, path, createFlowSignalBridge(ref, {
        path,
        writable: isWritableFlowRef(ref)
      }));
      if (isFlowAsyncSignalRef(ref)) {
        registerFlowAsyncSignalMetadata(runtime, mounted, namespace, name, ref);
        registerFlowAsyncSignalRefreshHandler(runtime, mounted, namespace, name, ref);
      }
    }

    for (const name of Object.keys(instance.handlers)) {
      const path = `${namespace}.${name}`;
      registerMountedFlowHandler(runtime, mounted, path, function runMountedFlowHandler(context = {}) {
        return instance.dispatch(name, context.input);
      });
    }

    runtime.flows.set(namespace, mounted);
  } catch (error) {
    rollbackMountedFlow(runtime, mounted);
    throw error;
  }
}

function normalizeFlowDefinition(declaration) {
  if (declaration?.[frameworkFlowKind]) {
    return declaration.definition;
  }

  if (isFlowDefinition(declaration)) {
    return declaration;
  }

  throw new TypeError("Flow registration values must be created by flow(...).");
}

function normalizeFrameworkFlowConfig(config = {}) {
  if (Object.hasOwn(config, "signals")) {
    throw new TypeError('Flow "signals" has been replaced by "store".');
  }

  const normalized = {
    ...config,
    store: normalizeFrameworkFlowStore(config.store ?? {})
  };

  return normalized;
}

function normalizeFrameworkFlowStore(store) {
  const normalized = {};
  const descriptors = Object.getOwnPropertyDescriptors(store);

  for (const [name, descriptor] of Object.entries(descriptors)) {
    if ("value" in descriptor) {
      descriptor.value = normalizeFrameworkSignalDeclaration(descriptor.value);
    }
    Object.defineProperty(normalized, name, descriptor);
  }

  return normalized;
}

function normalizeFrameworkSignalDeclaration(declaration) {
  if (flowRefType(declaration) === "signal" && typeof declaration.subscribe === "function") {
    return defineSignal(typeof declaration.snapshot === "function"
      ? declaration.snapshot()
      : declaration.value);
  }

  if (flowRefType(declaration) === "computed" && typeof declaration._flowCompute === "function") {
    return defineComputed(function frameworkComputedBridge() {
      const context = createFrameworkComputedContext(this);
      return declaration._flowCompute.call(createFrameworkComputedThis(context), context);
    });
  }

  return declaration;
}

function createFrameworkComputedContext(receiver) {
  const store = receiver?.store ?? {};
  const signals = createFrameworkStoreAccessor(store);

  return {
    store,
    signals,
    refs: receiver?.refs ?? {},
    input: undefined
  };
}

function createFrameworkComputedThis(context) {
  return {
    signals: context.signals,
    store: context.store,
    refs: context.refs,
    id: undefined,
    scheduler: undefined
  };
}

function createFrameworkStoreAccessor(store) {
  return new Proxy(
    {
      get(path) {
        return store[path];
      },
      set(path, value) {
        store[path] = value;
        return store[path];
      },
      update(path, fn) {
        store[path] = fn(store[path]);
        return store[path];
      }
    },
    {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        return store[prop];
      },
      set(_target, prop, value) {
        store[prop] = value;
        return true;
      },
      has(target, prop) {
        return prop in target || prop in store;
      }
    }
  );
}

function createFrameworkFlowScheduler(scheduler) {
  return {
    batch(fn) {
      return scheduler?.batch ? scheduler.batch(fn) : fn();
    },

    enqueue(fn) {
      if (!scheduler?.enqueue) {
        fn();
        return;
      }

      scheduler.enqueue("binding", fn, {
        key: `flow:${Math.random().toString(36).slice(2)}`
      });
    },

    flush() {
      return scheduler?.flush?.() ?? Promise.resolve();
    }
  };
}

function registerMountedFlowSignal(runtime, mounted, path, signalLike) {
  if (runtime.signals.has(path)) {
    throw new Error(`Signal "${path}" is already registered.`);
  }
  runtime.signals.register(path, signalLike);
  mounted.signals.push(path);
}

function registerMountedFlowHandler(runtime, mounted, path, handler) {
  if (runtime.handlers.resolve(path)) {
    throw new Error(`Handler "${path}" is already registered.`);
  }
  runtime.handlers.register(path, handler);
  mounted.handlers.push(path);
}

function rollbackMountedFlow(runtime, mounted) {
  runtime.flows?.delete(mounted.namespace);

  for (const path of [...mounted.handlers].reverse()) {
    runtime.handlers.unregister?.(path);
  }

  for (const path of [...mounted.signals].reverse()) {
    runtime.signals.unregister?.(path);
  }

  mounted.instance.destroy?.();
}

function registerFlowAsyncSignalMetadata(runtime, mounted, namespace, name, ref) {
  for (const [metadata, read] of Object.entries({
    loading: () => ref.loading ?? false,
    error: () => ref.error ?? null,
    ready: () => ref.ready ?? false,
    status: () => ref.status ?? "idle",
    version: () => ref.version ?? 0
  })) {
    const path = `${namespace}.${name}.${metadata}`;
    registerMountedFlowSignal(runtime, mounted, path, createFlowReadonlyBridge(ref, { path, read }));
  }
}

function registerFlowAsyncSignalRefreshHandler(runtime, mounted, namespace, name, ref) {
  const path = `${namespace}.refresh${capitalizeIdentifier(name)}`;
  registerMountedFlowHandler(runtime, mounted, path, function refreshMountedFlowAsyncSignal(context = {}) {
    const input = normalizeRefreshInput(context);
    return ref.reload?.(...input) ?? ref.load?.(...input);
  });
}

function normalizeRefreshInput(context) {
  if (context.input === undefined || isSourceLessEmptyInput(context)) {
    return [];
  }

  return Array.isArray(context.input) ? context.input : [context.input];
}

function isSourceLessEmptyInput(context) {
  return (
    isPlainRecord(context.input) &&
    Object.keys(context.input).length === 0 &&
    !context.element &&
    !context.el &&
    !context.event
  );
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function createFlowReadonlyBridge(ref, { path, read }) {
  return {
    kind: "computed",

    get value() {
      return read();
    },

    get() {
      return read();
    },

    set() {
      throw new Error(`Flow signal "${path}" is read-only.`);
    },

    update() {
      throw new Error(`Flow signal "${path}" is read-only.`);
    },

    subscribe(fn) {
      return ref.subscribe(() => fn(read()));
    },

    snapshot() {
      return read();
    },

    _restore() {
      return read();
    },

    _cloneSignalDeclaration() {
      return createFlowReadonlyBridge(ref, { path, read });
    }
  };
}

function createFlowSignalBridge(ref, { path, writable }) {
  return {
    kind: flowRefType(ref),

    get value() {
      return ref.get();
    },

    set value(next) {
      this.set(next);
    },

    get() {
      return ref.get();
    },

    set(next) {
      if (!writable) {
        throw new Error(`Flow signal "${path}" is read-only.`);
      }

      return ref.set(next);
    },

    update(fn) {
      if (!writable) {
        throw new Error(`Flow signal "${path}" is read-only.`);
      }

      return ref.update(fn);
    },

    subscribe(fn) {
      return ref.subscribe(fn);
    },

    snapshot() {
      return ref.snapshot();
    },

    _restore(value) {
      const type = flowRefType(ref);
      if (type === "signal" || type === "status") {
        ref.set(value);
      } else if (type === "asyncSignal" && typeof ref.restore === "function") {
        ref.restore(value);
      }

      return ref.snapshot();
    },

    _cloneSignalDeclaration() {
      return createFlowSignalBridge(ref, { path, writable });
    }
  };
}

function isWritableFlowRef(ref) {
  return typeof ref?.set === "function" && typeof ref?.update === "function";
}

function isFlowAsyncSignalRef(ref) {
  return ref?.[ASYNC_SIGNAL] === true || flowRefType(ref) === "asyncSignal";
}

function flowRefType(ref) {
  if (ref?.[ASYNC_SIGNAL]) {
    return "asyncSignal";
  }
  if (ref?.[STATUS]) {
    return "status";
  }
  if (ref?.[SIGNAL]) {
    return "signal";
  }
  if (ref?.[COMPUTED]) {
    return "computed";
  }

  return ref?.type ?? ref?.kind;
}

function capitalizeIdentifier(value) {
  const text = String(value);
  return `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;
}

function assertNamespace(namespace) {
  if (typeof namespace !== "string" || namespace.length === 0) {
    throw new TypeError("Flow namespace must be a non-empty string.");
  }
}
