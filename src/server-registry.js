import { readRequestContext } from "./request-context.js";
import { attachRegistryInspection, createRegistryStore } from "./registry-store.js";
import { assertServerId, createServerNamespace, createSignalReader } from "./server.js";

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

      const mergedContext = mergeRequestContext({
        ...defaults,
        ...context,
        cache: defaults.cache ?? context.cache
      });

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

    _adoptMany(map = {}) {
      for (const [id, fn] of Object.entries(map ?? {})) {
        if (!entries.has(id)) {
          registry.register(id, fn);
        }
      }
      return registry;
    }
  }, registryStore, type);

  registry.registerMany(initialMap);
  return createServerNamespace((id, args, context) => registry.run(id, args, context), registry, () => defaults);
}

function mergeRequestContext(context) {
  const requestContext = readRequestContext(context.requestContext);
  return {
    ...context,
    requestContext,
    request: requestContext.request ?? context.request,
    headers: requestContext.headers ?? context.headers,
    cookies: requestContext.cookies ?? context.cookies,
    locals: requestContext.locals ?? context.locals
  };
}
