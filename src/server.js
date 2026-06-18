const serverEnvelopeKind = Symbol.for("@async/framework.serverResult");
const serverEnvelopeWireKey = "__async_server_result__";
const serverEnvelopeWireVersion = 1;
const serverResultInvocation = Symbol("@async/framework.serverResultInvocation");

export function createServerProxy({
  endpoint = "/__async/server",
  transport,
  signals,
  loader,
  router,
  cache,
  scheduler,
  headers = {}
} = {}) {
  if (typeof transport !== "function") {
    throw new TypeError("createServerProxy(...) requires a transport function.");
  }

  const defaults = { signals, loader, router, cache, scheduler };

  async function run(id, args = [], context = {}) {
    assertServerId(id);
    const runContext = createServerResultContext({ ...defaults, ...context });
    const body = {
      args,
      input: context.input ?? defaultInput(runContext),
      signals: context.signalValues ?? snapshotSignalPaths(context.signalPaths, runContext.signals)
    };
    assertJsonTransportable(body);

    const response = await transport(joinEndpoint(endpoint, id), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: context.abort
    });

    assertTransportResponse(id, response);
    if (!response.ok) {
      throw new Error(`Server function "${id}" failed with ${response.status}.`);
    }

    return consumeServerResult(await readServerResponse(id, response), runContext);
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
  const invocation = getServerResultInvocation(context);
  if (invocation.applied.has(result)) {
    return result;
  }
  invocation.applied.add(result);

  if (result.error) {
    throw toError(result.error);
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

  return result;
}

export async function consumeServerResult(result, context = {}) {
  await applyServerResult(result, context);
  return unwrapServerResult(result);
}

export function unwrapServerResult(result) {
  if (isServerEnvelope(result)) {
    return Object.hasOwn(result, "value") ? result.value : undefined;
  }
  return result;
}

export function createServerResultContext(context = {}) {
  const invocation = context[serverResultInvocation] ?? {
    applied: new WeakSet()
  };
  return {
    ...context,
    [serverResultInvocation]: invocation
  };
}

function getServerResultInvocation(context = {}) {
  return context[serverResultInvocation] ?? {
    applied: new WeakSet()
  };
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

export function createServerNamespace(run, root = {}, contextProvider = () => ({})) {
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
      return run(parts.join("."), args, context);
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

function assertTransportResponse(id, response) {
  if (!response || typeof response !== "object") {
    throw new Error(`Server function "${id}" transport returned an invalid response: expected a fetch Response-like object.`);
  }
  if (typeof response.ok !== "boolean") {
    throw new Error(`Server function "${id}" transport returned an invalid response: missing boolean ok.`);
  }
  if (!response.headers || typeof response.headers.get !== "function") {
    throw new Error(`Server function "${id}" transport returned an invalid response: missing headers.get(name).`);
  }
}

async function readServerResponse(id, response) {
  if (response.status === 204) {
    return undefined;
  }
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    if (typeof response.json !== "function") {
      throw new Error(`Server function "${id}" transport returned an invalid response: missing json().`);
    }
    try {
      return await response.json();
    } catch (cause) {
      throw new Error(`Server function "${id}" returned invalid JSON: ${errorMessage(cause)}`, {
        cause
      });
    }
  }
  if (typeof response.text !== "function") {
    throw new Error(`Server function "${id}" transport returned an invalid response: missing text().`);
  }
  return response.text();
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

export function createSignalReader(signals) {
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

function assertJsonTransportable(value, stack = new Set()) {
  if (typeof value === "bigint") {
    throw new Error("Server proxy JSON transport does not support BigInt values.");
  }
  if (value == null || typeof value !== "object") {
    return;
  }
  if (stack.has(value)) {
    throw new Error("Server proxy JSON transport does not support circular values.");
  }
  stack.add(value);

  const tag = Object.prototype.toString.call(value);
  if (tag === "[object File]" || tag === "[object Blob]" || tag === "[object FormData]") {
    throw new Error("Server proxy JSON transport does not support File, Blob, or FormData values yet.");
  }
  if (isUnsupportedJsonTransportObject(value, tag)) {
    throw new Error("Server proxy JSON transport does not support URLSearchParams, Headers, Request, Response, ReadableStream, ArrayBuffer, or typed array values yet.");
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertJsonTransportable(item, stack);
    }
    stack.delete(value);
    return;
  }
  for (const item of Object.values(value)) {
    assertJsonTransportable(item, stack);
  }
  stack.delete(value);
}

function isUnsupportedJsonTransportObject(value, tag = Object.prototype.toString.call(value)) {
  return tag === "[object URLSearchParams]"
    || tag === "[object Headers]"
    || tag === "[object Request]"
    || tag === "[object Response]"
    || tag === "[object ReadableStream]"
    || tag === "[object ArrayBuffer]"
    || ArrayBuffer.isView(value);
}

function joinEndpoint(endpoint, id) {
  return `${String(endpoint).replace(/\/$/, "")}/${encodeURIComponent(id)}`;
}

function isServerEnvelope(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return value[serverEnvelopeKind] === true
    || value[serverEnvelopeWireKey] === serverEnvelopeWireVersion;
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

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function assertServerId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Server function id must be a non-empty string.");
  }
}
