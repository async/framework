import { Loader } from "./loader.js";
import { createHandlerRegistry } from "./handlers.js";
import { createScheduler } from "./scheduler.js";
import { createSignalRegistry } from "./signals.js";
import { applyServerResult } from "./server.js";
import { createRegistryStore } from "./registry-store.js";
import { normalizeAttributeConfig } from "./attributes.js";

export function defineRoute(partialOrDefinition, options = {}) {
  if (isRouteDefinitionObject(partialOrDefinition)) {
    return {
      ...partialOrDefinition,
      ...options
    };
  }
  return {
    ...options,
    partial: partialOrDefinition
  };
}

export const route = defineRoute;

const routerModes = new Set(["csr", "spa", "signals", "ssr", "mpa"]);
const routerUrlModes = new Set(["path", "hash"]);
const routerFallbackModes = new Set(["error", "document"]);
const routeRenderModes = new Set(["auto", "partial", "signals", "none", "document"]);
const serverPartialAccept = "application/x-async-partial";
const serverPartialBoundaryHeader = "x-async-boundary";
const documentNavigationResult = Symbol("@async/framework.documentNavigation");
const emptyHtmlWarnings = new Set();

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
          const value = match[index + 1] ?? "";
          params[key.name] = key.splat
            ? value.split("/").map(safeDecodeURIComponent).join("/")
            : safeDecodeURIComponent(value);
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
      for (const [pattern, definition] of Object.entries(map ?? {})) {
        if (!entries.has(pattern)) {
          registry.register(pattern, definition);
          continue;
        }
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

export function createRouter(options = {}) {
  if (Object.hasOwn(options, "signals")) {
    throw new Error('createRouter(...) does not accept a "signals" option. Pass a loader that owns the runtime signal registry instead.');
  }
  const {
    mode = "ssr",
    urlMode = "path",
    fallback = "error",
    scroll = "auto",
    fetch: fetchOption,
    root,
    boundary = "route",
    routes = createRouteRegistry(),
    loader,
    handlers,
    server,
    cache,
    partials,
    attributes,
    scheduler
  } = options;
  assertRouterMode(mode);
  assertRouterUrlMode(urlMode);
  assertRouterFallback(fallback);
  const documentRef = root?.ownerDocument ?? root ?? globalThis.document;
  const rootNode = root ?? documentRef;
  const signalRegistry = loader?.signals ?? createSignalRegistry();
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
  let started = false;
  let destroyed = false;
  let navigationVersion = 0;
  let activeNavigation;
  let activeRouteSnapshot;
  let observedHistoryHref = "";

  const api = {
    mode,
    urlMode,
    fallback,
    scroll,
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
      if (started) {
        return api;
      }
      started = true;
      loaderInstance.router = api;
      signalRegistry._setContext?.({ router: api, loader: loaderInstance, server, cache, scheduler: schedulerInstance });
      if (ownsLoader) {
        loaderInstance.start();
      }
      syncObservedHistory(currentUrl());
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
      if (mode === "mpa" || mode === "ssr" || mode === "signals") {
        return Promise.resolve(null);
      }
      const matched = api.match(url);
      if (matched?.route?.server) {
        return fetchServerPartial(resolveUrl(url), { boundary: routeBoundary(matched) }, prefetchNavigation())
          .then((result) => (result === documentNavigationResult ? null : result));
      }
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
      const target = resolveUrl(url);
      const matched = api.match(target);
      const plan = planTransition(target, matched, options);
      if (plan.kind === "document") {
        documentNavigate(target);
        return null;
      }

      if (!matched) {
        if (fallback === "document" && canDocumentNavigate(target)) {
          documentNavigate(target);
          return null;
        }
        beginNavigation(target, null);
        setNoRouteError(target);
        return null;
      }

      if (plan.kind === "noop") {
        return matched;
      }

      if (plan.kind === "signals") {
        return renderSignalRoute(target, options, { matched, plan });
      }

      return renderLocalRoutePartial(target, options, { matched, plan });
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

  api.start();
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
    const history = () => {
      const browserTarget = currentBrowserUrl();
      if (urlMode === "hash" && browserTarget.hash && !isHashRoute(browserTarget.hash)) {
        return;
      }
      const target = resolveUrl(browserTarget);
      if (target.href === observedHistoryHref) {
        return;
      }
      syncObservedHistory(target);
      handleNavigation(api.navigate(target, { history: false }));
    };

    rootNode.addEventListener?.("click", click);
    rootNode.addEventListener?.("submit", submit);
    documentRef.defaultView?.addEventListener?.("popstate", history);
    if (urlMode === "hash") {
      documentRef.defaultView?.addEventListener?.("hashchange", history);
    }
    cleanups.add(() => rootNode.removeEventListener?.("click", click));
    cleanups.add(() => rootNode.removeEventListener?.("submit", submit));
    cleanups.add(() => documentRef.defaultView?.removeEventListener?.("popstate", history));
    if (urlMode === "hash") {
      cleanups.add(() => documentRef.defaultView?.removeEventListener?.("hashchange", history));
    }
  }

  async function renderLocalRoutePartial(target, options = {}, transition = {}) {
    const matched = transition.matched ?? api.match(target);
    if (!matched) {
      beginNavigation(target, null);
      setNoRouteError(target);
      return null;
    }

    const plan = transition.plan ?? planTransition(target, matched, options);
    const navigation = beginNavigation(target, matched);
    setMatchedRouterState(target, matched, { pending: true, error: null });

    try {
      let result;
      if (matched.route?.server === true) {
        result = await fetchServerPartial(target, plan, navigation);
        if (!isActiveNavigation(navigation)) {
          return null;
        }
        if (result === documentNavigationResult) {
          setRouterState({ pending: false, error: null });
          documentNavigate(target);
          return null;
        }
      } else {
        if (!matched.route?.partial || !partials?.resolve?.(matched.route.partial)) {
          const error = new Error(`Route "${target.pathname}" does not have a registered partial.`);
          if (isActiveNavigation(navigation)) {
            setRouterState({ pending: false, error });
          }
          return null;
        }
        result = await partials.render(matched.route.partial, matched.params, contextFor(matched, navigation));
      }
      if (!isActiveNavigation(navigation)) {
        return null;
      }
      // A server partial fetch may have followed HTTP redirects; router state,
      // history, and the route snapshot must describe the final URL.
      const effectiveTarget = navigation.redirected ?? target;
      const effectiveMatched = navigation.redirected ? api.match(effectiveTarget) ?? matched : matched;
      await applyNavigationResult(result, effectiveTarget, options, navigation, plan);
      if (!isActiveNavigation(navigation)) {
        return null;
      }
      activeRouteSnapshot = routeSnapshot(effectiveTarget, effectiveMatched, plan);
      if (navigation.redirected) {
        setMatchedRouterState(effectiveTarget, effectiveMatched, { pending: false, error: null });
      } else {
        setRouterState({ pending: false, error: null });
      }
      return result;
    } catch (error) {
      if (!isActiveNavigation(navigation)) {
        return null;
      }
      setRouterState({ pending: false, error });
      throw error;
    }
  }

  async function renderSignalRoute(target, options = {}, transition = {}) {
    const matched = transition.matched ?? api.match(target);
    if (!matched) {
      beginNavigation(target, null);
      setNoRouteError(target);
      return null;
    }

    const plan = transition.plan ?? planTransition(target, matched, options);
    const navigation = beginNavigation(target, matched);
    setMatchedRouterState(target, matched, { pending: false, error: null });
    if (!isActiveNavigation(navigation)) {
      return null;
    }
    updateBrowserHistory(target, options);
    activeRouteSnapshot = routeSnapshot(target, matched, plan);
    return matched;
  }

  async function applyNavigationResult(result, target, options, navigation, plan) {
    if (!isActiveNavigation(navigation)) {
      return;
    }
    // Never await commit completion inside scheduler.batch(...): automatic
    // flushes are suppressed while a batch is open, and frame-timed commits
    // only settle on flush — awaiting them in-batch deadlocks navigation in
    // real browsers (node test environments commit synchronously and hide
    // this). Signal patches coalesce through the microtask flush anyway.
    await applyServerResult(result, {
      signals: signalRegistry,
      loader: loaderInstance,
      router: api,
      cache,
      scheduler: schedulerInstance,
      abort: navigation?.abort
    });
    if (!isActiveNavigation(navigation)) {
      return;
    }
    if (result && Object.hasOwn(result, "html") && result.html === undefined) {
      warnEmptyPartialHtml(plan?.boundary ?? boundary);
    }
    if (shouldSwapRouteResult(result)) {
      const swapped = loaderInstance.swap(plan?.boundary ?? boundary, result.html);
      await loaderInstance._whenCommitted?.(swapped);
    }
    await schedulerInstance.flush();
    if (!isActiveNavigation(navigation)) {
      return;
    }
    if (typeof result?.title === "string" && documentRef) {
      documentRef.title = result.title;
    }
    if (result?.redirect || options.history === false) {
      syncObservedHistory(target);
      return;
    }
    updateBrowserHistory(target, options);
    if (scroll !== false && !options.replace && didSwapNavigationResult(result)) {
      scrollAfterNavigation(target);
    }
  }

  function didSwapNavigationResult(result) {
    return Boolean(
      result &&
        (shouldSwapRouteResult(result) ||
          (result.boundary && Object.hasOwn(result, "html") && result.html !== undefined && result.status !== 204))
    );
  }

  function scrollAfterNavigation(target) {
    const view = documentRef.defaultView;
    if (target.hash) {
      const anchor = documentRef.getElementById?.(safeDecodeURIComponent(target.hash.slice(1)));
      if (anchor?.scrollIntoView) {
        anchor.scrollIntoView();
        return;
      }
    }
    view?.scrollTo?.(0, 0);
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

  // Fetches the matched route's fragment from the server: same target URL,
  // negotiated with the async partial Accept header plus the boundary the
  // transition plan wants filled. The server answers with a wire server
  // envelope ({ __async_server_result__: 1, html, signals, ... }) which flows
  // through the same applyNavigationResult path as local partial output.
  async function fetchServerPartial(target, plan, navigation) {
    const view = documentRef.defaultView;
    const fetchFn = fetchOption ?? (typeof view?.fetch === "function" ? view.fetch.bind(view) : null);
    if (typeof fetchFn !== "function") {
      throw new Error('Server route partials require a window fetch or a createRouter "fetch" option.');
    }
    let response;
    try {
      response = await fetchFn(browserUrlForRoute(target).href, {
        headers: {
          accept: `${serverPartialAccept}, application/json`,
          [serverPartialBoundaryHeader]: plan?.boundary ?? boundary
        },
        credentials: "same-origin",
        signal: navigation?.abort
      });
    } catch (error) {
      if (navigation?.abort?.aborted) {
        return null;
      }
      if (fallback === "document") {
        return documentNavigationResult;
      }
      throw error;
    }
    if (!response.ok) {
      if (fallback === "document") {
        return documentNavigationResult;
      }
      throw new Error(`Server partial for "${target.pathname}" failed with ${response.status}.`);
    }
    let result;
    try {
      result = await response.json();
    } catch (cause) {
      if (fallback === "document") {
        return documentNavigationResult;
      }
      throw new Error(`Server partial for "${target.pathname}" returned invalid JSON.`, { cause });
    }
    if (!result || typeof result !== "object" || !result.__async_server_result__) {
      if (fallback === "document") {
        return documentNavigationResult;
      }
      throw new Error(`Server partial for "${target.pathname}" did not return a server envelope.`);
    }
    if (navigation && response.redirected && response.url) {
      const redirected = resolveUrl(response.url);
      if (redirected.href !== target.href) {
        navigation.redirected = redirected;
      }
    }
    return result;
  }

  function prefetchNavigation() {
    return { abort: undefined, redirected: null };
  }

  function documentNavigate(target) {
    documentRef.defaultView?.location?.assign?.(browserUrlForRoute(target).href);
  }

  // Guards fallback document navigation against reload loops: assigning the
  // browser's current URL would re-run startup against the same unmatched URL.
  function canDocumentNavigate(target) {
    return browserUrlForRoute(target).href !== currentBrowserUrl().href;
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
    activeRouteSnapshot = routeSnapshot(url, matched);
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
    activeRouteSnapshot = routeSnapshot(url, null);
  }

  function setRouterState(patch) {
    signalRegistry.ensure("router", {});
    schedulerInstance.batch(() => {
      for (const [key, value] of Object.entries(patch)) {
        signalRegistry.set(`router.${key}`, value);
      }
    });
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
    return resolveUrl(currentBrowserUrl());
  }

  function resolveUrl(url) {
    const parsed = url instanceof URL
      ? new URL(url.href)
      : new URL(String(url), documentRef.defaultView?.location?.href ?? "http://localhost/");
    if (urlMode === "hash") {
      return routeUrlForHashMode(parsed);
    }
    return parsed;
  }

  function currentBrowserUrl() {
    return new URL(documentRef.defaultView?.location?.href ?? "http://localhost/");
  }

  function routeUrlForHashMode(url) {
    if (isHashRoute(url.hash)) {
      return routeUrlFromHash(url);
    }
    return new URL(`${url.pathname}${url.search}`, routeBaseUrl());
  }

  function routeUrlFromHash(url) {
    const routeReference = url.hash.slice(1) || "/";
    return new URL(routeReference, routeBaseUrl());
  }

  function routeBaseUrl() {
    const current = currentBrowserUrl();
    return `${current.origin}/`;
  }

  function browserUrlForRoute(routeUrl) {
    if (urlMode !== "hash") {
      return routeUrl;
    }
    const browserUrl = currentBrowserUrl();
    browserUrl.hash = `${routeUrl.pathname}${routeUrl.search}`;
    return browserUrl;
  }

  function syncObservedHistory(url) {
    observedHistoryHref = url.href;
  }

  function updateBrowserHistory(target, options = {}) {
    if (options.history === false) {
      syncObservedHistory(target);
      return;
    }
    const historyUrl = browserUrlForRoute(target).href;
    if (options.replace) {
      documentRef.defaultView?.history?.replaceState?.({}, "", historyUrl);
      syncObservedHistory(target);
      return;
    }
    documentRef.defaultView?.history?.pushState?.({}, "", historyUrl);
    syncObservedHistory(target);
  }

  function planTransition(target, matched, options = {}) {
    const planBoundary = routeBoundary(matched);
    if (mode === "mpa" || mode === "ssr") {
      return {
        kind: "document",
        reason: "native-mode",
        boundary: planBoundary,
        match: matched,
        target
      };
    }
    if (!matched) {
      return {
        kind: "signals",
        reason: "no-route",
        boundary: planBoundary,
        match: matched,
        target
      };
    }
    if (routeRenderMode(matched) === "document") {
      return {
        kind: "document",
        reason: "route-render",
        boundary: planBoundary,
        match: matched,
        target
      };
    }
    if (!options.force && isSameRouteSnapshot(target, matched, planBoundary)) {
      return {
        kind: "noop",
        reason: "same-url",
        boundary: planBoundary,
        match: matched,
        target
      };
    }
    if (mode === "signals") {
      return {
        kind: "signals",
        reason: "native-mode",
        boundary: planBoundary,
        match: matched,
        target
      };
    }
    const renderMode = routeRenderMode(matched);
    if (!options.force && (renderMode === "signals" || renderMode === "none")) {
      return {
        kind: "signals",
        reason: "same-view",
        boundary: planBoundary,
        match: matched,
        target
      };
    }
    if (!options.force && renderMode !== "partial" && isSameView(matched, planBoundary)) {
      // Master-detail routes: same view, new URL state. With a subBoundary the
      // route re-renders only its detail region; otherwise state-only.
      if (matched.route?.subBoundary) {
        return {
          kind: "partial",
          reason: "same-view-sub",
          boundary: matched.route.subBoundary,
          match: matched,
          target
        };
      }
      return {
        kind: "signals",
        reason: "same-view",
        boundary: planBoundary,
        match: matched,
        target
      };
    }
    return {
      kind: "partial",
      reason: options.force ? "forced" : "changed-view",
      boundary: planBoundary,
      match: matched,
      target
    };
  }

  function routeSnapshot(target, matched, plan = {}) {
    return {
      url: target.href,
      pattern: matched?.pattern ?? null,
      route: matched?.route ?? null,
      params: matched?.params ?? {},
      // Always the route-level boundary: a same-view-sub plan swaps a nested
      // boundary, but view identity comparisons stay on the route boundary.
      boundary: routeBoundary(matched) ?? plan.boundary,
      viewKey: routeViewKey(matched)
    };
  }

  function isSameRouteSnapshot(target, matched, planBoundary) {
    return Boolean(
      activeRouteSnapshot &&
        activeRouteSnapshot.url === target.href &&
        activeRouteSnapshot.pattern === (matched?.pattern ?? null) &&
        activeRouteSnapshot.route === (matched?.route ?? null) &&
        activeRouteSnapshot.boundary === planBoundary
    );
  }

  function isSameView(matched, planBoundary) {
    const nextViewKey = routeViewKey(matched);
    return Boolean(
      activeRouteSnapshot &&
        nextViewKey &&
        activeRouteSnapshot.viewKey === nextViewKey &&
        activeRouteSnapshot.boundary === planBoundary
    );
  }

  function routeBoundary(matched) {
    return matched?.route?.boundary ?? boundary;
  }

  function routeRenderMode(matched) {
    return matched?.route?.render ?? "auto";
  }

  function routeViewKey(matched) {
    const viewKey = matched?.route?.viewKey;
    if (typeof viewKey === "function") {
      const computed = viewKey(matched);
      return computed == null ? null : String(computed);
    }
    return viewKey ?? null;
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
    const browserTarget = new URL(anchor.href, documentRef.defaultView?.location?.href ?? "http://localhost/");
    const browserCurrent = currentBrowserUrl();
    if (browserTarget.origin !== browserCurrent.origin) {
      return true;
    }
    if (urlMode === "hash") {
      return isPlainHashNavigation(browserTarget, browserCurrent, anchor);
    }
    const target = resolveUrl(anchor.href);
    const current = currentUrl();
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
  assertRouteDefinition(normalized);
  const { regex, keys } = compilePattern(pattern);
  return {
    pattern,
    regex,
    keys,
    score: routeScore(pattern),
    definition: normalized
  };
}

function isRouteDefinitionObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertRouteDefinition(definition) {
  if (!isRouteDefinitionObject(definition)) {
    throw new TypeError("Route definition must be a partial id string or route object.");
  }
  if (definition.render != null && !routeRenderModes.has(definition.render)) {
    throw new TypeError(`Unknown route render mode "${definition.render}".`);
  }
  if (definition.boundary != null && (typeof definition.boundary !== "string" || definition.boundary.length === 0)) {
    throw new TypeError("Route boundary must be a non-empty string.");
  }
  if (definition.subBoundary != null && (typeof definition.subBoundary !== "string" || definition.subBoundary.length === 0)) {
    throw new TypeError("Route subBoundary must be a non-empty string.");
  }
  if (
    definition.viewKey != null &&
    typeof definition.viewKey !== "function" &&
    (typeof definition.viewKey !== "string" || definition.viewKey.length === 0)
  ) {
    throw new TypeError("Route viewKey must be a non-empty string or a function of the route match.");
  }
  if (definition.server != null && typeof definition.server !== "boolean") {
    throw new TypeError("Route server must be a boolean.");
  }
}

function compilePattern(pattern) {
  const keys = [];
  if (pattern === "*") {
    return { regex: /^.*$/, keys };
  }
  if (pattern === "/") {
    return { regex: /^\/$/, keys };
  }

  const segments = pattern.split("/");
  const source = segments
    .map((segment, index) => {
      if (segment.length > 1 && segment.startsWith("*")) {
        if (index !== segments.length - 1) {
          throw new TypeError(`Splat segment "${segment}" must be the last segment of "${pattern}".`);
        }
        keys.push({ name: segment.slice(1), splat: true });
        return "(.+)";
      }
      if (segment.startsWith(":")) {
        keys.push({ name: segment.slice(1), splat: false });
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

function isHashRoute(hash) {
  return typeof hash === "string" && hash.startsWith("#/");
}

function isPlainHashNavigation(target, current, anchor) {
  const href = anchor.getAttribute?.("href") ?? "";
  if (href.startsWith("#/") || isHashRoute(target.hash)) {
    return false;
  }
  if (!href.startsWith("#") && target.pathname !== current.pathname) {
    return false;
  }
  return Boolean(target.hash) && !isHashRoute(target.hash);
}

function assertRouterMode(mode) {
  if (!routerModes.has(mode)) {
    throw new TypeError(`Unknown router mode "${mode}".`);
  }
}

function assertRouterUrlMode(mode) {
  if (!routerUrlModes.has(mode)) {
    throw new TypeError(`Unknown router URL mode "${mode}".`);
  }
}

function assertRouterFallback(fallback) {
  if (!routerFallbackModes.has(fallback)) {
    throw new TypeError(`Unknown router fallback "${fallback}".`);
  }
}

function warnEmptyPartialHtml(boundary) {
  const key = String(boundary);
  if (emptyHtmlWarnings.has(key)) {
    return;
  }
  emptyHtmlWarnings.add(key);
  console.warn?.(`[async/router] partial returned html: undefined; boundary "${key}" was not swapped.`);
}

function shouldSwapRouteResult(result) {
  return Boolean(
    result &&
      result.status !== 204 &&
      Object.hasOwn(result, "html") &&
      result.html !== undefined &&
      result.html !== null &&
      !result.boundary &&
      !result.redirect
  );
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
      if (segment.startsWith("*")) {
        return score + 1;
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
