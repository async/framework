import { defineAsyncSignal } from "@async/flow/define";

const asyncSignalKind = Symbol.for("@async/framework.asyncSignal");

export function asyncSignal(id, fn) {
  if (typeof id === "function" && fn === undefined) {
    return defineAsyncSignal(id);
  }

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
  let activeRun;
  let executionToken = 0;
  let disposed = false;
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
      if (!registry || disposed) {
        throw new Error(`Async signal "${registeredId}" is not registered.`);
      }

      cancelRun(activeRun, new Error(`Async signal "${registeredId}" refreshed.`));

      const runRegistry = registry;
      const runId = registeredId;
      const runVersion = version + 1;
      version = runVersion;
      loading = true;
      error = null;
      status = "loading";

      const run = createRun(runRegistry, runId, runVersion);
      activeRun = run;
      notify();

      const context = createRunContext(run);

      let outcome;
      try {
        outcome = runRegistry._collectDependencies(() => fn.call(context));
      } catch (cause) {
        finishError(run, cause);
        return Promise.reject(cause);
      }

      syncDependencies(outcome.dependencies, run);

      return Promise.resolve(outcome.value).then(
        (nextValue) => {
          if (!isRunCurrent(run)) {
            return value;
          }
          value = nextValue;
          loading = false;
          error = null;
          status = "ready";
          activeRun = undefined;
          notify();
          return value;
        },
        (cause) => {
          if (!isRunCurrent(run)) {
            return value;
          }
          finishError(run, cause);
          return value;
        }
      );
    },

    cancel(reason) {
      cancelCurrentRun(reason, { settle: true, notifyChange: true });
      return value;
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
        value: value === undefined && error !== null ? null : value,
        loading,
        error: serializeAsyncError(error),
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
      cancelCurrentRun(new Error(`Async signal "${registeredId}" restored from snapshot.`));
      value = snapshot.value;
      loading = Boolean(snapshot.loading);
      error = restoreAsyncError(snapshot.error);
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
        if (!disposed && registry === nextRegistry && status === "idle") {
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
      if (disposed) {
        return;
      }
      disposed = true;
      cancelQueuedWork();
      cancelCurrentRun(new Error(`Async signal "${registeredId}" disposed.`));
      for (const cleanup of dependencyCleanups) {
        cleanup();
      }
      dependencyCleanups.clear();
      subscribers.clear();
      registry = undefined;
    }
  };

  function createRun(runRegistry, runId, runVersion) {
    const controller = new AbortController();
    const abort = controller.signal;
    const runContext = captureRunContext(runRegistry, abort);
    const run = {
      token: ++executionToken,
      version: runVersion,
      registry: runRegistry,
      id: runId,
      controller,
      abort,
      ...runContext
    };
    attachCancel(abort, controller, (reason) => {
      cancelRun(run, reason, { settle: true, notifyChange: true });
    });
    return run;
  }

  function captureRunContext(runRegistry, abort) {
    const context = runRegistry._context?.() ?? {};
    const serverContext = {
      signals: runRegistry,
      router: context.router,
      loader: context.loader,
      cache: context.cache,
      abort,
      scheduler: context.scheduler
    };
    const server = typeof context.server?._withContext === "function"
      ? context.server._withContext(serverContext)
      : context.server;

    return {
      signals: runRegistry,
      server,
      router: context.router,
      loader: context.loader,
      cache: context.cache,
      scheduler: context.scheduler
    };
  }

  function createRunContext(run) {
    return {
      signals: run.signals,
      id: run.id,
      get server() {
        return run.server;
      },
      get router() {
        return run.router;
      },
      get loader() {
        return run.loader;
      },
      get cache() {
        return run.cache;
      },
      get scheduler() {
        return run.scheduler;
      },
      get version() {
        return run.version;
      },
      get abort() {
        return run.abort;
      },
      refresh() {
        return state.refresh();
      }
    };
  }

  function finishError(run, cause) {
    if (!isRunCurrent(run)) {
      return;
    }
    loading = false;
    error = cause;
    status = "error";
    activeRun = undefined;
    notify();
  }

  function isRunCurrent(run) {
    return Boolean(run)
      && !disposed
      && activeRun === run
      && run.token === executionToken
      && run.registry === registry
      && run.id === registeredId
      && !run.abort.aborted;
  }

  function cancelCurrentRun(reason, options = {}) {
    const run = activeRun;
    const shouldSettle = Boolean(run) || loading;
    if (run) {
      cancelRun(run, reason);
    } else if (shouldSettle) {
      executionToken += 1;
    }
    if (options.settle && shouldSettle && !disposed) {
      settleCanceled(options.notifyChange);
    }
  }

  function cancelRun(run, reason, options = {}) {
    if (!run) {
      return;
    }
    const wasActive = activeRun === run;
    if (wasActive) {
      executionToken += 1;
      activeRun = undefined;
    }
    if (!run.abort.aborted) {
      run.controller.abort(reason);
    }
    if (wasActive && options.settle && !disposed) {
      settleCanceled(options.notifyChange);
    }
  }

  function settleCanceled(notifyChange = false) {
    const nextStatus = value === undefined ? "idle" : "ready";
    const changed = loading || error !== null || status !== nextStatus;
    loading = false;
    error = null;
    status = nextStatus;
    if (notifyChange && changed) {
      notify();
    }
  }

  function syncDependencies(dependencies, run) {
    if (!isRunCurrent(run)) {
      return;
    }
    for (const cleanup of dependencyCleanups) {
      cleanup();
    }
    dependencyCleanups.clear();

    for (const dependency of dependencies) {
      const dependencyId = String(dependency).split(".")[0];
      if (dependencyId && dependencyId !== registeredId) {
        dependencyCleanups.add(run.registry.subscribe(dependency, () => scheduleRefresh()));
      }
    }
  }

  function scheduleRefresh() {
    if (disposed || !registry) {
      return;
    }
    cancelRun(activeRun, new Error(`Async signal "${registeredId}" dependency changed.`));
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

  function cancelQueuedWork() {
    const scheduler = registry?._context?.().scheduler;
    scheduler?.cancelScope?.(registeredId);
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

function serializeAsyncError(value) {
  if (value == null) {
    return null;
  }

  const record = {
    name: readErrorName(value),
    message: readErrorMessage(value)
  };
  const code = readErrorCode(value);
  if (code !== undefined) {
    record.code = code;
  }
  return record;
}

function restoreAsyncError(value) {
  return serializeAsyncError(value);
}

function readErrorName(value) {
  if (value && typeof value === "object" && typeof value.name === "string" && value.name.length > 0) {
    return value.name;
  }
  return "Error";
}

function readErrorMessage(value) {
  if (value instanceof Error) {
    return value.message;
  }
  if (value && typeof value === "object" && typeof value.message === "string") {
    return value.message;
  }
  return String(value);
}

function readErrorCode(value) {
  if (!value || typeof value !== "object" || !Object.hasOwn(value, "code")) {
    return undefined;
  }
  const code = value.code;
  return typeof code === "string" || typeof code === "number" ? code : undefined;
}

function attachCancel(signal, controller, onCancel) {
  Object.defineProperty(signal, "cancel", {
    configurable: true,
    enumerable: false,
    value(reason) {
      if (typeof onCancel === "function") {
        onCancel(reason);
        return;
      }
      controller.abort(reason);
    }
  });
}
