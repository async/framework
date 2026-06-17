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
          return registry._context?.().server;
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

    _bindRegistry(nextRegistry, nextId) {
      registry = nextRegistry;
      registeredId = nextId;
      queueMicrotask(() => {
        if (registry === nextRegistry && status === "idle") {
          state.refresh();
        }
      });
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
        dependencyCleanups.add(registry.subscribe(dependency, () => state.refresh()));
      }
    }
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

function attachCancel(signal, controller) {
  Object.defineProperty(signal, "cancel", {
    configurable: true,
    enumerable: false,
    value(reason) {
      controller.abort(reason);
    }
  });
}
