const asyncSignalKind = Symbol.for("@async/framework.asyncSignal");

export function asyncSignal(id, fn) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("asyncSignal(id, fn) requires a non-empty string id.");
  }
  if (typeof fn !== "function") {
    throw new TypeError("asyncSignal(id, fn) requires a function.");
  }

  let value;
  let loading = false;
  let error = null;
  let status = "idle";
  let version = 0;
  let registry;
  let registeredId = id;
  let activeController;
  let activeAbort;
  const subscribers = new Set();
  const dependencyCleanups = new Set();

  const state = {
    [asyncSignalKind]: true,
    kind: "async-signal",

    get id() {
      return registeredId;
    },

    get value() {
      return value;
    },

    get loading() {
      return loading;
    },

    get error() {
      return error;
    },

    get status() {
      return status;
    },

    get version() {
      return version;
    },

    set(nextValue) {
      value = nextValue;
      loading = false;
      error = null;
      status = "ready";
      notify();
      return value;
    },

    refresh() {
      if (!registry) {
        throw new Error(`Async signal "${registeredId}" is not registered.`);
      }

      if (activeAbort && !activeAbort.aborted) {
        activeAbort.cancel(new Error(`Async signal "${registeredId}" refreshed.`));
      }

      const runVersion = version + 1;
      version = runVersion;
      loading = true;
      error = null;
      status = "loading";

      const controller = new AbortController();
      activeController = controller;
      activeAbort = controller.signal;
      attachCancel(activeAbort, controller);
      notify();

      const context = {
        signals: registry,
        id: registeredId,
        get server() {
          const context = registry._context?.() ?? {};
          const server = context.server;
          if (typeof server?._withContext === "function") {
            return server._withContext({
              signals: registry,
              router: context.router,
              loader: context.loader,
              cache: context.cache,
              abort: activeAbort,
              scheduler: context.scheduler
            });
          }
          return server;
        },
        get router() {
          return registry._context?.().router;
        },
        get loader() {
          return registry._context?.().loader;
        },
        get cache() {
          return registry._context?.().cache;
        },
        get scheduler() {
          return registry._context?.().scheduler;
        },
        get version() {
          return runVersion;
        },
        get abort() {
          return activeAbort;
        },
        refresh() {
          return state.refresh();
        }
      };

      let outcome;
      try {
        outcome = registry._collectDependencies(() => fn.call(context));
      } catch (cause) {
        finishError(runVersion, cause);
        return Promise.reject(cause);
      }

      syncDependencies(outcome.dependencies);

      return Promise.resolve(outcome.value).then(
        (nextValue) => {
          if (!isCurrent(runVersion)) {
            return value;
          }
          value = nextValue;
          loading = false;
          error = null;
          status = "ready";
          notify();
          return value;
        },
        (cause) => {
          if (!isCurrent(runVersion)) {
            return value;
          }
          if (activeAbort?.aborted) {
            loading = false;
            status = value === undefined ? "idle" : "ready";
            notify();
            return value;
          }
          finishError(runVersion, cause);
          return value;
        }
      );
    },

    cancel(reason) {
      if (activeAbort && !activeAbort.aborted) {
        activeAbort.cancel(reason);
      }
    },

    subscribe(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("subscribe(fn) requires a function.");
      }
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },

    snapshot() {
      return {
        value,
        loading,
        error,
        status,
        version
      };
    },

    _cloneSignalDeclaration() {
      return asyncSignal(id, fn);
    },

    _restore(snapshot = {}) {
      if (!isAsyncSignalSnapshot(snapshot)) {
        return state.set(snapshot);
      }
      if (activeAbort && !activeAbort.aborted) {
        activeAbort.cancel(new Error(`Async signal "${registeredId}" restored from snapshot.`));
      }
      value = snapshot.value;
      loading = Boolean(snapshot.loading);
      error = snapshot.error ?? null;
      status = typeof snapshot.status === "string" ? snapshot.status : inferStatus({ value, loading, error });
      if (Number.isFinite(snapshot.version)) {
        version = snapshot.version;
      }
      notify();
      return state;
    },

    _bindRegistry(nextRegistry, nextId) {
      registry = nextRegistry;
      registeredId = nextId;
      const start = () => {
        if (registry === nextRegistry && status === "idle") {
          state.refresh();
        }
      };
      const scheduler = registry._context?.().scheduler;
      if (scheduler) {
        scheduler.enqueue("async", start, {
          scope: registeredId,
          key: `asyncSignal:${registeredId}:initial`
        });
      } else {
        queueMicrotask(start);
      }
    },

    _dispose() {
      state.cancel(new Error(`Async signal "${registeredId}" disposed.`));
      for (const cleanup of dependencyCleanups) {
        cleanup();
      }
      dependencyCleanups.clear();
      subscribers.clear();
    }
  };

  function finishError(runVersion, cause) {
    if (!isCurrent(runVersion)) {
      return;
    }
    loading = false;
    error = cause;
    status = "error";
    notify();
  }

  function isCurrent(runVersion) {
    return runVersion === version && activeController?.signal === activeAbort;
  }

  function syncDependencies(dependencies) {
    for (const cleanup of dependencyCleanups) {
      cleanup();
    }
    dependencyCleanups.clear();

    for (const dependency of dependencies) {
      const dependencyId = String(dependency).split(".")[0];
      if (dependencyId && dependencyId !== registeredId) {
        dependencyCleanups.add(registry.subscribe(dependency, () => scheduleRefresh()));
      }
    }
  }

  function scheduleRefresh() {
    if (activeAbort && !activeAbort.aborted) {
      activeAbort.cancel(new Error(`Async signal "${registeredId}" dependency changed.`));
    }
    const scheduler = registry?._context?.().scheduler;
    if (!scheduler) {
      state.refresh();
      return;
    }
    scheduler.enqueue("async", () => state.refresh(), {
      scope: registeredId,
      key: `asyncSignal:${registeredId}:refresh`
    });
  }

  function notify() {
    for (const subscriber of [...subscribers]) {
      subscriber(state);
    }
  }

  return state;
}

export function isAsyncSignal(value) {
  return Boolean(value?.[asyncSignalKind]);
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

function inferStatus({ value, loading, error }) {
  if (loading) {
    return "loading";
  }
  if (error) {
    return "error";
  }
  return value === undefined ? "idle" : "ready";
}

function attachCancel(signal, controller) {
  Object.defineProperty(signal, "cancel", {
    configurable: true,
    enumerable: false,
    value(reason) {
      controller.abort(reason);
    }
  });
}
