import { createCacheRegistry } from "./cache.js";
import { createComponentRegistry } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { Loader } from "./loader.js";
import { createPartialRegistry } from "./partials.js";
import { createScheduler } from "./scheduler.js";
import { createServerNamespace } from "./server.js";
import { cloneSignalDeclaration, createSignal, createSignalRegistry } from "./signals.js";
import { createRegistryStore } from "./registry-store.js";
import { attributeName, normalizeAttributeConfig } from "./attributes.js";
import { createLazyRegistry, defineRegistrySnapshot, sameRegistryValue } from "./lazy-registry.js";
import { createDeclarationBus, system } from "./declaration-bus.js";

const registryTypes = new Set(["signal", "handler", "server", "partial", "route", "component", "asyncSignal", "flow"]);

export function defineApp(initial, options = {}) {
  const features = createAppFeatureSet(options.features);
  const registry = createRegistryStore(undefined, { target: "browser" });
  const declarations = createDeclarationBus({ duplicates: options.duplicates });
  const runtimes = new Set();
  const createRuntime = options.createRuntime ?? createApp;
  const loaderFacade = createLoaderFacade();
  const routerFacade = createRouterFacade();
  let currentRuntime;

  const app = {
    registry,
    declarations,
    system,
    loader: loaderFacade,
    router: routerFacade,

    configure(config = {}) {
      declarations.configure(config);
      return app;
    },

    use(typeOrModule, entries) {
      const normalized = normalizeUse(typeOrModule, entries);
      const applied = appendDeclarations(app, registry, declarations, normalized);
      for (const runtime of runtimes) {
        runtime._applyUse(applied);
        if (runtime._inspect?.().started) {
          declarations.start(createDeclarationContext(app, runtime.registry, runtime));
        }
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
    },
    _features: {
      get() {
        return features;
      }
    },
    _declarations: {
      get() {
        return declarations;
      }
    },
    _installFeature: {
      value(feature) {
        mergeAppFeatures(features, feature);
        return app;
      }
    }
  });

  installDeclarationRegistryResolver(registry, declarations, () => createDeclarationContext(app, registry));
  registerBuiltInConventions(declarations);

  if (initial) {
    app.use(initial);
  }

  return app;

  function setCurrentRuntime(runtime) {
    if (runtime) {
      currentRuntime = runtime;
      if (runtime.router) {
        routerFacade._setCurrent(runtime.router);
      } else {
        routerFacade._clearCurrent();
      }
    }
  }
}

export function createApp(appOrDefinition = Async, options = {}) {
  const app = isAppHub(appOrDefinition)
    ? appOrDefinition
    : defineApp(appOrDefinition ?? {}, { duplicates: options.duplicates, features: options.features });
  const features = createAppFeatureSet(app._features, options.features);
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
  const routes = options.routes ?? createFeatureRouteRegistry(features, undefined, { registry, type: "route" });
  const components = options.components ?? createComponentRegistry(undefined, { registry, type: "component", lazyRegistry });
  const flows = new Map();
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
    flows,
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
      app._declarations?.start(createDeclarationContext(app, registry, runtime));

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
        if (router) {
          app.router._clearCurrent(router);
        }
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
        if (router) {
          app.router._clearCurrent(router);
        }
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
      if (router) {
        app.router._clearCurrent(router);
      }
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
      app.router._rejectPending(new Error("Async router queue was cleared because the runtime was destroyed."));
      signals.destroy?.();
      for (const mounted of flows.values()) {
        mounted.instance.destroy?.();
      }
      flows.clear();
      if (ownsScheduler) {
        scheduler.destroy();
      }
    },

    _applyUse(normalized) {
      applyUseToRuntime(runtime, normalized);
    }
  };

  Object.defineProperties(runtime, {
    _features: {
      get() {
        return features;
      }
    },
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

  installDeclarationRegistryResolver(registry, app._declarations, () => createDeclarationContext(app, registry, runtime));
  server.cache = serverCache;
  runtime.server.cache = serverCache;
  mountRuntimeFlowRegistrations(runtime, registry.rawSnapshot().flow);
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
    const createRouter = features.router?.createRouter;
    if (!router && !createRouter) {
      throw new Error("Router usage requires the @async/framework/router entrypoint.");
    }
    router = router ?? createRouter({
      mode: options.mode ?? "ssr",
      root,
      boundary: options.boundary ?? "route",
      routes,
      loader: runtime.loader,
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
    app.router._setCurrent(router);
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
export { createDeclarationBus, system as asyncSystem } from "./declaration-bus.js";

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

    swap(boundaryId, fragmentOrTemplate, options) {
      return enqueue("swap", [boundaryId, fragmentOrTemplate, options]);
    },

    defineRefreshPlan(plan) {
      return enqueue("defineRefreshPlan", [plan]);
    },

    refresh(scope, updates, options) {
      return enqueue("refresh", [scope, updates, options]);
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

function createRouterFacade() {
  let current;
  const pending = [];
  const readyWaiters = [];
  const loaderFacade = createRouterLoaderFacade(() => current);

  const facade = {
    loader: loaderFacade,

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

    match(url) {
      return current?.match(url) ?? null;
    },

    navigate(url, options) {
      return enqueue("navigate", [url, options]);
    },

    prefetch(url) {
      return enqueue("prefetch", [url]);
    },

    inspect() {
      return {
        ready: Boolean(current),
        pending: pending.length,
        mode: current?.mode,
        urlMode: current?.urlMode
      };
    }
  };

  Object.defineProperties(facade, {
    _setCurrent: {
      value(router) {
        if (!router) {
          return;
        }
        current = router;
        while (readyWaiters.length > 0) {
          readyWaiters.shift().resolve(router);
        }
        loaderFacade._flush(router);
        flushPending(router);
      }
    },
    _clearCurrent: {
      value(router) {
        if (router === undefined || router === current) {
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
        loaderFacade._rejectPending(error);
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

  function flushPending(router) {
    while (pending.length > 0) {
      const operation = pending.shift();
      invoke(router, operation.method, operation.args)
        .then(operation.resolve, operation.reject);
    }
  }

  async function invoke(router, method, args) {
    return router[method](...args);
  }
}

function createRouterLoaderFacade(getRouter) {
  const pending = [];
  const readyWaiters = [];

  const facade = {
    get current() {
      return getRouter()?.loader;
    },

    ready() {
      const loader = getRouter()?.loader;
      if (loader) {
        return Promise.resolve(loader);
      }
      return new Promise((resolve, reject) => {
        readyWaiters.push({ resolve, reject });
      });
    },

    scan(rootOrFragment) {
      return enqueue("scan", [rootOrFragment]);
    },

    swap(boundaryId, fragmentOrTemplate, options) {
      return enqueue("swap", [boundaryId, fragmentOrTemplate, options]);
    },

    defineRefreshPlan(plan) {
      return enqueue("defineRefreshPlan", [plan]);
    },

    refresh(scope, updates, options) {
      return enqueue("refresh", [scope, updates, options]);
    },

    mount(target, Component, props) {
      return enqueue("mount", [target, Component, props]);
    },

    inspect() {
      const loader = getRouter()?.loader;
      return {
        ready: Boolean(loader),
        pending: pending.length,
        root: loader?.root
      };
    }
  };

  Object.defineProperties(facade, {
    _flush: {
      value(router) {
        const loader = router?.loader;
        if (!loader) {
          return;
        }
        while (readyWaiters.length > 0) {
          readyWaiters.shift().resolve(loader);
        }
        flushPending(loader);
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
    const loader = getRouter()?.loader;
    if (loader) {
      return invoke(loader, method, args);
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
  applyRegistryStoreUse(runtime.registry, "flow", normalized.flow);
  mountRuntimeFlowRegistrations(runtime, normalized.flow);
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

function mountRuntimeFlowRegistrations(runtime, entries = {}) {
  if (!entries || Object.keys(entries).length === 0) {
    return runtime;
  }
  const mountRegistrations = runtime._features?.flow?.mountRegistrations;
  if (!mountRegistrations) {
    throw new Error("Flow usage requires the @async/framework/flow entrypoint.");
  }
  return mountRegistrations(runtime, entries);
}

function createFeatureRouteRegistry(features, initialMap, options) {
  const createRouteRegistry = features.router?.createRouteRegistry ?? createRouteRegistryGuard;
  return createRouteRegistry(initialMap, options);
}

function createRouteRegistryGuard(initialMap = {}, options = {}) {
  const registryStore = options.registry ?? createRegistryStore();
  const type = options.type ?? "route";
  const entries = registryStore._map(type);

  const registry = {
    registry: registryStore,

    register(pattern, definition) {
      if (typeof pattern !== "string" || pattern.length === 0) {
        throw new TypeError("Route pattern must be a non-empty string.");
      }
      if (entries.has(pattern)) {
        throw new Error(`Route "${pattern}" is already registered.`);
      }
      entries.set(pattern, definition);
      return {
        pattern,
        params: {},
        route: definition
      };
    },

    registerMany(map) {
      for (const [pattern, definition] of Object.entries(map ?? {})) {
        registry.register(pattern, definition);
      }
      return registry;
    },

    unregister(pattern) {
      return entries.delete(pattern);
    },

    match() {
      if (entries.size > 0) {
        throw new Error("Router usage requires the @async/framework/router entrypoint.");
      }
      return null;
    },

    entries() {
      return [...entries].map(([pattern, route]) => ({ pattern, route }));
    },

    keys() {
      return [...entries.keys()];
    },

    inspect() {
      return registryStore.entries(type);
    },

    _adoptMany(map = {}) {
      for (const [pattern, definition] of Object.entries(map ?? {})) {
        if (!entries.has(pattern)) {
          entries.set(pattern, definition);
        }
      }
      return registry;
    }
  };

  registry.registerMany(initialMap);
  return registry;
}

function createAppFeatureSet(...featureSets) {
  const target = {};
  for (const featureSet of featureSets) {
    mergeAppFeatures(target, featureSet);
  }
  return target;
}

function mergeAppFeatures(target, featureSet) {
  if (!featureSet) {
    return target;
  }
  if (featureSet.flow) {
    target.flow = {
      ...(target.flow ?? {}),
      ...featureSet.flow
    };
  }
  if (featureSet.router) {
    target.router = {
      ...(target.router ?? {}),
      ...featureSet.router
    };
  }
  return target;
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
    flow: {},
    cache: {
      browser: {},
      server: {}
    }
  };
}

function emptyUse() {
  return {
    configure: undefined,
    declarations: emptyDeclarations(),
    genericDeclarations: {},
    conventions: {},
    modules: []
  };
}

function normalizeUse(typeOrModule, entries) {
  const normalized = emptyUse();

  if (typeof typeOrModule === "string") {
    if (!registryTypes.has(typeOrModule)) {
      throw new Error(`Unknown Async registry type "${typeOrModule}".`);
    }
    normalized.declarations[typeOrModule] = normalizeEntries(typeOrModule, entries);
    return normalized;
  }

  if (!typeOrModule || typeof typeOrModule !== "object") {
    throw new TypeError("Async.use(...) requires a registry type or module object.");
  }

  for (const [type, value] of Object.entries(typeOrModule)) {
    if (type === "configure") {
      normalized.configure = {
        ...(normalized.configure ?? {}),
        ...(value ?? {})
      };
      continue;
    }
    if (type === "declaration" || type === "declarations") {
      mergeGenericDeclarationGroups(normalized.genericDeclarations, value);
      continue;
    }
    if (type === "convention" || type === "conventions") {
      Object.assign(normalized.conventions, value ?? {});
      continue;
    }
    if (type === "module" || type === "modules") {
      mergeModuleDefinitions(normalized.modules, value);
      continue;
    }
    if (type === "cache") {
      normalized.declarations.cache.browser = { ...(value?.browser ?? {}) };
      normalized.declarations.cache.server = { ...(value?.server ?? {}) };
      continue;
    }
    if (!registryTypes.has(type)) {
      throw new Error(`Unknown Async registry type "${type}".`);
    }
    normalized.declarations[type] = normalizeEntries(type, value);
  }

  return normalized;
}

function appendDeclarations(app, target, declarationBus, source) {
  const applied = emptyDeclarations();
  const context = createDeclarationContext(app, target, undefined, applied);
  if (source.configure) {
    app.configure(source.configure);
  }
  declarationBus.installModules(source.modules, context);
  declarationBus.registerConventions(source.conventions, context);
  for (const type of registryTypes) {
    addDeclarationBusEntries(declarationBus, type, source.declarations[type], context);
  }
  addDeclarationBusEntries(declarationBus, "cache.browser", source.declarations.cache.browser, context);
  addDeclarationBusEntries(declarationBus, "cache.server", source.declarations.cache.server, context);
  for (const [kind, entries] of Object.entries(source.genericDeclarations)) {
    addDeclarationBusEntries(declarationBus, kind, entries, context);
  }
  return applied;
}

function addDeclarationBusEntries(declarationBus, type, source, context) {
  for (const [id, value] of Object.entries(source ?? {})) {
    declarationBus.register(type, id, value, context);
  }
}

function mergeGenericDeclarationGroups(target, source = {}) {
  for (const [kind, entries] of Object.entries(source ?? {})) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
      throw new TypeError(`Async declarations for "${kind}" must be an object.`);
    }
    target[kind] = {
      ...(target[kind] ?? {}),
      ...entries
    };
  }
}

function mergeModuleDefinitions(target, source) {
  if (Array.isArray(source)) {
    target.push(...source);
    return;
  }
  if (source && typeof source === "object" && isModuleDefinition(source)) {
    target.push(source);
    return;
  }
  for (const [id, value] of Object.entries(source ?? {})) {
    if (!value || typeof value !== "object") {
      throw new TypeError(`Async module "${id}" must be an object.`);
    }
    target.push({ id, ...value });
  }
}

function isModuleDefinition(value) {
  return Boolean(value && typeof value === "object" && (
    Object.hasOwn(value, "install")
    || Object.hasOwn(value, "owner")
    || Object.hasOwn(value, "system")
    || Object.hasOwn(value, "id")
  ));
}

function createDeclarationContext(app, registry, runtime, applied) {
  return {
    app,
    registry,
    runtime,
    acceptDeclaration(kind, id, value) {
      acceptRegistryDeclaration(registry, kind, id, value);
      if (applied) {
        addAppliedDeclaration(applied, kind, id, value);
      }
      return value;
    }
  };
}

function acceptRegistryDeclaration(registry, kind, id, value) {
  if (!registry.has(kind, id)) {
    registry.register(kind, id, value);
  }
  return value;
}

function addAppliedDeclaration(target, kind, id, value) {
  if (kind === "cache.browser") {
    target.cache.browser[id] = value;
    return;
  }
  if (kind === "cache.server") {
    target.cache.server[id] = value;
    return;
  }
  if (Object.hasOwn(target, kind)) {
    target[kind][id] = value;
  }
}

function installDeclarationRegistryResolver(registry, declarationBus, getContext) {
  Object.defineProperties(registry, {
    resolve: {
      configurable: true,
      value(kind, id, options = {}) {
        return declarationBus?.resolve(kind, id, {
          ...getContext(),
          ...options
        });
      }
    },
    inspectDeclarations: {
      configurable: true,
      value() {
        return declarationBus?.inspect();
      }
    }
  });
  return registry;
}

function registerBuiltInConventions(declarationBus) {
  for (const kind of registryTypes) {
    declarationBus.registerConvention(kind, builtInConvention(kind));
  }
  declarationBus.registerConvention("cache.browser", builtInConvention("cache.browser"));
  declarationBus.registerConvention("cache.server", builtInConvention("cache.server"));
}

function builtInConvention(kind) {
  return {
    owner: builtInOwner(kind),
    policy: "on-register",
    materialize(declaration, context) {
      context.acceptDeclaration?.(kind, declaration.id, declaration.value);
      return declaration.value;
    }
  };
}

function builtInOwner(kind) {
  if (kind === "signal" || kind === "asyncSignal") {
    return system.for("@async/framework/signals");
  }
  if (kind === "handler") {
    return system.for("@async/framework/handlers");
  }
  if (kind === "server") {
    return system.for("@async/framework/server");
  }
  if (kind === "partial") {
    return system.for("@async/framework/partials");
  }
  if (kind === "route") {
    return system.for("@async/framework/router");
  }
  if (kind === "component") {
    return system.for("@async/framework/components");
  }
  if (kind === "flow") {
    return system.for("@async/framework/flow");
  }
  if (kind === "cache.browser") {
    return system.for("@async/framework/browser-cache");
  }
  if (kind === "cache.server") {
    return system.for("@async/framework/server-cache");
  }
  return system.for(`@async/framework/${kind}`);
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
  mergeRegistryEntries(runtime, "flow", normalized.flow, null, options);
  return runtime;
}

function appendSnapshotDeclarations(registry, snapshot = {}, options = {}) {
  const normalized = normalizeSnapshot(snapshot);
  for (const [id, value] of Object.entries(normalized.signal)) {
    registerSnapshotEntry(registry, "signal", id, createSignal(value), options);
  }
  for (const type of ["handler", "server", "partial", "route", "component", "asyncSignal", "flow"]) {
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
  if (Object.hasOwn(snapshot, "flow")) {
    normalized.flow = { ...(snapshot.flow ?? {}) };
  }
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
  for (const type of ["handler", "server", "partial", "route", "component", "asyncSignal", "flow"]) {
    if (type === "flow" && !Object.hasOwn(normalized, "flow") && !Object.hasOwn(target, "flow")) {
      continue;
    }
    target[type] = target[type] ?? {};
    for (const [id, value] of Object.entries(normalized[type] ?? {})) {
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
    if (typeof entry?._restore === "function") {
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
