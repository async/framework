import { attachRegistryInspection, createRegistryStore } from "./registry-store.js";

const cacheDefinitionKind = Symbol.for("@async/framework.cacheDefinition");

export function defineCache(options = {}) {
  return {
    [cacheDefinitionKind]: true,
    kind: "cache-definition",
    store: options.store ?? "memory",
    ttl: options.ttl
  };
}

export function createCacheRegistry(initialMap = {}, { now = () => Date.now(), registry, type = "cache.browser" } = {}) {
  const registryStore = registry ?? createRegistryStore();
  const definitions = registryStore._map(type);
  const entries = registryStore._map(`${type}.entries`);
  const pending = new Map();

  const registryApi = attachRegistryInspection({
    register(id, definition = defineCache()) {
      assertId(id);
      const normalized = normalizeDefinition(definition);
      if (definitions.has(id)) {
        throw new Error(`Cache "${id}" is already registered.`);
      }
      definitions.set(id, normalized);
      return id;
    },

    registerMany(map) {
      for (const [id, definition] of Object.entries(map ?? {})) {
        registryApi.register(id, definition);
      }
      return registryApi;
    },

    unregister(id) {
      assertId(id);
      return definitions.delete(id);
    },

    resolve(id) {
      assertId(id);
      return definitions.get(id);
    },

    get(key) {
      assertKey(key);
      return readEntry(key).value;
    },

    set(key, value, options = {}) {
      assertKey(key);
      const ttl = options.ttl ?? resolvePolicy(key, options.cache)?.ttl;
      entries.set(key, {
        value,
        expiresAt: ttl === undefined ? undefined : now() + ttl
      });
      return value;
    },

    async getOrSet(key, fn, options = {}) {
      assertKey(key);
      if (typeof fn !== "function") {
        throw new TypeError("cache.getOrSet(key, fn) requires a function.");
      }
      const cached = readEntry(key);
      if (cached.found) {
        return cached.value;
      }
      if (pending.has(key)) {
        return pending.get(key);
      }
      let promise;
      promise = Promise.resolve()
        .then(fn)
        .then((value) => {
          if (pending.get(key) === promise) {
            registryApi.set(key, value, options);
          }
          return value;
        })
        .finally(() => {
          if (pending.get(key) === promise) {
            pending.delete(key);
          }
        });
      pending.set(key, promise);
      return promise;
    },

    delete(key) {
      assertKey(key);
      pending.delete(key);
      return entries.delete(key);
    },

    clear(prefix) {
      if (prefix === undefined) {
        entries.clear();
        pending.clear();
        return registryApi;
      }
      for (const key of [...entries.keys()]) {
        if (key.startsWith(prefix)) {
          entries.delete(key);
        }
      }
      for (const key of [...pending.keys()]) {
        if (key.startsWith(prefix)) {
          pending.delete(key);
        }
      }
      return registryApi;
    },

    snapshot() {
      const snapshot = {};
      for (const [key] of entries) {
        const { found, value } = readEntry(key);
        if (found && value !== undefined) {
          snapshot[key] = value;
        }
      }
      return snapshot;
    },

    restore(snapshot = {}) {
      for (const [key, value] of Object.entries(snapshot ?? {})) {
        registryApi.set(key, value);
      }
      return registryApi;
    },

    entryKeys() {
      return [...entries.keys()];
    },

    entryEntries() {
      return registryStore.entries(`${type}.entries`);
    },

    _adoptMany(map = {}) {
      for (const [id, definition] of Object.entries(map ?? {})) {
        if (!definitions.has(id)) {
          registryApi.register(id, definition);
        }
      }
      return registryApi;
    }
  }, registryStore, type);

  registryApi.registerMany(initialMap);
  return registryApi;

  function resolvePolicy(key, explicitId) {
    if (explicitId !== undefined) {
      return definitions.get(explicitId);
    }
    if (definitions.has(key)) {
      return definitions.get(key);
    }
    const prefix = key.split(":")[0];
    return definitions.get(prefix);
  }

  function readEntry(key) {
    const entry = entries.get(key);
    if (!entry) {
      return { found: false, value: undefined };
    }
    if (entry.expiresAt !== undefined && entry.expiresAt <= now()) {
      entries.delete(key);
      return { found: false, value: undefined };
    }
    return { found: true, value: entry.value };
  }
}

function normalizeDefinition(definition) {
  if (definition?.[cacheDefinitionKind]) {
    return definition;
  }
  return defineCache(definition);
}

function assertId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Cache id must be a non-empty string.");
  }
}

function assertKey(key) {
  if (typeof key !== "string" || key.length === 0) {
    throw new TypeError("Cache key must be a non-empty string.");
  }
}
