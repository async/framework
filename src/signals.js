import { asyncSignal as createAsyncSignal, isAsyncSignal } from "./async-signal.js";

const signalKind = Symbol.for("@async/framework.signal");
const computedKind = Symbol.for("@async/framework.computed");
const effectKind = Symbol.for("@async/framework.effect");
const refKind = Symbol.for("@async/framework.signalRef");
const dependencyFrames = [];

export function createSignal(initial) {
  let value = initial;
  const subscribers = new Set();

  return {
    [signalKind]: true,
    kind: "signal",

    get value() {
      return value;
    },

    set value(nextValue) {
      this.set(nextValue);
    },

    set(nextValue) {
      if (Object.is(value, nextValue)) {
        return value;
      }
      value = nextValue;
      notify();
      return value;
    },

    update(fn) {
      return this.set(fn(value));
    },

    subscribe(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("subscribe(fn) requires a function.");
      }
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    snapshot() {
      return value;
    }
  };

  function notify() {
    for (const subscriber of [...subscribers]) {
      subscriber(value);
    }
  }
}

export const signal = createSignal;

export function computed(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("computed(fn) requires a function.");
  }
  const backing = createSignal(undefined);

  return {
    [computedKind]: true,
    kind: "computed",

    get value() {
      return backing.value;
    },

    set(nextValue) {
      return backing.set(nextValue);
    },

    update(fn) {
      return backing.update(fn);
    },

    subscribe(fn) {
      return backing.subscribe(fn);
    },

    snapshot() {
      return backing.snapshot();
    },

    _bindRegistry(registry, id) {
      return registry.effect(() => {
        backing.set(fn.call({
          signals: registry,
          id,
          server: registry._context?.().server,
          router: registry._context?.().router,
          loader: registry._context?.().loader,
          cache: registry._context?.().cache
        }));
      });
    }
  };
}

export function effect(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("effect(fn) requires a function.");
  }
  return {
    [effectKind]: true,
    kind: "effect",
    fn,
    _bindRegistry(registry) {
      return registry.effect(fn);
    }
  };
}

export function createSignalRegistry(initialMap = {}) {
  const entries = new Map();
  const registryCleanups = new Set();
  const runtimeContext = {};

  const registry = {
    register(id, signalLike) {
      assertId(id);
      if (entries.has(id)) {
        throw new Error(`Signal "${id}" is already registered.`);
      }
      const entry = normalizeSignal(signalLike);
      entries.set(id, entry);
      if (typeof entry._bindRegistry === "function") {
        const cleanup = entry._bindRegistry(registry, id);
        if (typeof cleanup === "function") {
          registryCleanups.add(cleanup);
        }
      }
      return registry.ref(id);
    },

    registerMany(map) {
      for (const [id, signalLike] of Object.entries(map ?? {})) {
        registry.register(id, signalLike);
      }
      return registry;
    },

    ensure(id, initial) {
      assertId(id);
      if (!entries.has(id)) {
        registry.register(id, createSignal(initial));
      }
      return registry.ref(id);
    },

    has(id) {
      return entries.has(id);
    },

    get(path) {
      const parsed = parsePath(path, entries);
      track(parsed.path);
      const entry = requireEntry(entries, parsed.id);
      return readEntry(entry, parsed.parts);
    },

    set(path, value) {
      const parsed = parsePath(path, entries);
      const entry = requireEntry(entries, parsed.id);
      if (parsed.parts.length === 0) {
        return entry.set(value);
      }
      const nextValue = setPath(entry.value, parsed.parts, value);
      entry.set(nextValue);
      return value;
    },

    update(path, fn) {
      if (typeof fn !== "function") {
        throw new TypeError("update(path, fn) requires a function.");
      }
      return registry.set(path, fn(registry.get(path)));
    },

    ref(id) {
      assertId(id);
      return createRef(registry, id);
    },

    subscribe(path, fn) {
      if (typeof fn !== "function") {
        throw new TypeError("subscribe(path, fn) requires a function.");
      }
      const parsed = parsePath(path, entries);
      const entry = requireEntry(entries, parsed.id);
      return entry.subscribe(() => {
        fn(registry.get(parsed.path), {
          id: parsed.id,
          path: parsed.path,
          signal: entry
        });
      });
    },

    snapshot() {
      const snapshot = {};
      for (const [id, entry] of entries) {
        snapshot[id] = typeof entry.snapshot === "function" ? entry.snapshot() : entry.value;
      }
      return snapshot;
    },

    asyncSignal(id, fn) {
      registry.register(id, createAsyncSignal(id, fn));
      return registry.ref(id);
    },

    effect(fn) {
      let cleanup;
      let dependencyCleanups = [];
      let stopped = false;

      const run = () => {
        if (stopped) {
          return;
        }
        if (typeof cleanup === "function") {
          cleanup();
        }
        for (const stop of dependencyCleanups) {
          stop();
        }
        dependencyCleanups = [];

        const outcome = registry._collectDependencies(() => fn.call({
          signals: registry,
          server: runtimeContext.server,
          router: runtimeContext.router,
          loader: runtimeContext.loader,
          cache: runtimeContext.cache
        }));
        cleanup = outcome.value;
        dependencyCleanups = outcome.dependencies.map((dependency) => registry.subscribe(dependency, run));
      };

      run();

      return () => {
        stopped = true;
        if (typeof cleanup === "function") {
          cleanup();
        }
        for (const stop of dependencyCleanups) {
          stop();
        }
      };
    },

    destroy() {
      for (const cleanup of registryCleanups) {
        cleanup();
      }
      registryCleanups.clear();
      for (const entry of entries.values()) {
        entry._dispose?.();
      }
      entries.clear();
    },

    _collectDependencies(fn) {
      const frame = new Set();
      dependencyFrames.push(frame);
      try {
        const value = fn();
        return { value, dependencies: [...frame] };
      } finally {
        dependencyFrames.pop();
      }
    },

    _entry(id) {
      return requireEntry(entries, id);
    },

    _setContext(context = {}) {
      Object.assign(runtimeContext, context);
      return registry;
    },

    _context() {
      return runtimeContext;
    }
  };

  registry.registerMany(initialMap);
  return registry;
}

function normalizeSignal(signalLike) {
  if (isSignalLike(signalLike)) {
    return signalLike;
  }
  return createSignal(signalLike);
}

function isSignalLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.subscribe === "function");
}

function createRef(registry, id) {
  return {
    [refKind]: true,
    kind: "signal-ref",
    id,

    get value() {
      return registry.get(id);
    },

    set value(nextValue) {
      registry.set(id, nextValue);
    },

    get loading() {
      return registry._entry(id).loading ?? false;
    },

    get error() {
      return registry._entry(id).error ?? null;
    },

    get status() {
      return registry._entry(id).status ?? "ready";
    },

    get version() {
      return registry._entry(id).version ?? 0;
    },

    get() {
      return registry.get(id);
    },

    set(nextValue) {
      return registry.set(id, nextValue);
    },

    update(fn) {
      return registry.update(id, fn);
    },

    subscribe(fn) {
      return registry.subscribe(id, fn);
    },

    refresh() {
      const entry = registry._entry(id);
      if (typeof entry.refresh !== "function") {
        throw new Error(`Signal "${id}" cannot refresh.`);
      }
      return entry.refresh();
    },

    cancel(reason) {
      const entry = registry._entry(id);
      if (typeof entry.cancel !== "function") {
        throw new Error(`Signal "${id}" cannot cancel.`);
      }
      return entry.cancel(reason);
    },

    toString() {
      return id;
    },

    [Symbol.toPrimitive]() {
      return id;
    }
  };
}

export function isSignalRef(value) {
  return Boolean(value?.[refKind]);
}

function parsePath(path, entries) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("Signal path must be a non-empty string.");
  }
  const segments = path.split(".");
  for (let end = segments.length; end > 0; end -= 1) {
    const id = segments.slice(0, end).join(".");
    if (entries.has(id)) {
      return { id, parts: segments.slice(end), path };
    }
  }
  const [id, ...parts] = segments;
  return { id, parts, path };
}

function readEntry(entry, parts) {
  if (isAsyncSignal(entry) && parts[0]?.startsWith("$")) {
    const metadata = readAsyncMetadata(entry, parts[0]);
    return readPath(metadata, parts.slice(1));
  }
  return readPath(entry.value, parts);
}

function readAsyncMetadata(entry, part) {
  switch (part) {
    case "$value":
      return entry.value;
    case "$loading":
      return entry.loading;
    case "$error":
      return entry.error;
    case "$status":
      return entry.status;
    case "$version":
      return entry.version;
    default:
      return undefined;
  }
}

function readPath(value, parts) {
  let cursor = value;
  for (const part of parts) {
    if (cursor == null) {
      return undefined;
    }
    cursor = cursor[part];
  }
  return cursor;
}

function setPath(value, parts, nextValue) {
  const root = cloneContainer(value, parts[0]);
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const nextPart = parts[index + 1];
    cursor[part] = cloneContainer(cursor[part], nextPart);
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = nextValue;
  return root;
}

function cloneContainer(value, nextPart) {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (value && typeof value === "object") {
    return { ...value };
  }
  return isArrayIndex(nextPart) ? [] : {};
}

function isArrayIndex(part) {
  return String(Number(part)) === String(part);
}

function requireEntry(entries, id) {
  const entry = entries.get(id);
  if (!entry) {
    throw new Error(`Signal "${id}" is not registered.`);
  }
  return entry;
}

function assertId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Signal id must be a non-empty string.");
  }
}

function track(path) {
  const frame = dependencyFrames.at(-1);
  if (frame) {
    frame.add(path);
  }
}
