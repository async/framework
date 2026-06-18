import { Loader } from "./loader.js";
import { createHandlerRegistry } from "./handlers.js";
import { createScheduler } from "./scheduler.js";
import { createSignalRegistry } from "./signals.js";
import { applyServerResult } from "./server.js";
import { createRegistryStore } from "./registry-store.js";
import { normalizeAttributeConfig } from "./attributes.js";

export function defineRoute(partial, options = {}) {
  return {
    ...options,
    partial
  };
}

export const route = defineRoute;

const routerModes = new Set(["csr", "spa", "ssr", "mpa"]);

export function createRouteRegistry(initialMap = {}, options = {}) {
  const registryStore = options.registry ?? createRegistryStore();
  const type = options.type ?? "route";
  const entries = registryStore._map(type);
  const routes = [];

  const registry = {
    registry: registryStore,

    register(pattern, definition) {
      assertPattern(pattern);
      if (routes.some((candidate) => candidate.pattern === pattern)) {
        throw new Error(`Route "${pattern}" is already registered.`);
      }
      const nextRoute = normalizeRoute(pattern, definition);
      entries.set(pattern, nextRoute.definition);
      routes.push(nextRoute);
      sortRoutes(routes);
      return nextRoute;
    },

    registerMany(map) {
      for (const [pattern, definition] of Object.entries(map ?? {})) {
        registry.register(pattern, definition);
      }
      return registry;
    },

    unregister(pattern) {
      assertPattern(pattern);
      const index = routes.findIndex((candidate) => candidate.pattern === pattern);
      if (index !== -1) {
        routes.splice(index, 1);
      }
      return entries.delete(pattern);
    },

    match(url) {
      const path = toUrl(url).pathname;
      for (const candidate of routes) {
        const match = candidate.regex.exec(path);
        if (!match) {
          continue;
        }
        const params = {};
        candidate.keys.forEach((key, index) => {
          params[key] = safeDecodeURIComponent(match[index + 1] ?? "");
        });
        return {
          pattern: candidate.pattern,
          params,
          route: candidate.definition
        };
      }
      return null;
    },

    entries() {
      return routes.map(({ pattern, definition }) => ({ pattern, route: definition }));
    },

    keys() {
      return [...entries.keys()];
    },

    inspect() {
      return registryStore.entries(type);
    },

    _adoptMany(map = {}) {
      for (const pattern of Object.keys(map ?? {})) {
        adoptRoute(pattern, entries.get(pattern));
      }
      return registry;
    }
  };

  for (const [pattern, definition] of entries) {
    adoptRoute(pattern, definition);
  }
  registry.registerMany(initialMap);
  return registry;

  function adoptRoute(pattern, definition) {
    if (routes.some((candidate) => candidate.pattern === pattern)) {
      return;
    }
    const nextRoute = normalizeRoute(pattern, definition);
    entries.set(pattern, nextRoute.definition);
    routes.push(nextRoute);
    sortRoutes(routes);
  }
}

export function createRouter({
  mode = "ssr",
  root,
  boundary = "route",
  routes = createRouteRegistry(),
  loader,
  signals,
  handlers,
  server,
  cache,
  partials,
  attributes,
  scheduler
} = {}) {
  assertRouterMode(mode);
  const documentRef = root?.ownerDocument ?? root ?? globalThis.document;
  const rootNode = root ?? documentRef;
  const signalRegistry = signals ?? loader?.signals ?? createSignalRegistry();
  const handlerRegistry = handlers ?? loader?.handlers ?? createHandlerRegistry();
  const schedulerInstance = scheduler ?? loader?.scheduler ?? createScheduler();
  const ownsScheduler = !scheduler && !loader?.scheduler;
  const attributeConfig = normalizeAttributeConfig(attributes ?? loader?.attributes);
  const loaderInstance =
    loader ??
    Loader({
      root: rootNode,
      signals: signalRegistry,
      handlers: handlerRegistry,
      server,
      cache,
      scheduler: schedulerInstance,
      attributes: attributeConfig
    });
  const ownsLoader = !loader;
  const cleanups = new Set();
  let destroyed = false;
  let navigationVersion = 0;
  let activeNavigation;

  const api = {
    mode,
    root: rootNode,
    boundary,
    routes,
    loader: loaderInstance,
    signals: signalRegistry,
    handlers: handlerRegistry,
    server,
    cache,
    partials,
    scheduler: schedulerInstance,
    attributes: attributeConfig,

    start() {
      assertActive();
      loaderInstance.router = api;
      signalRegistry._setContext?.({ router: api, loader: loaderInstance, server, cache, scheduler: schedulerInstance });
      if (ownsLoader) {
        loaderInstance.start();
      }
      if (mode === "mpa" || mode === "ssr") {
        updateStateFromLocation();
        return api;
      }
      bindNavigation();
      if (mode === "csr") {
        handleNavigation(api.navigate(currentUrl(), {
          replace: true,
          initial: true,
          source: "client"
        }));
        return api;
      }
      updateStateFromLocation();
      return api;
    },

    match(url) {
      return routes.match(resolveUrl(url));
    },

    prefetch(url) {
      assertActive();
      if (mode === "mpa" || mode === "ssr") {
        return Promise.resolve(null);
      }
      const matched = api.match(url);
      if (matched?.route?.partial && partials?.resolve?.(matched.route.partial)) {
        return partials.render(matched.route.partial, matched.params, {
          ...contextFor(matched),
          prefetch: true
        });
      }
      return Promise.resolve(null);
    },

    async navigate(url, options = {}) {
      assertActive();
      if (mode === "mpa" || mode === "ssr") {
        documentRef.defaultView?.location?.assign?.(url);
        return null;
      }

      const target = resolveUrl(url);
      return renderLocalRoutePartial(target, options);
    },

    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      activeNavigation?.controller.abort(new Error("Router has been destroyed."));
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.clear();
      if (ownsScheduler) {
        schedulerInstance.destroy();
      }
    }
  };

  return api;

  function bindNavigation() {
    const click = (event) => {
      const anchor = closest(event.target, "a[href]");
      if (!anchor || shouldIgnoreLink(event, anchor)) {
        return;
      }
      event.preventDefault();
      handleNavigation(api.navigate(anchor.href));
    };
    const submit = (event) => {
      const form = closest(event.target, "form");
      if (!form || shouldIgnoreForm(form)) {
        return;
      }
      event.preventDefault();
      handleNavigation(api.navigate(formActionUrl(form)));
    };
    const popstate = () => handleNavigation(api.navigate(currentUrl(), { history: false }));

    rootNode.addEventListener?.("click", click);
    rootNode.addEventListener?.("submit", submit);
    documentRef.defaultView?.addEventListener?.("popstate", popstate);
    cleanups.add(() => rootNode.removeEventListener?.("click", click));
    cleanups.add(() => rootNode.removeEventListener?.("submit", submit));
    cleanups.add(() => documentRef.defaultView?.removeEventListener?.("popstate", popstate));
  }

  async function renderLocalRoutePartial(target, options = {}) {
    const matched = api.match(target);
    if (!matched) {
      beginNavigation(target, null);
      setNoRouteError(target);
      return null;
    }

    const navigation = beginNavigation(target, matched);
    setMatchedRouterState(target, matched, { pending: true, error: null });

    try {
      if (!matched.route?.partial || !partials?.resolve?.(matched.route.partial)) {
        const error = new Error(`Route "${target.pathname}" does not have a registered partial.`);
        if (isActiveNavigation(navigation)) {
          setRouterState({ pending: false, error });
        }
        return null;
      }

      const result = await partials.render(matched.route.partial, matched.params, contextFor(matched, navigation));
      if (!isActiveNavigation(navigation)) {
        return null;
      }
      await applyNavigationResult(result, target, options, navigation);
      if (!isActiveNavigation(navigation)) {
        return null;
      }
      setRouterState({ pending: false, error: null });
      return result;
    } catch (error) {
      if (!isActiveNavigation(navigation)) {
        return null;
      }
      setRouterState({ pending: false, error });
      throw error;
    }
  }

  async function applyNavigationResult(result, target, options, navigation) {
    if (!isActiveNavigation(navigation)) {
      return;
    }
    await applyServerResult(result, {
      signals: signalRegistry,
      loader: loaderInstance,
      router: api,
      cache,
      scheduler: schedulerInstance,
      abort: navigation?.abort
    });
    await schedulerInstance.flush();
    if (!isActiveNavigation(navigation)) {
      return;
    }
    if (result?.html != null && !result.boundary && !result.redirect) {
      loaderInstance.swap(boundary, result.html);
      await schedulerInstance.flush();
    }
    if (result?.redirect || options.history === false) {
      return;
    }
    if (options.replace) {
      documentRef.defaultView?.history?.replaceState?.({}, "", target.href);
      return;
    }
    documentRef.defaultView?.history?.pushState?.({}, "", target.href);
  }

  function contextFor(matched, navigation) {
    return {
      params: matched.params,
      route: matched.route,
      router: api,
      signals: signalRegistry,
      handlers: handlerRegistry,
      loader: loaderInstance,
      server,
      cache,
      scheduler: schedulerInstance,
      abort: navigation?.abort
    };
  }

  function beginNavigation(target, matched) {
    activeNavigation?.controller.abort(new Error(`Router navigation superseded by ${target.pathname}${target.search}.`));
    const controller = new AbortController();
    const navigation = {
      id: ++navigationVersion,
      controller,
      abort: controller.signal,
      target,
      matched
    };
    activeNavigation = navigation;
    return navigation;
  }

  function isActiveNavigation(navigation) {
    return !destroyed && navigation && activeNavigation?.id === navigation.id && !navigation.abort.aborted;
  }

  function updateStateFromLocation() {
    const url = currentUrl();
    const matched = api.match(url);
    setMatchedRouterState(url, matched, { pending: false, error: null });
  }

  function setMatchedRouterState(url, matched, patch = {}) {
    signalRegistry.ensure("router", {});
    setRouterState({
      url: url.href,
      path: url.pathname,
      query: queryObject(url),
      params: matched?.params ?? {},
      route: matched?.route ?? null,
      ...patch
    });
  }

  function setNoRouteError(url) {
    const error = new Error(`No route matched ${url.pathname}${url.search}`);
    setMatchedRouterState(url, null, {
      pending: false,
      error
    });
  }

  function setRouterState(patch) {
    signalRegistry.ensure("router", {});
    for (const [key, value] of Object.entries(patch)) {
      signalRegistry.set(`router.${key}`, value);
    }
  }

  function handleNavigation(promise) {
    void promise.catch((error) => {
      if (destroyed) {
        return;
      }
      setRouterState({
        pending: false,
        error
      });
      dispatchAsyncError(rootNode, error);
    });
  }

  function currentUrl() {
    return resolveUrl(documentRef.defaultView?.location?.href ?? "http://localhost/");
  }

  function resolveUrl(url) {
    if (url instanceof URL) {
      return url;
    }
    return new URL(String(url), documentRef.defaultView?.location?.href ?? "http://localhost/");
  }

  function assertActive() {
    if (destroyed) {
      throw new Error("Router has been destroyed.");
    }
  }

  function shouldIgnoreLink(event, anchor) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return true;
    }
    if (anchor.target || anchor.hasAttribute("download")) {
      return true;
    }
    const target = resolveUrl(anchor.href);
    const current = currentUrl();
    if (target.origin !== current.origin) {
      return true;
    }
    return isHashOnlyNavigation(target, current, anchor);
  }

  function shouldIgnoreForm(form) {
    const method = String(form.method || "get").toLowerCase();
    return method !== "get" || resolveUrl(form.action).origin !== currentUrl().origin;
  }

  function formActionUrl(form) {
    const url = resolveUrl(form.action || form.ownerDocument.defaultView.location.href);
    const formData = new form.ownerDocument.defaultView.FormData(form);
    url.search = new URLSearchParams(formData).toString();
    return url.href;
  }
}

function normalizeRoute(pattern, definition) {
  const normalized = typeof definition === "string" ? defineRoute(definition) : definition;
  const { regex, keys } = compilePattern(pattern);
  return {
    pattern,
    regex,
    keys,
    score: routeScore(pattern),
    definition: normalized
  };
}

function compilePattern(pattern) {
  const keys = [];
  if (pattern === "*") {
    return { regex: /^.*$/, keys };
  }
  if (pattern === "/") {
    return { regex: /^\/$/, keys };
  }

  const source = pattern
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) {
        keys.push(segment.slice(1));
        return "([^/]+)";
      }
      return escapeRegExp(segment);
    })
    .join("/");

  return { regex: new RegExp(`^${source}$`), keys };
}

function closest(target, selector) {
  return target?.closest?.(selector);
}

function toUrl(url) {
  if (url instanceof URL) {
    return url;
  }
  return new URL(String(url), globalThis.location?.href ?? "http://localhost/");
}

function queryObject(url) {
  return Object.fromEntries(url.searchParams.entries());
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isHashOnlyNavigation(target, current, anchor) {
  if (target.origin !== current.origin || target.pathname !== current.pathname || target.search !== current.search) {
    return false;
  }
  return target.hash !== current.hash || anchor.getAttribute?.("href")?.startsWith("#") === true;
}

function assertRouterMode(mode) {
  if (!routerModes.has(mode)) {
    throw new TypeError(`Unknown router mode "${mode}".`);
  }
}

function dispatchAsyncError(element, error) {
  const EventCtor = element.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  if (typeof EventCtor !== "function") {
    return;
  }
  element.dispatchEvent?.(
    new EventCtor("async:error", {
      bubbles: true,
      detail: { error }
    })
  );
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sortRoutes(routes) {
  routes.sort((left, right) => right.score - left.score || right.pattern.length - left.pattern.length);
}

function routeScore(pattern) {
  if (pattern === "*") {
    return -1;
  }
  return pattern
    .split("/")
    .filter(Boolean)
    .reduce((score, segment) => {
      if (segment === "*") {
        return score;
      }
      if (segment.startsWith(":")) {
        return score + 2;
      }
      return score + 4;
    }, pattern === "/" ? 3 : 0);
}

function assertPattern(pattern) {
  if (typeof pattern !== "string" || (pattern !== "*" && !pattern.startsWith("/"))) {
    throw new TypeError("Route pattern must be a path string or \"*\".");
  }
}
