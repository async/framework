import { createCacheRegistry } from "./cache.js";
import { createComponentRegistry } from "./component.js";
import { createHandlerRegistry } from "./handlers.js";
import { AsyncLoader } from "./loader.js";
import { createPartialRegistry } from "./partials.js";
import { createRouteRegistry, createRouter } from "./router.js";
import { createServerRegistry } from "./server.js";
import { createSignal, createSignalRegistry } from "./signals.js";

const registryTypes = new Set(["signal", "handler", "server", "partial", "route", "component"]);

export function defineApp(initial) {
  const declarations = emptyDeclarations();
  const runtimes = new Set();

  const app = {
    use(typeOrModule, entries) {
      const normalized = normalizeUse(typeOrModule, entries);
      appendDeclarations(declarations, normalized);
      for (const runtime of runtimes) {
        runtime._applyUse(normalized);
      }
      return app;
    },

    snapshot() {
      return cloneDeclarations(declarations);
    },

    start(options = {}) {
      const runtime = createApp(app, options).start();
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
  const snapshot = app.snapshot();
  const signals = options.signals ?? createSignalRegistry(snapshot.signal);
  const handlers = options.handlers ?? createHandlerRegistry(snapshot.handler);
  const serverCache = createCacheRegistry(snapshot.cache.server);
  const browserCache = createCacheRegistry(snapshot.cache.browser);
  const server = options.server ?? createServerRegistry(snapshot.server);
  const partials = options.partials ?? createPartialRegistry(snapshot.partial);
  const routes = options.routes ?? createRouteRegistry(snapshot.route);
  const components = options.components ?? createComponentRegistry(snapshot.component);
  let loader = options.loader;
  let router = options.router;
  let detach = () => {};
  let started = false;
  let destroyed = false;

  applySnapshot(signals, browserCache, options.snapshot);
  attachServerCache(server, serverCache);

  const runtime = {
    app,
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

    start() {
      assertActive();
      if (started) {
        return runtime;
      }
      started = true;

      if (target !== "server") {
        loader = loader ?? AsyncLoader({
          root: options.root,
          signals,
          handlers,
          server,
          cache: browserCache
        });
        runtime.loader = loader;

        configureServerContext({ cache: browserCache });
        signals._setContext?.({ server, loader, cache: browserCache });

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
            fetch: options.fetch,
            routeEndpoint: options.routeEndpoint
          });
          runtime.router = router;
          loader.router = router;
          configureServerContext({ cache: browserCache, router });
          router.start();
        }
      } else {
        configureServerContext({ cache: serverCache });
        signals._setContext?.({ server, cache: serverCache });
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
      signals._setContext?.({ server, cache: serverCache });
      const matched = routes.match(url);
      if (!matched) {
        return {
          html: renderDocument("", { status: 404, signals, browserCache, boundary: options.boundary ?? "route" }),
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
            request: options.request,
            locals: options.locals
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

      const status = result.status ?? 200;
      return {
        html: renderDocument(result.html, { status, signals, browserCache, boundary: result.boundary ?? options.boundary ?? "route" }),
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
      request: options.request,
      locals: options.locals
    });
  }

  function assertActive() {
    if (destroyed) {
      throw new Error("Async app runtime has been destroyed.");
    }
  }
}

export const Async = defineApp();

function applyUseToRuntime(runtime, normalized) {
  runtime.signals.registerMany(normalized.signal);
  runtime.handlers.registerMany(normalized.handler);
  if (typeof runtime.server.registerMany === "function") {
    runtime.server.registerMany(normalized.server);
  }
  runtime.partials.registerMany(normalized.partial);
  runtime.routes.registerMany(normalized.route);
  runtime.components.registerMany(normalized.component);
  runtime.browser.cache.registerMany(normalized.cache.browser);
  runtime.server.cache.registerMany(normalized.cache.server);
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
    normalized[typeOrModule] = { ...(entries ?? {}) };
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
    normalized[type] = { ...(value ?? {}) };
  }

  return normalized;
}

function appendDeclarations(target, source) {
  for (const type of registryTypes) {
    addEntries(target[type], source[type], type);
  }
  addEntries(target.cache.browser, source.cache.browser, "cache.browser");
  addEntries(target.cache.server, source.cache.server, "cache.server");
}

function addEntries(target, source, label) {
  for (const [id, value] of Object.entries(source ?? {})) {
    if (Object.hasOwn(target, id)) {
      throw new Error(`${label} "${id}" is already registered.`);
    }
    target[id] = value;
  }
}

function cloneDeclarations(source) {
  return {
    signal: { ...source.signal },
    handler: { ...source.handler },
    server: { ...source.server },
    partial: { ...source.partial },
    route: { ...source.route },
    component: { ...source.component },
    cache: {
      browser: { ...source.cache.browser },
      server: { ...source.cache.server }
    }
  };
}

function isAppHub(value) {
  return Boolean(value && typeof value.use === "function" && typeof value.snapshot === "function");
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

function isLocalServerRegistry(server) {
  return typeof server?.registerMany === "function";
}

function shouldStartRouter(routes, options) {
  return Boolean(options.routerOptions || options.mode || routes.entries().length > 0);
}

function renderDocument(routeHtml, { signals, browserCache, boundary }) {
  const snapshot = {
    signals: signals.snapshot(),
    cache: {
      browser: browserCache.snapshot()
    }
  };
  return `<section data-async-boundary="${escapeAttribute(boundary)}">${routeHtml ?? ""}</section><script type="application/json" data-async-snapshot>${escapeScriptJson(snapshot)}</script>`;
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
