import { createCacheRegistry } from "./cache.js";
import { createComponentRegistry } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { Loader } from "./loader.js";
import { createPartialRegistry } from "./partials.js";
import { createRouteRegistry, createRouter } from "./router.js";
import { createScheduler } from "./scheduler.js";
import { createServerNamespace } from "./server.js";
import { cloneSignalDeclaration, createSignal, createSignalRegistry } from "./signals.js";
import { createRegistryStore } from "./registry-store.js";
import { attributeName, normalizeAttributeConfig } from "./attributes.js";
import { createLazyRegistry, defineRegistrySnapshot, sameRegistryValue } from "./lazy-registry.js";

const registryTypes = new Set(["signal", "handler", "server", "partial", "route", "component", "asyncSignal"]);

export function defineApp(initial, options = {}) {
  const registry = createRegistryStore(undefined, { target: "browser" });
  const runtimes = new Set();
  const createRuntime = options.createRuntime ?? createApp;
  const loaderFacade = createLoaderFacade();
  let currentRuntime;

  const app = {
    registry,
    loader: loaderFacade,

    use(typeOrModule, entries) {
      const normalized = normalizeUse(typeOrModule, entries);
      appendDeclarations(registry, normalized);
      for (const runtime of runtimes) {
        runtime._applyUse(normalized);
      }
      return app;
    },

    snapshot() {
      return registry.rawSnapshot();
    },

    start(options = {}) {
      const runtime = createRuntime(app, options).start();
      setCurrentRuntime(runtime);
      return runtime;
    },

    attachRoot(root) {
      return ensureRuntime(app).attachRoot(root);
    },

    detachRoot(root) {
      return currentRuntime?.detachRoot(root) ?? app;
    },

    applySnapshot(snapshot, snapshotOptions = {}) {
      if (currentRuntime) {
        currentRuntime.applySnapshot(snapshot, snapshotOptions);
        return app;
      }
      appendSnapshotDeclarations(registry, snapshot, snapshotOptions);
      return app;
    },

    inspectRoots() {
      return currentRuntime?.inspectRoots() ?? { count: 0, roots: [] };
    },

    inspectRuntime() {
      return inspectRuntimeState(currentRuntime, loaderFacade);
    },

    _attach(runtime) {
      runtimes.add(runtime);
      return () => app._detach(runtime);
    },

    _detach(runtime) {
      runtimes.delete(runtime);
      if (currentRuntime === runtime) {
        currentRuntime = latestRuntime(runtimes);
      }
    }
  };

  Object.defineProperties(app, {
    _runtime: {
      get() {
        return currentRuntime;
      }
    },
    _setRuntime: {
      value(runtime) {
        setCurrentRuntime(runtime);
      }
    }
  });

  if (initial) {
    app.use(initial);
  }

  return app;

  function setCurrentRuntime(runtime) {
    if (runtime) {
      currentRuntime = runtime;
    }
  }
}

export function createApp(appOrDefinition = Async, options = {}) {
  const app = isAppHub(appOrDefinition) ? appOrDefinition : defineApp(appOrDefinition ?? {});
  const target = options.target ?? "browser";
  const scheduler = options.scheduler ?? options.loader?.scheduler ?? createScheduler({
    strategy: target === "server" ? "manual" : "microtask"
  });
  const ownsScheduler = !options.scheduler && !options.loader?.scheduler;
  const attributes = normalizeAttributeConfig(options.attributes);
  const lazyRegistry = options.lazyRegistry ?? createLazyRegistry({
    registryAssets: options.registryAssets,
    importModule: options.importModule
  });
  const registry = options.registry ?? createRuntimeRegistry(app.registry, { target });
  const signals = options.signals ?? createSignalRegistry(undefined, { registry, type: "signal", lazyRegistry });
  const handlers = options.handlers ?? createHandlerRegistry(undefined, { registry, type: "handler", lazyRegistry });
  const serverCache = createCacheRegistry(undefined, { registry, type: "cache.server" });
  const browserCache = createCacheRegistry(undefined, { registry, type: "cache.browser" });
  const serverFactory = options.serverFactory ?? createServerReferenceRegistry;
  const server = options.server ?? serverFactory(undefined, { registry, type: "server" });
  const partials = options.partials ?? createPartialRegistry(undefined, { registry, type: "partial", lazyRegistry });
  const routes = options.routes ?? createRouteRegistry(undefined, { registry, type: "route" });
  const components = options.components ?? createComponentRegistry(undefined, { registry, type: "component", lazyRegistry });
  const hasStartupRoot = options.loader || Object.hasOwn(options, "root");
  const startupRoot = hasStartupRoot ? options.root : null;
  let loader = options.loader;
  let router = options.router;
  let routerStarted = false;
  let detach = () => {};
  let started = false;
  let destroyed = false;
  const rootLoaders = new Map();

  const snapshotRoot = startupRoot ?? globalThis.document;
  const initialSnapshot = options.snapshot ?? (target === "browser" ? readSnapshot(snapshotRoot, { attributes }) : undefined);
  attachServerCache(server, serverCache);

  const runtime = {
    app,
    registry,
    target,
    signals,
    handlers,
    server,
    partials,
    routes,
    components,
    browser: {
      cache: browserCache
    },
    loader,
    router,
    scheduler,
    attributes,

    start() {
      assertActive();
      if (started) {
        return runtime;
      }
      started = true;
      app._setRuntime?.(runtime);

      if (target !== "server") {
        configureServerContext({ cache: browserCache });
        signals._setContext?.({ server, loader, cache: browserCache, scheduler });

        if (loader) {
          registerRootLoader(loader.root, loader);
          loader.start();
          startRouterFor(loader.root);
          app.loader._setCurrent(runtime.loader);
        } else if (startupRoot != null) {
          runtime.attachRoot(startupRoot);
        }
      } else {
        configureServerContext({ cache: serverCache });
        signals._setContext?.({ server, cache: serverCache, scheduler });
      }

      return runtime;
    },

    use(typeOrModule, entries) {
      app.use(typeOrModule, entries);
      return runtime;
    },

    attachRoot(root) {
      assertActive();
      if (target === "server") {
        throw new Error("Server runtimes cannot attach DOM roots.");
      }
      if (!root) {
        throw new TypeError("runtime.attachRoot(root) requires a root.");
      }
      if (rootLoaders.has(root)) {
        return runtime;
      }

      const rootLoader = rootLoaders.size === 0 && loader
        ? loader
        : Loader({
            root,
            signals,
            handlers,
            server,
            cache: browserCache,
            components,
            scheduler,
            attributes
          });
      registerRootLoader(root, rootLoader);
      rootLoader.start();
      configureServerContext({ cache: browserCache });
      signals._setContext?.({ server, loader: runtime.loader, cache: browserCache, scheduler });
      startRouterFor(root);
      app.loader._setCurrent(runtime.loader);
      return runtime;
    },

    detachRoot(root) {
      assertActive();
      if (target === "server") {
        return runtime;
      }
      if (root == null) {
        const detachedLoaders = [...new Set(rootLoaders.values())];
        for (const rootLoader of new Set(rootLoaders.values())) {
          rootLoader.destroy?.();
        }
        rootLoaders.clear();
        router?.destroy?.();
        router = undefined;
        routerStarted = false;
        loader = undefined;
        runtime.loader = undefined;
        runtime.router = undefined;
        app.loader._clearCurrent(detachedLoaders);
        return runtime;
      }
      const rootLoader = rootLoaders.get(root);
      if (!rootLoader) {
        return runtime;
      }
      rootLoader.destroy?.();
      rootLoaders.delete(root);
      if (loader === rootLoader) {
        router?.destroy?.();
        router = undefined;
        routerStarted = false;
        const next = rootLoaders.values().next().value;
        loader = next;
        runtime.loader = next;
        runtime.router = undefined;
        if (next) {
          startRouterFor(next.root);
          app.loader._setCurrent(next);
        } else {
          app.loader._clearCurrent(rootLoader);
        }
      }
      return runtime;
    },

    inspectRoots() {
      return {
        count: rootLoaders.size,
        roots: [...rootLoaders].map(([root, rootLoader]) => ({
          root,
          loader: rootLoader,
          primary: rootLoader === loader
        }))
      };
    },

    applySnapshot(snapshot, snapshotOptions = {}) {
      applySnapshotToRuntime(runtime, snapshot, snapshotOptions);
      return runtime;
    },

    async render(url) {
      assertActive();
      configureServerContext({ cache: serverCache });
      signals._setContext?.({ server, cache: serverCache, scheduler });
      const matched = routes.match(url);
      if (!matched) {
        await scheduler.flush();
        return {
          html: renderDocument("", { status: 404, signals, browserCache, boundary: options.boundary ?? "route", attributes }),
          status: 404,
          signals: signals.snapshot(),
          cache: { browser: browserCache.snapshot() }
        };
      }

      const partialId = matched.route.partial;
      const result = partialId && partials.resolve(partialId)
        ? await partials.render(partialId, matched.params, {
            params: matched.params,
            route: matched.route,
            signals,
            handlers,
            server,
            cache: serverCache,
            browserCache,
            partials,
            scheduler,
            ...currentRequestContext()
          })
        : { html: "" };

      if (result.signals) {
        for (const [path, value] of Object.entries(result.signals)) {
          applySignalPatch(signals, path, value);
        }
      }
      if (result.cache?.browser) {
        browserCache.restore(result.cache.browser);
      }

      await scheduler.flush();

      const status = result.status ?? 200;
      return {
        html: renderDocument(result.html, { status, signals, browserCache, boundary: result.boundary ?? options.boundary ?? "route", attributes }),
        status,
        signals: signals.snapshot(),
        cache: { browser: browserCache.snapshot() }
      };
    },

    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      detach();
      router?.destroy?.();
      const destroyedLoaders = new Set(rootLoaders.values());
      for (const rootLoader of destroyedLoaders) {
        rootLoader.destroy?.();
      }
      rootLoaders.clear();
      if (loader && !destroyedLoaders.has(loader)) {
        loader?.destroy?.();
      }
      app.loader._clearCurrent([...destroyedLoaders, loader]);
      app.loader._rejectPending(new Error("Async loader queue was cleared because the runtime was destroyed."));
      signals.destroy?.();
      if (ownsScheduler) {
        scheduler.destroy();
      }
    },

    _applyUse(normalized) {
      applyUseToRuntime(runtime, normalized);
    }
  };

  Object.defineProperties(runtime, {
    _inspect: {
      value() {
        return {
          active: !destroyed,
          started,
          destroyed,
          target,
          roots: runtime.inspectRoots(),
          loader: app.loader.inspect(),
          router: Boolean(runtime.router)
        };
      }
    }
  });

  server.cache = serverCache;
  runtime.server.cache = serverCache;
  runtime.applySnapshot(initialSnapshot, { strict: options.strictSnapshots ?? true });
  detach = app._attach(runtime);

  return runtime;

  function registerRootLoader(root, rootLoader) {
    rootLoaders.set(root, rootLoader);
    if (!loader) {
      loader = rootLoader;
      runtime.loader = rootLoader;
    }
    rootLoader.server = server;
    rootLoader.cache = browserCache;
    rootLoader.scheduler = scheduler;
  }

  function startRouterFor(root) {
    if (router === false || routerStarted || !(router || shouldStartRouter(routes, options)) || !runtime.loader) {
      return;
    }
    router = router ?? createRouter({
      mode: options.mode ?? "ssr",
      root,
      boundary: options.boundary ?? "route",
      routes,
      loader: runtime.loader,
      signals,
      handlers,
      server,
      cache: browserCache,
      partials,
      scheduler,
      attributes
    });
    runtime.router = router;
    runtime.loader.router = router;
    configureServerContext({ cache: browserCache, router });
    router.start();
    routerStarted = true;
  }

  function configureServerContext(extra = {}) {
    const cache = isLocalServerRegistry(server) ? serverCache : extra.cache;
    server._setContext?.({
      signals,
      loader,
      router,
      cache,
      scheduler,
      requestContext: options.requestContext,
      ...currentRequestContext()
    });
  }

  function currentRequestContext() {
    const context = readRequestContextLike(options.requestContext);
    return {
      requestContext: context,
      request: context.request ?? options.request,
      headers: context.headers ?? options.headers,
      cookies: context.cookies ?? options.cookies,
      locals: context.locals ?? options.locals
    };
  }

  function assertActive() {
    if (destroyed) {
      throw new Error("Async app runtime has been destroyed.");
    }
  }
}

export const Async = defineApp();

function createLoaderFacade() {
  let current;
  const pending = [];
  const readyWaiters = [];

  const facade = {
    get current() {
      return current;
    },

    ready() {
      if (current) {
        return Promise.resolve(current);
      }
      return new Promise((resolve, reject) => {
        readyWaiters.push({ resolve, reject });
      });
    },

    scan(rootOrFragment) {
      return enqueue("scan", [rootOrFragment]);
    },

    swap(boundaryId, fragmentOrTemplate) {
      return enqueue("swap", [boundaryId, fragmentOrTemplate]);
    },

    mount(target, Component, props) {
      return enqueue("mount", [target, Component, props]);
    },

    inspect() {
      return {
        ready: Boolean(current),
        pending: pending.length,
        root: current?.root
      };
    }
  };

  Object.defineProperties(facade, {
    _setCurrent: {
      value(loader) {
        if (!loader) {
          return;
        }
        current = loader;
        while (readyWaiters.length > 0) {
          readyWaiters.shift().resolve(loader);
        }
        flushPending(loader);
      }
    },
    _clearCurrent: {
      value(loaderOrLoaders) {
        if (loaderOrLoaders === undefined) {
          current = undefined;
          return;
        }
        const loaders = Array.isArray(loaderOrLoaders) ? loaderOrLoaders : [loaderOrLoaders];
        if (loaders.includes(current)) {
          current = undefined;
        }
      }
    },
    _rejectPending: {
      value(error) {
        while (pending.length > 0) {
          pending.shift().reject(error);
        }
        while (readyWaiters.length > 0) {
          readyWaiters.shift().reject(error);
        }
      }
    }
  });

  return facade;

  function enqueue(method, args) {
    if (current) {
      return invoke(current, method, args);
    }
    return new Promise((resolve, reject) => {
      pending.push({ method, args, resolve, reject });
    });
  }

  function flushPending(loader) {
    while (pending.length > 0) {
      const operation = pending.shift();
      invoke(loader, operation.method, operation.args)
        .then(operation.resolve, operation.reject);
    }
  }

  async function invoke(loader, method, args) {
    return loader[method](...args);
  }
}

export function readSnapshot(root = globalThis.document, { attributes } = {}) {
  const attributeConfig = normalizeAttributeConfig(attributes);
  const snapshotAttr = attributeName(attributeConfig, "async", "snapshot");
  const documentRef = root?.ownerDocument ?? root ?? globalThis.document;
  const rootNode = root ?? documentRef;
  if (!rootNode?.querySelectorAll && !documentRef?.querySelectorAll) {
    return {};
  }

  const merged = {};
  for (const searchRoot of new Set([rootNode, documentRef])) {
    if (!searchRoot?.querySelectorAll) {
      continue;
    }
    for (const script of searchRoot.querySelectorAll("script[type='application/json'], script")) {
      if (!script.hasAttribute?.(snapshotAttr)) {
        continue;
      }
      const source = script.textContent?.trim() ?? "";
      if (!source) {
        continue;
      }
      let parsed;
      try {
        parsed = JSON.parse(source);
      } catch (cause) {
        throw new Error(`Could not parse Async snapshot: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
      mergeSnapshot(merged, parsed, { strict: true });
    }
  }

  return merged;
}

function applyUseToRuntime(runtime, normalized) {
  applyRegistryUse(runtime.signals, runtime.registry, normalized.signal);
  applyRegistryUse(runtime.handlers, runtime.registry, normalized.handler);
  applyRegistryUse(runtime.server, runtime.registry, normalized.server);
  applyRegistryUse(runtime.partials, runtime.registry, normalized.partial);
  applyRegistryUse(runtime.routes, runtime.registry, normalized.route);
  applyRegistryUse(runtime.components, runtime.registry, normalized.component);
  applyRegistryStoreUse(runtime.registry, "asyncSignal", normalized.asyncSignal);
  applyRegistryUse(runtime.browser.cache, runtime.registry, normalized.cache.browser);
  applyRegistryUse(runtime.server.cache, runtime.registry, normalized.cache.server);
}

function applyRegistryStoreUse(registry, type, entries) {
  if (!entries || Object.keys(entries).length === 0) {
    return;
  }
  for (const [id, value] of Object.entries(entries)) {
    if (!registry.has(type, id)) {
      registry.register(type, id, value);
    }
  }
}

function applyRegistryUse(registry, runtimeRegistry, entries) {
  if (!entries || Object.keys(entries).length === 0) {
    return;
  }
  if (registry?.registry === runtimeRegistry) {
    registry._adoptMany?.(entries);
    return;
  }
  registry?.registerMany?.(entries);
}

function createRuntimeRegistry(appRegistry, { target } = {}) {
  const declarations = appRegistry.rawSnapshot();
  return createRegistryStore({
    ...declarations,
    signal: cloneSignalDeclarations(declarations.signal)
  }, { target });
}

function cloneSignalDeclarations(signals = {}) {
  const cloned = {};
  for (const [id, signalLike] of Object.entries(signals ?? {})) {
    cloned[id] = cloneSignalDeclaration(signalLike);
  }
  return cloned;
}

function emptyDeclarations() {
  return {
    signal: {},
    handler: {},
    server: {},
    partial: {},
    route: {},
    component: {},
    asyncSignal: {},
    cache: {
      browser: {},
      server: {}
    }
  };
}

function normalizeUse(typeOrModule, entries) {
  const normalized = emptyDeclarations();

  if (typeof typeOrModule === "string") {
    if (!registryTypes.has(typeOrModule)) {
      throw new Error(`Unknown Async registry type "${typeOrModule}".`);
    }
    normalized[typeOrModule] = normalizeEntries(typeOrModule, entries);
    return normalized;
  }

  if (!typeOrModule || typeof typeOrModule !== "object") {
    throw new TypeError("Async.use(...) requires a registry type or module object.");
  }

  for (const [type, value] of Object.entries(typeOrModule)) {
    if (type === "cache") {
      normalized.cache.browser = { ...(value?.browser ?? {}) };
      normalized.cache.server = { ...(value?.server ?? {}) };
      continue;
    }
    if (!registryTypes.has(type)) {
      throw new Error(`Unknown Async registry type "${type}".`);
    }
    normalized[type] = normalizeEntries(type, value);
  }

  return normalized;
}

function appendDeclarations(target, source) {
  for (const type of registryTypes) {
    addEntries(target, type, source[type]);
  }
  addEntries(target, "cache.browser", source.cache.browser);
  addEntries(target, "cache.server", source.cache.server);
}

function addEntries(registry, type, source) {
  for (const [id, value] of Object.entries(source ?? {})) {
    registry.register(type, id, value);
  }
}

function isAppHub(value) {
  return Boolean(value && typeof value.use === "function" && typeof value.snapshot === "function" && value.registry);
}

function ensureRuntime(app) {
  if (!app._runtime) {
    app.start();
  }
  return app._runtime;
}

function latestRuntime(runtimes) {
  let latest;
  for (const runtime of runtimes) {
    latest = runtime;
  }
  return latest;
}

function inspectRuntimeState(runtime, loaderFacade) {
  if (runtime?._inspect) {
    return runtime._inspect();
  }
  return {
    active: Boolean(runtime),
    started: Boolean(runtime),
    destroyed: false,
    target: runtime?.target,
    roots: runtime?.inspectRoots?.() ?? { count: 0, roots: [] },
    loader: loaderFacade.inspect(),
    router: Boolean(runtime?.router)
  };
}

function applySnapshotToRuntime(runtime, snapshot = {}, options = {}) {
  const normalized = normalizeSnapshot(snapshot);
  mergeRegistryEntries(runtime, "asyncSignal", normalized.asyncSignal, null, options);
  for (const [id, value] of Object.entries(normalized.signal)) {
    restoreSignalEntry(runtime.signals, id, value);
  }
  runtime.browser.cache.restore(normalized.cache.browser);
  mergeRegistryEntries(runtime, "handler", normalized.handler, runtime.handlers, options);
  mergeRegistryEntries(runtime, "server", normalized.server, runtime.server, options);
  mergeRegistryEntries(runtime, "partial", normalized.partial, runtime.partials, options);
  mergeRegistryEntries(runtime, "route", normalized.route, runtime.routes, options);
  mergeRegistryEntries(runtime, "component", normalized.component, runtime.components, options);
  return runtime;
}

function appendSnapshotDeclarations(registry, snapshot = {}, options = {}) {
  const normalized = normalizeSnapshot(snapshot);
  for (const [id, value] of Object.entries(normalized.signal)) {
    registerSnapshotEntry(registry, "signal", id, createSignal(value), options);
  }
  for (const type of ["handler", "server", "partial", "route", "component", "asyncSignal"]) {
    for (const [id, value] of Object.entries(normalized[type])) {
      registerSnapshotEntry(registry, type, id, value, options);
    }
  }
}

function mergeRegistryEntries(runtime, type, entries, concreteRegistry, options = {}) {
  if (!entries || Object.keys(entries).length === 0) {
    return;
  }
  for (const [id, value] of Object.entries(entries)) {
    if (type === "asyncSignal" && runtime.signals?.has?.(id) && !runtime.registry.has(type, id)) {
      throw new Error(`Signal "${id}" is already registered.`);
    }
    registerSnapshotEntry(runtime.registry, type, id, value, options);
  }
  concreteRegistry?._adoptMany?.(entries);
}

function registerSnapshotEntry(registry, type, id, value, options = {}) {
  const strict = options.strict ?? true;
  const map = registry._map(type);
  if (map.has(id)) {
    if (sameRegistryValue(map.get(id), value) || sameSnapshotValue(map.get(id), value)) {
      return;
    }
    if (strict) {
      throw new Error(`${type} "${id}" is already registered with a different value.`);
    }
    return;
  }
  registry.set(type, id, value);
}

function normalizeSnapshot(snapshot = {}) {
  const normalized = {
    signal: {
      ...(snapshot.signals ?? {}),
      ...(snapshot.signal ?? {})
    },
    handler: { ...(snapshot.handler ?? {}) },
    server: { ...(snapshot.server ?? {}) },
    partial: { ...(snapshot.partial ?? {}) },
    route: { ...(snapshot.route ?? {}) },
    component: { ...(snapshot.component ?? {}) },
    asyncSignal: { ...(snapshot.asyncSignal ?? {}) },
    cache: {
      browser: {
        ...(snapshot.entries?.browser ?? {}),
        ...(snapshot.cache?.browser ?? {})
      }
    }
  };
  return normalized;
}

function mergeSnapshot(target, source, options = {}) {
  const normalized = normalizeSnapshot(defineRegistrySnapshot(source));
  target.signal = {
    ...(target.signal ?? target.signals ?? {}),
    ...normalized.signal
  };
  target.signals = target.signal;
  target.cache = {
    ...(target.cache ?? {}),
    browser: {
      ...(target.cache?.browser ?? {}),
      ...normalized.cache.browser
    }
  };
  for (const type of ["handler", "server", "partial", "route", "component", "asyncSignal"]) {
    target[type] = target[type] ?? {};
    for (const [id, value] of Object.entries(normalized[type])) {
      if (Object.hasOwn(target[type], id)) {
        if (sameRegistryValue(target[type][id], value) || sameSnapshotValue(target[type][id], value)) {
          continue;
        }
        if (options.strict ?? true) {
          throw new Error(`${type} "${id}" is already declared with a different value.`);
        }
        continue;
      }
      target[type][id] = value;
    }
  }
  return target;
}

function sameSnapshotValue(left, right) {
  if (left === right) {
    return true;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function restoreSignalEntry(signals, id, value) {
  if (signals.has?.(id)) {
    const entry = signals._entry?.(id);
    if (typeof entry?._restore === "function" && isAsyncSignalSnapshot(value)) {
      entry._restore(value);
      return;
    }
    signals.set(id, value);
    return;
  }
  signals.register(id, createSignal(value));
}

function applySignalPatch(signals, path, value) {
  if (typeof signals._setPath === "function") {
    signals._setPath(path, value);
    return;
  }
  const id = String(path).split(".")[0];
  if (signals.has?.(id)) {
    signals.set(path, value);
    return;
  }
  signals.register(id, createSignal(path === id ? value : {}));
  if (path !== id) {
    signals.set(path, value);
  }
}

function isAsyncSignalSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.hasOwn(value, "value")
    && (Object.hasOwn(value, "loading")
      || Object.hasOwn(value, "error")
      || Object.hasOwn(value, "status")
      || Object.hasOwn(value, "version"));
}

function attachServerCache(server, cache) {
  try {
    server.cache = cache;
  } catch {
    // Proxies that reject assignment can still receive cache through _setContext.
  }
}

function createServerReferenceRegistry(initialMap = {}, options = {}) {
  const registry = options.registry ?? createRegistryStore();
  const type = options.type ?? "server";
  const defaults = {};

  const reference = {
    registry,

    register(id, value) {
      registry.register(type, id, value);
      return id;
    },

    registerMany(map) {
      for (const [id, value] of Object.entries(map ?? {})) {
        reference.register(id, value);
      }
      return reference;
    },

    unregister(id) {
      return registry.unregister(type, id);
    },

    resolve() {
      return undefined;
    },

    async run(id) {
      throw new Error(`Server command "${id}" cannot run without a server proxy or server registry.`);
    },

    keys() {
      return registry.keys(type);
    },

    entries() {
      return registry.entries(type);
    },

    inspect() {
      return registry.entries(type);
    },

    _setContext(context = {}) {
      Object.assign(defaults, context);
      return reference;
    },

    _adoptMany() {
      return reference;
    }
  };

  reference.registerMany(initialMap);
  return createServerNamespace((id, args, context) => reference.run(id, args, context), reference, () => defaults);
}

function readRequestContextLike(store) {
  if (!store) {
    return {};
  }
  if (typeof store.get === "function") {
    return store.get() ?? {};
  }
  if (typeof store.getStore === "function") {
    return store.getStore() ?? {};
  }
  return {};
}

function normalizeEntries(type, entries = {}) {
  if (type !== "signal") {
    return { ...(entries ?? {}) };
  }
  const normalized = {};
  for (const [id, value] of Object.entries(entries ?? {})) {
    normalized[id] = normalizeSignalDeclaration(value);
  }
  return normalized;
}

function normalizeSignalDeclaration(value) {
  if (value && typeof value === "object" && typeof value.subscribe === "function") {
    return value;
  }
  return createSignal(value);
}

function isLocalServerRegistry(server) {
  return typeof server?.registerMany === "function";
}

function shouldStartRouter(routes, options) {
  return Boolean(options.routerOptions || options.mode || routes.entries().length > 0);
}

function renderDocument(routeHtml, { signals, browserCache, boundary, attributes }) {
  const snapshot = {
    signals: signals.snapshot(),
    cache: {
      browser: browserCache.snapshot()
    }
  };
  const boundaryAttr = attributeName(attributes, "async", "boundary");
  const snapshotAttr = attributeName(attributes, "async", "snapshot");
  return `<section ${boundaryAttr}="${escapeAttribute(boundary)}">${routeHtml ?? ""}</section><script type="application/json" ${snapshotAttr}>${escapeScriptJson(snapshot)}</script>`;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
