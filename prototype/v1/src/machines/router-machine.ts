import { createRunMachine } from "../agentic.ts";
import { signal } from "../signals-lite.ts";

export type RouteRecord = {
  id: string;
  path: string;
};

type RouterState = "idle" | "ready" | "navigating" | "not_found";

function normalizePath(path: string) {
  if (!path) return "/";
  const trimmed = path.startsWith("/") ? path : `/${path}`;
  return trimmed.replace(/\/+$/g, "") || "/";
}

function toPattern(path: string) {
  const keys: string[] = [];
  const pattern = normalizePath(path)
    .replace(/:[^/]+/g, (segment) => {
      keys.push(segment.slice(1));
      return "([^/]+)";
    });
  return {
    keys,
    regex: new RegExp(`^${pattern}$`),
  };
}

function match(path: string, routes: RouteRecord[]) {
  const normalized = normalizePath(path);
  for (const route of routes) {
    const { regex, keys } = toPattern(route.path);
    const result = normalized.match(regex);
    if (!result) continue;

    const params: Record<string, string> = {};
    keys.forEach((key, index) => {
      params[key] = result[index + 1];
    });

    return {
      route,
      path: normalized,
      params,
    };
  }
  return null;
}

export function createRouterMachine(config: {
  routes: RouteRecord[];
  initialPath?: string;
  mode?: "history" | "hash";
}) {
  const machine = createRunMachine<RouterState>("idle", {
    idle: { INIT: "ready", NAVIGATE: "navigating" },
    ready: { NAVIGATE: "navigating" },
    navigating: { RESOLVE: "ready", REJECT: "not_found" },
    not_found: { NAVIGATE: "navigating" },
  });

  const mode = config.mode ?? "history";
  const current = signal({
    path: normalizePath(config.initialPath ?? "/"),
    route: null as RouteRecord | null,
    params: {} as Record<string, string>,
  });

  const lastEvent = signal("INIT");

  function navigate(path: string, options?: { replace?: boolean }) {
    lastEvent.value = "NAVIGATE";
    machine.send({ type: "NAVIGATE", path });

    const found = match(path, config.routes);
    if (!found) {
      machine.send({ type: "REJECT", path });
      current.value = {
        path: normalizePath(path),
        route: null,
        params: {},
      };
      return current.value;
    }

    current.value = found;
    machine.send({ type: "RESOLVE", path, routeId: found.route.id });

    if (typeof window !== "undefined") {
      if (mode === "hash") {
        window.location.hash = `#${found.path}`;
      } else if (options?.replace) {
        window.history.replaceState({}, "", found.path);
      } else {
        window.history.pushState({}, "", found.path);
      }
    }

    return current.value;
  }

  function start() {
    const path = typeof window === "undefined"
      ? current.value.path
      : mode === "hash"
      ? normalizePath(window.location.hash.replace(/^#/, "") || "/")
      : normalizePath(window.location.pathname || "/");

    machine.send({ type: "INIT" });
    navigate(path, { replace: true });

    if (typeof window !== "undefined") {
      const onChange = () => {
        const nextPath = mode === "hash"
          ? normalizePath(window.location.hash.replace(/^#/, "") || "/")
          : normalizePath(window.location.pathname || "/");
        navigate(nextPath, { replace: true });
      };
      if (mode === "hash") {
        window.addEventListener("hashchange", onChange);
      } else {
        window.addEventListener("popstate", onChange);
      }
      return () => {
        if (mode === "hash") {
          window.removeEventListener("hashchange", onChange);
        } else {
          window.removeEventListener("popstate", onChange);
        }
      };
    }

    return () => {};
  }

  return {
    machine,
    current,
    lastEvent,
    navigate,
    start,
    match: (path: string) => match(path, config.routes),
  };
}
