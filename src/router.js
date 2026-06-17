import { AsyncLoader } from "./loader.js";
import { createHandlerRegistry } from "./handlers.js";
import { createSignalRegistry } from "./signals.js";
import { applyServerResult } from "./server.js";

export function defineRoute(partial, options = {}) {
  return {
    ...options,
    partial
  };
}

export const route = defineRoute;

export function createRouteRegistry(initialMap = {}) {
  const routes = [];

  const registry = {
    register(pattern, definition) {
      assertPattern(pattern);
      if (routes.some((candidate) => candidate.pattern === pattern)) {
        throw new Error(`Route "${pattern}" is already registered.`);
      }
      const nextRoute = normalizeRoute(pattern, definition);
      routes.push(nextRoute);
      return nextRoute;
    },

    registerMany(map) {
      for (const [pattern, definition] of Object.entries(map ?? {})) {
        registry.register(pattern, definition);
      }
      return registry;
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
          params[key] = decodeURIComponent(match[index + 1] ?? "");
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
    }
  };

  registry.registerMany(initialMap);
  return registry;
}

export function createRouter({
  mode = "ssr-spa",
  root,
  boundary = "route",
  routes = createRouteRegistry(),
  loader,
  signals,
  handlers,
  server,
  cache,
  partials,
  fetch: fetchImpl = globalThis.fetch?.bind(globalThis),
  routeEndpoint = "/__async/route"
} = {}) {
  const documentRef = root?.ownerDocument ?? root ?? globalThis.document;
  const rootNode = root ?? documentRef;
  const signalRegistry = signals ?? loader?.signals ?? createSignalRegistry();
  const handlerRegistry = handlers ?? loader?.handlers ?? createHandlerRegistry();
  const loaderInstance =
    loader ??
    AsyncLoader({
      root: rootNode,
      signals: signalRegistry,
      handlers: handlerRegistry,
      server,
      cache
    });
  const ownsLoader = !loader;
  const cleanups = new Set();
  let destroyed = false;

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

    start() {
      assertActive();
      loaderInstance.router = api;
      signalRegistry._setContext?.({ router: api, loader: loaderInstance, server, cache });
      if (ownsLoader) {
        loaderInstance.start();
      }
      if (mode === "mpa" || mode === "ssr") {
        updateStateFromLocation();
        return api;
      }
      bindNavigation();
      if (mode === "csr") {
        void api.navigate(currentUrl(), {
          replace: true,
          initial: true,
          source: "client"
        }).catch(() => {});
        return api;
      }
      updateStateFromLocation();
      return api;
    },

    match(url) {
      return routes.match(url);
    },

    prefetch(url) {
      assertActive();
      if (mode === "ssr-spa" && typeof fetchImpl === "function") {
        return fetchRoute(url, { prefetch: true });
      }
      const matched = api.match(url);
      if (matched?.route?.partial && partials?.resolve?.(matched.route.partial)) {
        return partials.render(matched.route.partial, matched.params, contextFor(matched));
      }
      if (typeof fetchImpl === "function") {
        return fetchRoute(url, { prefetch: true });
      }
      return Promise.resolve(null);
    },

    async navigate(url, options = {}) {
      assertActive();
      if (mode === "mpa" || mode === "ssr") {
        documentRef.defaultView?.location?.assign?.(url);
        return null;
      }

      const target = toUrl(url);
      if (mode === "ssr-spa") {
        return fetchRoutePartial(target, options);
      }
      return renderLocalRoutePartial(target, options);
    },

    destroy() {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const cleanup of cleanups) {
        cleanup();
      }
      cleanups.clear();
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
      api.navigate(anchor.href);
    };
    const submit = (event) => {
      const form = closest(event.target, "form");
      if (!form || shouldIgnoreForm(form)) {
        return;
      }
      event.preventDefault();
      api.navigate(formActionUrl(form));
    };
    const popstate = () => api.navigate(currentUrl(), { history: false });

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
      setNoRouteError(target);
      return null;
    }

    setMatchedRouterState(target, matched, { pending: true, error: null });

    try {
      if (!matched.route?.partial || !partials?.resolve?.(matched.route.partial)) {
        const error = new Error(`Route "${target.pathname}" does not have a registered partial.`);
        setRouterState({ pending: false, error });
        return null;
      }

      const result = await partials.render(matched.route.partial, matched.params, contextFor(matched));
      await applyNavigationResult(result, target, options);
      setRouterState({ pending: false, error: null });
      return result;
    } catch (error) {
      setRouterState({ pending: false, error });
      throw error;
    }
  }

  async function fetchRoutePartial(target, options = {}) {
    const matched = api.match(target);
    setMatchedRouterState(target, matched, { pending: true, error: null });

    try {
      const result = await fetchRoute(target.href);
      await applyNavigationResult(result, target, options);
      setRouterState({ pending: false, error: null });
      return result;
    } catch (error) {
      setRouterState({ pending: false, error });
      throw error;
    }
  }

  async function applyNavigationResult(result, target, options) {
    await applyServerResult(result, {
      signals: signalRegistry,
      loader: loaderInstance,
      router: api,
      cache
    });
    if (result?.html != null && !result.boundary && !result.redirect) {
      loaderInstance.swap(boundary, result.html);
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

  async function fetchRoute(url, { prefetch = false } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new Error("Router navigation requires a partial registry or fetch.");
    }
    const response = await fetchImpl(`${routeEndpoint}?to=${encodeURIComponent(String(url))}`, {
      headers: {
        accept: "application/json, text/html"
      }
    });
    if (!response.ok) {
      throw new Error(`Route "${url}" failed with ${response.status}.`);
    }
    if (prefetch) {
      return response;
    }
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      return response.json();
    }
    return { boundary, html: await response.text() };
  }

  function contextFor(matched) {
    return {
      params: matched.params,
      route: matched.route,
      router: api,
      signals: signalRegistry,
      handlers: handlerRegistry,
      loader: loaderInstance,
      server,
      cache,
      abort: undefined
    };
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

  function currentUrl() {
    return toUrl(documentRef.defaultView?.location?.href ?? "http://localhost/");
  }

  function assertActive() {
    if (destroyed) {
      throw new Error("Router has been destroyed.");
    }
  }
}

function normalizeRoute(pattern, definition) {
  const normalized = typeof definition === "string" ? defineRoute(definition) : definition;
  const { regex, keys } = compilePattern(pattern);
  return {
    pattern,
    regex,
    keys,
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

function shouldIgnoreLink(event, anchor) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return true;
  }
  if (anchor.target || anchor.hasAttribute("download")) {
    return true;
  }
  return toUrl(anchor.href).origin !== toUrl(anchor.ownerDocument.defaultView.location.href).origin;
}

function shouldIgnoreForm(form) {
  const method = String(form.method || "get").toLowerCase();
  return method !== "get" || toUrl(form.action).origin !== toUrl(form.ownerDocument.defaultView.location.href).origin;
}

function formActionUrl(form) {
  const url = toUrl(form.action || form.ownerDocument.defaultView.location.href);
  const formData = new form.ownerDocument.defaultView.FormData(form);
  url.search = new URLSearchParams(formData).toString();
  return url.href;
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertPattern(pattern) {
  if (typeof pattern !== "string" || (pattern !== "*" && !pattern.startsWith("/"))) {
    throw new TypeError("Route pattern must be a path string or \"*\".");
  }
}
