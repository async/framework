const declarationTypes = new Set(["signal", "handler", "server", "partial", "route", "component"]);
const cacheTypes = new Set(["cache.browser", "cache.server"]);
const cacheEntryTypes = new Set(["cache.browser.entries", "cache.server.entries"]);
const allTypes = new Set([...declarationTypes, ...cacheTypes, ...cacheEntryTypes]);

export function createRegistryStore(initial = {}, options = {}) {
  const backing = options.backing ?? createBacking();
  const target = options.target ?? "server";

  const registry = {
    target,

    register(type, id, value) {
      const map = registry._map(type);
      assertId(type, id);
      if (map.has(id)) {
        throw new Error(`${type} "${id}" is already registered.`);
      }
      map.set(id, value);
      return id;
    },

    registerMany(type, map = {}) {
      for (const [id, value] of Object.entries(map ?? {})) {
        registry.register(type, id, value);
      }
      return registry;
    },

    set(type, id, value) {
      const map = registry._map(type);
      assertId(type, id);
      map.set(id, value);
      return value;
    },

    delete(type, id) {
      return registry._map(type).delete(id);
    },

    keys(type) {
      if (isHiddenInBrowser(type, target)) {
        return [];
      }
      return [...registry._map(type).keys()];
    },

    entries(type, entryOptions = {}) {
      const normalized = normalizeType(type);
      if (isHiddenInBrowser(normalized, entryOptions.target ?? target)) {
        return [];
      }
      return [...registry._map(normalized)].map(([id, value]) => [
        id,
        publicValue(normalized, id, value, { target, ...entryOptions })
      ]);
    },

    has(type, id) {
      assertId(type, id);
      if (isHiddenInBrowser(type, target)) {
        return false;
      }
      return registry._map(type).has(id);
    },

    get(type, id, getOptions = {}) {
      assertId(type, id);
      const normalized = normalizeType(type);
      if (isHiddenInBrowser(normalized, getOptions.target ?? target)) {
        return undefined;
      }
      const value = registry._map(normalized).get(id);
      if (value === undefined) {
        return undefined;
      }
      return publicValue(normalized, id, value, { target, ...getOptions });
    },

    snapshot(snapshotOptions = {}) {
      const snapshotTarget = snapshotOptions.target ?? target;
      return {
        signal: snapshotSignals(backing.signal),
        handler: snapshotDescriptors(backing.handler, "handler"),
        server: snapshotDescriptors(backing.server, "server"),
        partial: snapshotDescriptors(backing.partial, "partial"),
        route: snapshotPlain(backing.route),
        component: snapshotDescriptors(backing.component, "component"),
        cache: {
          browser: snapshotPlain(backing.cache.browser),
          server: snapshotPlain(backing.cache.server)
        },
        entries: {
          browser: snapshotCacheEntries(backing.cacheEntries.browser),
          server: snapshotTarget === "browser" ? {} : snapshotCacheEntries(backing.cacheEntries.server)
        }
      };
    },

    rawSnapshot() {
      return {
        signal: Object.fromEntries(backing.signal),
        handler: Object.fromEntries(backing.handler),
        server: Object.fromEntries(backing.server),
        partial: Object.fromEntries(backing.partial),
        route: Object.fromEntries(backing.route),
        component: Object.fromEntries(backing.component),
        cache: {
          browser: Object.fromEntries(backing.cache.browser),
          server: Object.fromEntries(backing.cache.server)
        }
      };
    },

    view(viewOptions = {}) {
      return createRegistryStore(undefined, {
        backing,
        target: viewOptions.target ?? target
      });
    },

    _map(type) {
      const normalized = normalizeType(type);
      if (declarationTypes.has(normalized)) {
        return backing[normalized];
      }
      if (normalized === "cache.browser") {
        return backing.cache.browser;
      }
      if (normalized === "cache.server") {
        return backing.cache.server;
      }
      if (normalized === "cache.browser.entries") {
        return backing.cacheEntries.browser;
      }
      if (normalized === "cache.server.entries") {
        return backing.cacheEntries.server;
      }
      throw new Error(`Unknown Async registry type "${type}".`);
    }
  };

  applyInitial(registry, initial);
  return registry;
}

export function attachRegistryInspection(target, registry, type) {
  Object.defineProperty(target, "registry", {
    configurable: true,
    enumerable: true,
    value: registry
  });
  target.keys = () => registry.keys(type);
  target.entries = () => registry.entries(type);
  target.inspect = () => registry.entries(type);
  return target;
}

function createBacking() {
  return {
    signal: new Map(),
    handler: new Map(),
    server: new Map(),
    partial: new Map(),
    route: new Map(),
    component: new Map(),
    cache: {
      browser: new Map(),
      server: new Map()
    },
    cacheEntries: {
      browser: new Map(),
      server: new Map()
    }
  };
}

function applyInitial(registry, initial = {}) {
  registry.registerMany("signal", initial.signal);
  registry.registerMany("handler", initial.handler);
  registry.registerMany("server", initial.server);
  registry.registerMany("partial", initial.partial);
  registry.registerMany("route", initial.route);
  registry.registerMany("component", initial.component);
  registry.registerMany("cache.browser", initial.cache?.browser);
  registry.registerMany("cache.server", initial.cache?.server);

  const entries = initial.entries ?? {};
  for (const [key, value] of Object.entries(entries.browser ?? {})) {
    registry.set("cache.browser.entries", key, cacheEntry(value));
  }
  for (const [key, value] of Object.entries(entries.server ?? {})) {
    registry.set("cache.server.entries", key, cacheEntry(value));
  }
}

function normalizeType(type) {
  if (!allTypes.has(type)) {
    throw new Error(`Unknown Async registry type "${type}".`);
  }
  return type;
}

function assertId(type, id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError(`${type} id must be a non-empty string.`);
  }
}

function publicValue(type, id, value, options) {
  if (type === "server" && options.target === "browser") {
    return { id, kind: "server" };
  }
  if (cacheEntryTypes.has(type)) {
    return value?.value;
  }
  return value;
}

function isHiddenInBrowser(type, target) {
  return type === "cache.server.entries" && target === "browser";
}

function snapshotSignals(map) {
  const snapshot = {};
  for (const [id, entry] of map) {
    snapshot[id] = typeof entry?.snapshot === "function" ? entry.snapshot() : entry?.value ?? entry;
  }
  return snapshot;
}

function snapshotDescriptors(map, kind) {
  const snapshot = {};
  for (const id of map.keys()) {
    snapshot[id] = { id, kind };
  }
  return snapshot;
}

function snapshotPlain(map) {
  return Object.fromEntries(map);
}

function snapshotCacheEntries(map) {
  const snapshot = {};
  for (const [id, entry] of map) {
    snapshot[id] = entry?.value;
  }
  return snapshot;
}

function cacheEntry(value) {
  if (value && typeof value === "object" && Object.hasOwn(value, "value")) {
    return value;
  }
  return { value };
}
