import { createCacheRegistry } from "./cache.js";
import { createComponentRegistry } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { Loader } from "./loader.js";
import { createPartialRegistry } from "./partials.js";
import { createRouteRegistry, createRouter } from "./router.js";
import { createScheduler } from "./scheduler.js";
import { createServerNamespace } from "./server.js";
import { createSignal, createSignalRegistry } from "./signals.js";
import { createRegistryStore } from "./registry-store.js";
import { attributeName, normalizeAttributeConfig } from "./attributes.js";

const registryTypes = new Set(["signal", "handler", "server", "partial", "route", "component"]);

export function defineApp(initial, options = {}) {
  const registry = createRegistryStore(undefined, { target: "browser" });
  const runtimes = new Set();
  const createRuntime = options.createRuntime ?? createApp;

  const app = {
    registry,

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
      app.runtime = runtime;
      return runtime;
    },

    _attach(runtime) {
      runtimes.add(runtime);
      return () => app._detach(runtime);
    },

    _detach(runtime) {
      runtimes.delete(runtime);
    }
  };

  if (initial) {
    app.use(initial);
  }

  return app;
}

export function createApp(appOrDefinition = Async, options = {}) {
  const app = isAppHub(appOrDefinition) ? appOrDefinition : defineApp(appOrDefinition ?? {});
  const target = options.target ?? "browser";
  const scheduler = options.scheduler ?? options.loader?.scheduler ?? createScheduler({
    strategy: target === "server" ? "manual" : "microtask"
  });
  const ownsScheduler = !options.scheduler && !options.loader?.scheduler;
  const attributes = normalizeAttributeConfig(options.attributes);
  const registry = options.registry ?? app.registry.view({ target });
  const signals = options.signals ?? createSignalRegistry(undefined, { registry, type: "signal" });
  const handlers = options.handlers ?? createHandlerRegistry(undefined, { registry, type: "handler" });
  const serverCache = createCacheRegistry(undefined, { registry, type: "cache.server" });
  const browserCache = createCacheRegistry(undefined, { registry, type: "cache.browser" });
  const serverFactory = options.serverFactory ?? createServerReferenceRegistry;
  const server = options.server ?? serverFactory(undefined, { registry, type: "server" });
  const partials = options.partials ?? createPartialRegistry(undefined, { registry, type: "partial" });
  const routes = options.routes ?? createRouteRegistry(undefined, { registry, type: "route" });
  const components = options.components ?? createComponentRegistry(undefined, { registry, type: "component" });
  let loader = options.loader;
  let router = options.router;
  let detach = () => {};
  let started = false;
  let destroyed = false;

  applySnapshot(signals, browserCache, options.snapshot ?? (target === "browser" ? readSnapshot(options.root, { attributes }) : undefined));
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

      if (target !== "server") {
        loader = loader ?? Loader({
          root: options.root,
          signals,
          handlers,
          server,
          cache: browserCache,
          scheduler,
          attributes
        });
        runtime.loader = loader;

        configureServerContext({ cache: browserCache });
        signals._setContext?.({ server, loader, cache: browserCache, scheduler });

        loader.start();

        if (router !== false && (router || shouldStartRouter(routes, options))) {
          router = router ?? createRouter({
            mode: options.mode ?? "ssr-spa",
            root: options.root,
            boundary: options.boundary ?? "route",
            routes,
            loader,
            signals,
            handlers,
            server,
            cache: browserCache,
            partials,
            scheduler,
            fetch: options.fetch,
            routeEndpoint: options.routeEndpoint,
            attributes
          });
          runtime.router = router;
          loader.router = router;
          configureServerContext({ cache: browserCache, router });
          router.start();
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
          setOrRegisterSignal(signals, path, value);
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
      loader?.destroy?.();
      signals.destroy?.();
      if (ownsScheduler) {
        scheduler.destroy();
      }
    },

    _applyUse(normalized) {
      applyUseToRuntime(runtime, normalized);
    }
  };

  server.cache = serverCache;
  runtime.server.cache = serverCache;
  detach = app._attach(runtime);

  return runtime;

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

export function readSnapshot(root = globalThis.document, { attributes } = {}) {
  const attributeConfig = normalizeAttributeConfig(attributes);
  const snapshotAttr = attributeName(attributeConfig, "async", "snapshot");
  const documentRef = root?.ownerDocument ?? root ?? globalThis.document;
  const rootNode = root ?? documentRef;
  if (!rootNode?.querySelectorAll && !documentRef?.querySelectorAll) {
    return {};
  }

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
        return {};
      }
      try {
        return JSON.parse(source);
      } catch (cause) {
        throw new Error(`Could not parse Async snapshot: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
  }

  return {};
}

function applyUseToRuntime(runtime, normalized) {
  applyRegistryUse(runtime.signals, runtime.registry, normalized.signal);
  applyRegistryUse(runtime.handlers, runtime.registry, normalized.handler);
  applyRegistryUse(runtime.server, runtime.registry, normalized.server);
  applyRegistryUse(runtime.partials, runtime.registry, normalized.partial);
  applyRegistryUse(runtime.routes, runtime.registry, normalized.route);
  applyRegistryUse(runtime.components, runtime.registry, normalized.component);
  applyRegistryUse(runtime.browser.cache, runtime.registry, normalized.cache.browser);
  applyRegistryUse(runtime.server.cache, runtime.registry, normalized.cache.server);
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

function emptyDeclarations() {
  return {
    signal: {},
    handler: {},
    server: {},
    partial: {},
    route: {},
    component: {},
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

function applySnapshot(signals, browserCache, snapshot = {}) {
  for (const [path, value] of Object.entries(snapshot.signals ?? {})) {
    setOrRegisterSignal(signals, path, value);
  }
  browserCache.restore(snapshot.cache?.browser);
}

function setOrRegisterSignal(signals, path, value) {
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
