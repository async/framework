import { attachRegistryInspection, createRegistryStore } from "./registry-store.js";

const serverEnvelopeKeys = new Set(["value", "signals", "boundary", "html", "redirect", "error"]);
const appliedServerResult = Symbol.for("@async/framework.appliedServerResult");
const appliedServerValues = new WeakSet();

export function createServerRegistry(initialMap = {}, options = {}) {
  const registryStore = options.registry ?? createRegistryStore();
  const type = options.type ?? "server";
  const entries = registryStore._map(type);
  const defaults = {};

  const registry = attachRegistryInspection({
    register(id, fn) {
      assertServerId(id);
      if (typeof fn !== "function") {
        throw new TypeError(`Server function "${id}" must be a function.`);
      }
      if (entries.has(id)) {
        throw new Error(`Server function "${id}" is already registered.`);
      }
      entries.set(id, fn);
      return id;
    },

    registerMany(map) {
      for (const [id, fn] of Object.entries(map ?? {})) {
        registry.register(id, fn);
      }
      return registry;
    },

    unregister(id) {
      assertServerId(id);
      return entries.delete(id);
    },

    resolve(id) {
      assertServerId(id);
      return entries.get(id);
    },

    async run(id, args = [], context = {}) {
      assertServerId(id);
      const fn = registry.resolve(id);
      if (!fn) {
        throw new Error(`Server function "${id}" is not registered.`);
      }

      let runContext;
      const server = createServerNamespace((childId, childArgs, childContext = {}) => {
        return registry.run(childId, childArgs, { ...runContext, ...childContext });
      }, {}, () => runContext);

      const mergedContext = {
        ...defaults,
        ...context,
        cache: defaults.cache ?? context.cache
      };

      runContext = {
        ...mergedContext,
        id,
        args,
        input: mergedContext.input,
        signals: createSignalReader(mergedContext.signals),
        abort: mergedContext.abort,
        cache: mergedContext.cache,
        server
      };

      return fn.call(runContext, ...args);
    },

    _setContext(context = {}) {
      Object.assign(defaults, context);
      return registry;
    },

    _adoptMany() {
      return registry;
    }
  }, registryStore, type);

  registry.registerMany(initialMap);
  return createServerNamespace((id, args, context) => registry.run(id, args, context), registry, () => defaults);
}

export function createServerProxy({
  endpoint = "/__async/server",
  fetch: fetchImpl = globalThis.fetch?.bind(globalThis),
  signals,
  loader,
  router,
  cache,
  headers = {}
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("createServerProxy(...) requires fetch to be available.");
  }

  const defaults = { signals, loader, router, cache };

  async function run(id, args = [], context = {}) {
    assertServerId(id);
    const runContext = { ...defaults, ...context };
    const body = {
      args,
      input: context.input ?? defaultInput(runContext),
      signals: context.signalValues ?? snapshotSignalPaths(context.signalPaths, runContext.signals)
    };
    assertJsonTransportable(body);

    const response = await fetchImpl(joinEndpoint(endpoint, id), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: context.abort
    });

    if (!response.ok) {
      throw new Error(`Server function "${id}" failed with ${response.status}.`);
    }

    const result = await readServerResponse(response);
    await applyServerResult(result, runContext);
    return markAppliedServerValue(unwrapServerResult(result));
  }

  return createServerNamespace(run, {
    run,
    _setContext(context = {}) {
      Object.assign(defaults, context);
    }
  }, () => defaults);
}

export function resolveServerCommandArguments(args, context = {}) {
  const resolved = [];
  const signalValues = {};
  const signalPaths = [];

  for (const arg of args) {
    if (arg.type === "local") {
      resolved.push(resolveLocal(arg.name, context, { forServer: true }));
      continue;
    }

    const value = readSignal(context.signals, arg.path);
    resolved.push(value);
    signalValues[arg.path] = value;
    signalPaths.push(arg.path);
  }

  return { args: resolved, signalValues, signalPaths };
}

export async function applyServerResult(result, context = {}) {
  if (!isServerEnvelope(result)) {
    return result;
  }
  if (result[appliedServerResult] || appliedServerValues.has(result)) {
    return result;
  }

  if (result.signals && context.signals) {
    for (const [path, value] of Object.entries(result.signals)) {
      context.signals.set?.(path, value);
    }
  }

  if (result.cache?.browser && context.cache?.restore) {
    context.cache.restore(result.cache.browser);
  }

  if (result.boundary && Object.hasOwn(result, "html")) {
    context.loader?.swap?.(result.boundary, result.html);
  }

  if (result.redirect) {
    await context.router?.navigate?.(result.redirect);
  }

  if (result.error) {
    throw toError(result.error);
  }

  Object.defineProperty(result, appliedServerResult, {
    configurable: true,
    enumerable: false,
    value: true
  });

  return result;
}

export function unwrapServerResult(result) {
  if (isServerEnvelope(result) && Object.hasOwn(result, "value")) {
    return result.value;
  }
  return result;
}

function markAppliedServerValue(value) {
  if (value && typeof value === "object") {
    appliedServerValues.add(value);
  }
  return value;
}

export function defaultInput(context = {}) {
  const form = findForm(context);
  if (form) {
    return formDataToObject(new form.ownerDocument.defaultView.FormData(form));
  }

  const element = context.element ?? context.el ?? context.event?.target;
  if (!element) {
    return {};
  }

  return {
    value: "value" in element ? element.value : undefined,
    checked: "checked" in element ? element.checked : undefined,
    dataset: element.dataset ? { ...element.dataset } : {}
  };
}

function createServerNamespace(run, root = {}, contextProvider = () => ({})) {
  const cache = new Map();

  function namespace(parts) {
    const cacheKey = parts.join(".");
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey);
    }

    const callable = async (...args) => {
      if (parts.length === 0) {
        throw new Error("Server namespace is not directly callable.");
      }
      const context = contextProvider() ?? {};
      const result = await run(parts.join("."), args, context);
      await applyServerResult(result, context);
      return unwrapServerResult(result);
    };

    const proxy = new Proxy(callable, {
      get(_target, prop) {
        if (prop === "then") {
          return undefined;
        }
        if (prop in _target) {
          return _target[prop];
        }
        if (parts.length === 0 && prop === "_withContext") {
          return (context = {}) => createServerNamespace(run, root, () => ({
            ...(contextProvider() ?? {}),
            ...context
          }));
        }
        if (parts.length === 0 && prop === "run" && typeof root.run === "function") {
          return (id, args = [], context = {}) => root.run(id, args, {
            ...(contextProvider() ?? {}),
            ...context
          });
        }
        if (parts.length === 0 && Object.hasOwn(root, prop)) {
          return root[prop];
        }
        if (prop === Symbol.toStringTag) {
          return "AsyncServerNamespace";
        }
        if (prop === "toString") {
          return () => parts.length === 0 ? "server" : `server.${parts.join(".")}`;
        }
        return namespace([...parts, String(prop)]);
      }
    });

    cache.set(cacheKey, proxy);
    return proxy;
  }

  return namespace([]);
}

async function readServerResponse(response) {
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    return response.json();
  }
  return { value: await response.text() };
}

function snapshotSignalPaths(paths = [], signals) {
  const snapshot = {};
  for (const path of paths) {
    snapshot[path] = readSignal(signals, path);
  }
  return snapshot;
}

function readSignal(signals, path) {
  if (!signals || typeof signals.get !== "function") {
    throw new Error(`Signal "${path}" cannot be read without a signal registry.`);
  }
  return signals.get(path);
}

function createSignalReader(signals) {
  if (!signals || typeof signals.get === "function") {
    return signals;
  }

  return {
    get(path) {
      return readPath(signals, path);
    },
    snapshot() {
      return { ...signals };
    }
  };
}

function readPath(source, path) {
  return String(path)
    .split(".")
    .reduce((value, part) => value?.[part], source);
}

function resolveLocal(name, context, { forServer } = {}) {
  if ((name === "$event" || name === "$el") && forServer) {
    throw new Error(`${name} cannot be passed to a server command.`);
  }
  if (name === "$event") {
    return context.event;
  }
  if (name === "$el") {
    return context.element ?? context.el;
  }
  if (name === "$value") {
    const element = context.element ?? context.el ?? context.event?.target;
    return element?.value;
  }
  if (name === "$checked") {
    const element = context.element ?? context.el ?? context.event?.target;
    return element?.checked;
  }
  if (name === "$form") {
    const form = findForm(context);
    return form ? formDataToObject(new form.ownerDocument.defaultView.FormData(form)) : {};
  }
  if (name === "$dataset") {
    const element = context.element ?? context.el ?? context.event?.target;
    return element?.dataset ? { ...element.dataset } : {};
  }
  throw new Error(`Event local "${name}" is not supported.`);
}

function findForm(context) {
  const event = context.event;
  const element = context.element ?? context.el ?? event?.target;
  if (element?.tagName === "FORM") {
    return element;
  }
  if (event?.type === "submit" && event.target?.tagName === "FORM") {
    return event.target;
  }
  if (event?.type === "submit" && element?.form) {
    return element.form;
  }
  return null;
}

function formDataToObject(formData) {
  const output = {};
  for (const [key, value] of formData.entries()) {
    if (Object.hasOwn(output, key)) {
      output[key] = Array.isArray(output[key]) ? [...output[key], value] : [output[key], value];
      continue;
    }
    output[key] = value;
  }
  return output;
}

function assertJsonTransportable(value, seen = new Set()) {
  if (value == null || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  const tag = Object.prototype.toString.call(value);
  if (tag === "[object File]" || tag === "[object Blob]" || tag === "[object FormData]") {
    throw new Error("Server proxy JSON transport does not support File, Blob, or FormData values yet.");
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertJsonTransportable(item, seen);
    }
    return;
  }
  for (const item of Object.values(value)) {
    assertJsonTransportable(item, seen);
  }
}

function joinEndpoint(endpoint, id) {
  return `${String(endpoint).replace(/\/$/, "")}/${encodeURIComponent(id)}`;
}

function isServerEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value).some((key) => serverEnvelopeKeys.has(key));
}

function toError(value) {
  if (value instanceof Error) {
    return value;
  }
  if (value && typeof value === "object" && typeof value.message === "string") {
    return Object.assign(new Error(value.message), value);
  }
  return new Error(String(value));
}

function assertServerId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Server function id must be a non-empty string.");
  }
}
