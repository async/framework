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
      const entry = entries.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt !== undefined && entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
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
      const cached = registryApi.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const value = await fn();
      registryApi.set(key, value, options);
      return value;
    },

    delete(key) {
      assertKey(key);
      return entries.delete(key);
    },

    clear(prefix) {
      if (prefix === undefined) {
        entries.clear();
        return registryApi;
      }
      for (const key of [...entries.keys()]) {
        if (key.startsWith(prefix)) {
          entries.delete(key);
        }
      }
      return registryApi;
    },

    snapshot() {
      const snapshot = {};
      for (const [key] of entries) {
        const value = registryApi.get(key);
        if (value !== undefined) {
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

    _adoptMany() {
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
