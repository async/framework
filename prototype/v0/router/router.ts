import { signal } from "../signals/index.ts";

export type Route = {
  path: string;
  params: Record<string, string>;
};

export type RouterConfig = {
  base: string;
  mode?: "hash" | "history";
};

function mergeUrl(
  base: string,
  path: string,
  isHash: boolean,
  params?: Record<string, string>,
) {
  // Early return if no params
  if (!params || Object.keys(params).length === 0) {
    if (isHash) {
      const cleanPath = path.replace(/^\//, "");
      return `#/${cleanPath}`;
    }
    const uri = base + path.replace(/^\//, "");
    return uri.endsWith("/") ? uri : uri + "/";
  }

  // Handle params if they exist
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, value);
  }
  const search = `?${searchParams.toString()}`;

  if (isHash) {
    const cleanPath = path.replace(/^\//, "");
    return `#/${cleanPath}${search}`;
  }

  const uri = base + path.replace(/^\//, "");
  return (uri.endsWith("/") ? uri : uri + "/") + search;
}

function extractParams(url: string): Record<string, string> {
  const [, search] = url.split("?");
  if (!search) return {};

  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(search);
  for (const [key, value] of searchParams.entries()) {
    params[key] = value;
  }
  return params;
}

function removeBase(base: string, path: string, isHash: boolean) {
  // Split path and search params
  const [pathPart] = path.split("?");
  let uri = isHash ? pathPart.replace(/^#\/?/, "") : pathPart.replace(base, "");

  if (!uri.startsWith("/")) {
    uri = "/" + uri;
  }
  if (!uri.endsWith("/")) {
    uri = uri + "/";
  }
  uri = uri.replace(/\/\//g, "/");
  return uri;
}

export function createRouter(config: RouterConfig) {
  const { base, mode = "hash" } = config;
  const isHash = mode === "hash";
  const normalizedBase = base.endsWith("/") ? base : base + "/";

  // Get initial path and params
  const fullPath = isHash
    ? window.location.hash
    : window.location.pathname + window.location.search;
  const initialPath = removeBase(normalizedBase, fullPath, isHash);
  const initialParams = extractParams(fullPath);

  console.log(`Router.${mode}`, fullPath, initialPath, initialParams);

  const currentRoute = signal<Route>({
    path: initialPath,
    params: initialParams,
  });
  const previousRoute = signal<Route | null>(null);

  // Handle routing events based on mode
  if (isHash) {
    window.addEventListener("hashchange", () => {
      const fullPath = window.location.hash;
      const currentPath = removeBase(normalizedBase, fullPath, true);
      const params = extractParams(fullPath);

      console.log("Router.hashchange", currentPath, params);
      previousRoute.value = currentRoute.value;
      currentRoute.value = { path: currentPath, params };
    });
  } else {
    window.addEventListener("popstate", () => {
      const fullPath = window.location.pathname + window.location.search;
      const currentPath = removeBase(normalizedBase, fullPath, false);
      const params = extractParams(fullPath);

      console.log("Router.popstate", currentPath, params);
      previousRoute.value = currentRoute.value;
      currentRoute.value = { path: currentPath, params };
    });
  }

  return {
    current: currentRoute,
    previous: previousRoute,
    initialize() {
      if (isHash && !window.location.hash) {
        this.navigate("/", {});
      } else if (!isHash) {
        this.navigate("/", {});
      } else {
        const fullPath = window.location.hash;
        const currentPath = removeBase(normalizedBase, fullPath, true);
        const params = extractParams(fullPath);

        currentRoute.value = { path: currentPath, params };
        previousRoute.value = null;
      }
      console.log(`Router.initialize.${mode}`, normalizedBase);
    },
    navigate(path: string, params: Record<string, string> = {}) {
      if (!path.endsWith("/")) {
        path = path + "/";
      }

      const uri = mergeUrl(normalizedBase, path, isHash, params);
      console.log("Router.navigate", uri, params);

      if (isHash) {
        window.location.hash = uri;
      } else {
        window.history.pushState({}, "", uri);
      }

      const routeUrl = removeBase(normalizedBase, path, isHash);
      console.log("Router.navigate.routeUrl", routeUrl, params);
      previousRoute.value = currentRoute.value;
      currentRoute.value = { path: routeUrl, params };
    },
  };
}
