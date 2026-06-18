const defaultRecentLimit = 50;

export function createBoundaryReceiver(options = {}) {
  const loader = options.loader;
  const signals = options.signals ?? loader?.signals;
  const cache = options.cache ?? loader?.cache;
  const scheduler = options.scheduler ?? loader?.scheduler;
  const router = options.router ?? loader?.router;
  const recentLimit = options.recentLimit ?? defaultRecentLimit;
  const throwOnError = options.throwOnError === true;
  const onApply = typeof options.onApply === "function" ? options.onApply : undefined;
  const onIgnore = typeof options.onIgnore === "function" ? options.onIgnore : undefined;
  const onError = typeof options.onError === "function" ? options.onError : undefined;
  const isScopeDestroyed = typeof options.isScopeDestroyed === "function"
    ? options.isScopeDestroyed
    : (scope) => scheduler?.isScopeDestroyed?.(scope) ?? scheduler?.inspectDestroyed?.(scope) ?? false;

  if (!loader || typeof loader.swap !== "function") {
    throw new TypeError("createBoundaryReceiver(...) requires a loader with swap(boundary, html).");
  }
  if (!Number.isInteger(recentLimit) || recentLimit < 0) {
    throw new TypeError("createBoundaryReceiver(...) recentLimit must be a non-negative integer.");
  }

  const boundaries = new Map();
  const recent = [];
  let destroyed = false;

  const receiver = {
    async apply(patch) {
      if (destroyed) {
        throw new Error("Boundary receiver has been destroyed.");
      }

      const normalized = validatePatch(patch);
      const record = boundaryRecord(normalized.boundary);
      let releasePending;
      const previousPending = record.pending ?? Promise.resolve();
      const pending = new Promise((resolve) => {
        releasePending = resolve;
      });
      record.pending = pending;

      try {
        await previousPending;
        if (destroyed) {
          throw new Error("Boundary receiver has been destroyed.");
        }
        return await applyBoundaryPatch(record, normalized, patch);
      } finally {
        releasePending();
        if (record.pending === pending) {
          record.pending = undefined;
        }
      }
    },

    inspect() {
      const snapshot = {};
      for (const [boundary, record] of boundaries) {
        snapshot[boundary] = {
          lastSeq: record.lastSeq,
          applied: record.applied,
          ignored: record.ignored,
          lastStatus: record.lastStatus
        };
        if (record.errored > 0) {
          snapshot[boundary].errored = record.errored;
        }
      }
      return {
        destroyed,
        boundaries: snapshot,
        recent: recent.map((entry) => ({ ...entry }))
      };
    },

    reset(boundary) {
      if (boundary === undefined) {
        boundaries.clear();
        recent.length = 0;
        return receiver;
      }
      assertBoundary(boundary);
      boundaries.delete(boundary);
      for (let index = recent.length - 1; index >= 0; index -= 1) {
        if (recent[index].boundary === boundary) {
          recent.splice(index, 1);
        }
      }
      return receiver;
    },

    destroy() {
      destroyed = true;
      boundaries.clear();
      recent.length = 0;
    }
  };

  return receiver;

  async function applyBoundaryPatch(record, normalized, patch) {
    if (normalized.seq <= record.lastSeq) {
      const result = {
        status: "ignored-stale",
        boundary: normalized.boundary,
        seq: normalized.seq,
        lastSeq: record.lastSeq
      };
      record.ignored += 1;
      record.lastStatus = result.status;
      remember(result);
      onIgnore?.(result, patch);
      return result;
    }

    if (normalized.parentScope !== undefined && isScopeDestroyed(normalized.parentScope)) {
      const result = {
        status: "ignored-destroyed",
        boundary: normalized.boundary,
        seq: normalized.seq,
        parentScope: normalized.parentScope
      };
      record.ignored += 1;
      record.lastStatus = result.status;
      remember(result);
      onIgnore?.(result, patch);
      return result;
    }

    if (Object.hasOwn(normalized, "error")) {
      const error = toStableError(normalized.error);
      const result = {
        status: "errored",
        boundary: normalized.boundary,
        seq: normalized.seq,
        error
      };
      record.lastSeq = normalized.seq;
      record.errored += 1;
      record.lastStatus = result.status;
      remember(result);
      onError?.(error, result, patch);
      if (throwOnError) {
        throw error;
      }
      return result;
    }

    if (normalized.signals) {
      if (!signals || typeof signals.set !== "function") {
        throw new Error("Boundary patch includes signals, but no signal registry is available.");
      }
      for (const [path, value] of Object.entries(normalized.signals)) {
        signals.set(path, value);
      }
    }

    if (normalized.cache?.browser) {
      if (!cache || typeof cache.restore !== "function") {
        throw new Error("Boundary patch includes browser cache, but no cache registry is available.");
      }
      cache.restore(normalized.cache.browser);
    }

    if (normalized.html != null) {
      loader.swap(normalized.boundary, normalized.html);
    }

    await flushScheduler(scheduler, normalized.scope);

    if (normalized.redirect) {
      const result = {
        status: "redirected",
        boundary: normalized.boundary,
        seq: normalized.seq,
        redirect: normalized.redirect
      };
      await followRedirect(normalized.redirect, router, loader);
      record.applied += 1;
      record.lastSeq = normalized.seq;
      record.lastStatus = result.status;
      remember(result);
      onApply?.(result, patch);
      return result;
    }

    const result = {
      status: "applied",
      boundary: normalized.boundary,
      seq: normalized.seq
    };
    record.applied += 1;
    record.lastSeq = normalized.seq;
    record.lastStatus = result.status;
    remember(result);
    onApply?.(result, patch);
    return result;
  }

  function boundaryRecord(boundary) {
    if (!boundaries.has(boundary)) {
      boundaries.set(boundary, {
        lastSeq: -Infinity,
        applied: 0,
        ignored: 0,
        errored: 0,
        lastStatus: undefined,
        pending: undefined
      });
    }
    return boundaries.get(boundary);
  }

  function remember(result) {
    if (recentLimit === 0) {
      return;
    }
    recent.push(toRecentEntry(result));
    while (recent.length > recentLimit) {
      recent.shift();
    }
  }
}

function validatePatch(patch) {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new TypeError("receiver.apply(patch) requires a boundary patch object.");
  }

  assertBoundary(patch.boundary);
  if (typeof patch.seq !== "number" || !Number.isFinite(patch.seq)) {
    throw new TypeError("Boundary patch seq must be a finite number.");
  }

  if (patch.signals !== undefined && !isPlainObject(patch.signals)) {
    throw new TypeError("Boundary patch signals must be an object.");
  }
  if (patch.cache !== undefined && !isPlainObject(patch.cache)) {
    throw new TypeError("Boundary patch cache must be an object.");
  }
  if (patch.cache?.browser !== undefined && !isPlainObject(patch.cache.browser)) {
    throw new TypeError("Boundary patch cache.browser must be an object.");
  }
  if (patch.redirect !== undefined && (typeof patch.redirect !== "string" || patch.redirect.length === 0)) {
    throw new TypeError("Boundary patch redirect must be a non-empty string.");
  }
  if (patch.parentScope !== undefined && typeof patch.parentScope !== "string") {
    throw new TypeError("Boundary patch parentScope must be a string.");
  }
  if (patch.scope !== undefined && typeof patch.scope !== "string") {
    throw new TypeError("Boundary patch scope must be a string.");
  }

  const hasHtml = Object.hasOwn(patch, "html") && patch.html != null;
  const hasSignals = patch.signals && Object.keys(patch.signals).length > 0;
  const hasBrowserCache = patch.cache?.browser && Object.keys(patch.cache.browser).length > 0;
  const hasRedirect = Boolean(patch.redirect);
  const hasError = Object.hasOwn(patch, "error");
  if (!hasHtml && !hasSignals && !hasBrowserCache && !hasRedirect && !hasError) {
    throw new TypeError("Boundary patch must include html, signals, cache.browser, redirect, or error.");
  }

  return patch;
}

function assertBoundary(boundary) {
  if (typeof boundary !== "string" || boundary.length === 0) {
    throw new TypeError("Boundary patch boundary must be a non-empty string.");
  }
}

async function flushScheduler(scheduler, scope) {
  if (!scheduler) {
    return;
  }
  if (scope !== undefined && typeof scheduler.flushScope === "function") {
    await scheduler.flushScope(scope);
    return;
  }
  if (typeof scheduler.flush === "function") {
    await scheduler.flush();
  }
}

async function followRedirect(redirect, router, loader) {
  if (router && typeof router.navigate === "function") {
    await router.navigate(redirect);
    return;
  }
  const location = loader?.root?.ownerDocument?.defaultView?.location ?? globalThis.location;
  location?.assign?.(redirect);
}

function toStableError(value) {
  if (value instanceof Error) {
    return value;
  }
  if (value && typeof value === "object" && typeof value.message === "string") {
    return Object.assign(new Error(value.message), value);
  }
  return new Error(String(value));
}

function toRecentEntry(result) {
  const entry = {
    boundary: result.boundary,
    seq: result.seq,
    status: result.status
  };
  if (result.status === "ignored-stale") {
    entry.lastSeq = result.lastSeq;
  }
  if (result.status === "ignored-destroyed" && result.parentScope !== undefined) {
    entry.parentScope = result.parentScope;
  }
  if (result.status === "redirected") {
    entry.redirect = result.redirect;
  }
  return entry;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
