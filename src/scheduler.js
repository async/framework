const defaultPhases = ["binding", "lifecycle", "effect", "async", "commit", "post", "background"];

export function createScheduler(options = {}) {
  const phases = [...(options.phases ?? defaultPhases)];
  const queues = new Map(phases.map((phase) => [phase, []]));
  const keyedJobs = new Map();
  const flushWaiters = [];
  const destroyedObjectScopes = new WeakSet();
  const destroyedPrimitiveScopes = new Set();
  const objectScopeIds = new WeakMap();
  const onError = typeof options.onError === "function" ? options.onError : undefined;
  const maxDepth = options.maxDepth ?? 100;
  const strategy = options.strategy ?? "microtask";
  const requestFrame = typeof options.requestAnimationFrame === "function"
    ? options.requestAnimationFrame
    : typeof globalThis.requestAnimationFrame === "function"
      ? globalThis.requestAnimationFrame.bind(globalThis)
      : undefined;
  const requestIdle = typeof options.requestIdleCallback === "function"
    ? options.requestIdleCallback
    : typeof globalThis.requestIdleCallback === "function"
      ? globalThis.requestIdleCallback.bind(globalThis)
      : undefined;
  let destroyed = false;
  let flushing = false;
  let scheduled = false;
  let batchDepth = 0;
  let jobCounter = 0;
  let scopeCounter = 0;

  const api = {
    strategy,
    phases,
    timing: {
      commit: requestFrame ? "frame" : "sync",
      background: requestIdle ? "idle" : "sync"
    },

    batch(fn) {
      if (typeof fn !== "function") {
        throw new TypeError("scheduler.batch(fn) requires a function.");
      }
      assertActive();
      batchDepth += 1;
      let asyncBatch = false;
      try {
        const value = fn();
        if (value && typeof value.then === "function") {
          asyncBatch = true;
          return Promise.resolve(value).finally(() => {
            batchDepth -= 1;
            requestFlush();
          });
        }
        return value;
      } finally {
        if (!asyncBatch && batchDepth > 0) {
          batchDepth -= 1;
          requestFlush();
        }
      }
    },

    enqueue(phase, fn, options = {}) {
      assertActive();
      assertPhase(phase);
      if (typeof fn !== "function") {
        throw new TypeError("scheduler.enqueue(phase, fn) requires a function.");
      }
      const scope = options.scope;
      if (isScopeDestroyed(scope)) {
        return noop;
      }

      const dedupeKey = options.key === undefined ? undefined : `${phase}:${scopeKey(scope)}:${String(options.key)}`;
      if (dedupeKey && keyedJobs.has(dedupeKey)) {
        return keyedJobs.get(dedupeKey).cancel;
      }

      const job = {
        id: ++jobCounter,
        phase,
        fn,
        scope,
        boundary: options.boundary,
        key: dedupeKey,
        canceled: false,
        cancel() {
          job.canceled = true;
          if (job.key) {
            keyedJobs.delete(job.key);
          }
        }
      };
      queues.get(phase).push(job);
      if (job.key) {
        keyedJobs.set(job.key, job);
      }
      requestFlush();
      return job.cancel;
    },

    afterFlush(fn, options = {}) {
      return api.enqueue("post", fn, options);
    },

    commit(fn, options = {}) {
      if (typeof fn !== "function") {
        throw new TypeError("scheduler.commit(fn) requires a function.");
      }
      assertActive();
      if (!flushing && !requestFrame) {
        return runSynchronousCommit(fn, options.scope);
      }
      return enqueueCompletion("commit", fn, options);
    },

    async flush() {
      assertActive();
      if (flushing) {
        return;
      }
      scheduled = false;
      flushing = true;
      let depth = 0;
      let flushError;
      try {
        while (hasJobs()) {
          depth += 1;
          if (depth > maxDepth) {
            throw new Error(`Scheduler exceeded maxDepth ${maxDepth}.`);
          }
          for (const phase of phases) {
            if (hasEarlierJobs(phase)) {
              continue;
            }
            await flushPhase(phase);
          }
        }
      } catch (error) {
        flushError = error;
        throw error;
      } finally {
        flushing = false;
        settleFlushWaiters(flushError);
        if (hasJobs()) {
          requestFlush();
        }
      }
    },

    async flushScope(scope) {
      assertActive();
      if (flushing) {
        return;
      }
      scheduled = false;
      flushing = true;
      let depth = 0;
      let flushError;
      try {
        while (hasJobsForScope(scope)) {
          depth += 1;
          if (depth > maxDepth) {
            throw new Error(`Scheduler exceeded maxDepth ${maxDepth}.`);
          }
          for (const phase of phases) {
            if (hasEarlierJobs(phase, scope)) {
              continue;
            }
            await flushPhase(phase, scope);
          }
        }
      } catch (error) {
        flushError = error;
        throw error;
      } finally {
        flushing = false;
        settleFlushWaiters(flushError, scope);
        if (hasJobs()) {
          requestFlush();
        }
      }
    },

    cancelScope(scope) {
      if (scope === undefined) {
        return api;
      }
      for (const queue of queues.values()) {
        for (const job of queue) {
          if (job.scope === scope) {
            job.cancel();
          }
        }
      }
      return api;
    },

    markScopeDestroyed(scope) {
      if (scope !== undefined) {
        if (isObjectScope(scope)) {
          destroyedObjectScopes.add(scope);
        } else {
          destroyedPrimitiveScopes.add(scope);
        }
        api.cancelScope(scope);
      }
      return api;
    },

    reviveScope(scope) {
      if (scope !== undefined) {
        if (isObjectScope(scope)) {
          destroyedObjectScopes.delete(scope);
        } else {
          destroyedPrimitiveScopes.delete(scope);
        }
      }
      return api;
    },

    isScopeDestroyed(scope) {
      return isScopeDestroyed(scope);
    },

    inspect() {
      const counts = {};
      for (const [phase, queue] of queues) {
        counts[phase] = queue.filter((job) => !job.canceled).length;
      }
      return {
        strategy,
        phases: [...phases],
        pending: counts,
        scopesDestroyed: destroyedPrimitiveScopes.size,
        flushing,
        scheduled,
        timing: { ...api.timing }
      };
    },

    destroy() {
      destroyed = true;
      for (const queue of queues.values()) {
        for (const job of queue) {
          job.cancel();
        }
        queue.length = 0;
      }
      keyedJobs.clear();
      settleFlushWaiters(new Error("Scheduler has been destroyed."));
      destroyedPrimitiveScopes.clear();
    }
  };

  return api;

  function requestFlush() {
    if (strategy === "manual" || destroyed || flushing || batchDepth > 0 || scheduled) {
      return;
    }
    scheduled = true;
    scheduleMicrotask(() => {
      if (!destroyed) {
        void api.flush().catch(reportAutomaticFlushError);
      }
    });
  }

  function runSynchronousCommit(fn, scope) {
    let value;
    try {
      value = fn();
    } catch (error) {
      throw error;
    }
    return Promise.resolve(value).then(async (resolved) => {
      if (scope !== undefined && typeof api.flushScope === "function") {
        await api.flushScope(scope);
        return resolved;
      }
      await api.flush();
      return resolved;
    });
  }

  function enqueueCompletion(phase, fn, options = {}) {
    assertPhase(phase);
    if (isScopeDestroyed(options.scope)) {
      return Promise.reject(new Error(`Scheduler ${phase} job was canceled because its scope is destroyed.`));
    }
    let state = "pending";
    let value;
    let failure;
    return new Promise((resolve, reject) => {
      flushWaiters.push({ phase, scope: options.scope, resolve, reject, result });
      api.enqueue(phase, async () => {
        try {
          value = await fn();
          state = "fulfilled";
        } catch (error) {
          failure = error;
          state = "rejected";
          throw error;
        }
      }, options);
    });

    function result() {
      return { state, value, failure };
    }
  }

  function settleFlushWaiters(flushError, scope) {
    for (let index = 0; index < flushWaiters.length;) {
      const waiter = flushWaiters[index];
      if (scope !== undefined && waiter.scope !== scope) {
        index += 1;
        continue;
      }
      flushWaiters.splice(index, 1);
      const result = waiter.result();
      if (result.state === "fulfilled" && !flushError) {
        waiter.resolve(result.value);
        continue;
      }
      if (result.state === "rejected") {
        waiter.reject(result.failure);
        continue;
      }
      waiter.reject(flushError ?? new Error(`Scheduler ${waiter.phase} job did not run before flush completed.`));
    }
  }

  async function flushPhase(phase, scope) {
    const queue = queues.get(phase);
    const remaining = [];
    const runnable = [];

    for (const job of queue.splice(0)) {
      if (job.canceled) {
        continue;
      }
      if (scope !== undefined && job.scope !== scope) {
        remaining.push(job);
        continue;
      }
      runnable.push(job);
    }

    queue.push(...remaining);
    if (runnable.length === 0) {
      return;
    }

    await waitForPhase(phase);

    for (const job of runnable) {
      if (job.key) {
        keyedJobs.delete(job.key);
      }
      if (job.canceled || isScopeDestroyed(job.scope)) {
        continue;
      }
      try {
        await job.fn();
      } catch (error) {
        if (onError) {
          onError(error, job);
        } else {
          throw annotateSchedulerError(error, job);
        }
      }
    }
  }

  function hasEarlierJobs(phase, scope) {
    if (phase !== "post" && phase !== "background") {
      return false;
    }
    const index = phases.indexOf(phase);
    for (const previousPhase of phases.slice(0, index)) {
      const queue = queues.get(previousPhase);
      if (queue?.some((job) => !job.canceled && (scope === undefined || job.scope === scope))) {
        return true;
      }
    }
    return false;
  }

  async function waitForPhase(phase) {
    if (phase === "commit" && requestFrame) {
      await new Promise((resolve) => requestFrame(() => resolve()));
      return;
    }
    if (phase === "background" && requestIdle) {
      await new Promise((resolve) => requestIdle(() => resolve()));
    }
  }

  function reportAutomaticFlushError(error) {
    if (typeof globalThis.reportError === "function") {
      globalThis.reportError(error);
      return;
    }
    setTimeout(() => {
      throw error;
    }, 0);
  }

  function hasJobs() {
    for (const queue of queues.values()) {
      if (queue.some((job) => !job.canceled)) {
        return true;
      }
    }
    return false;
  }

  function hasJobsForScope(scope) {
    for (const queue of queues.values()) {
      if (queue.some((job) => !job.canceled && job.scope === scope)) {
        return true;
      }
    }
    return false;
  }

  function assertActive() {
    if (destroyed) {
      throw new Error("Scheduler has been destroyed.");
    }
  }

  function assertPhase(phase) {
    if (!queues.has(phase)) {
      throw new Error(`Unknown scheduler phase "${phase}".`);
    }
  }

  function scopeKey(scope) {
    if (scope === undefined) {
      return "global";
    }
    if ((typeof scope === "object" && scope !== null) || typeof scope === "function") {
      if (!objectScopeIds.has(scope)) {
        objectScopeIds.set(scope, `scope:${++scopeCounter}`);
      }
      return objectScopeIds.get(scope);
    }
    return String(scope);
  }

  function isScopeDestroyed(scope) {
    if (scope === undefined) {
      return false;
    }
    if (isObjectScope(scope)) {
      return destroyedObjectScopes.has(scope);
    }
    return destroyedPrimitiveScopes.has(scope);
  }
}

function isObjectScope(scope) {
  return (typeof scope === "object" && scope !== null) || typeof scope === "function";
}

function annotateSchedulerError(error, job) {
  if (!error || (typeof error !== "object" && typeof error !== "function")) {
    return error;
  }
  try {
    Object.defineProperty(error, "scheduler", {
      configurable: true,
      value: {
        phase: job.phase,
        scope: job.scope,
        key: job.key
      }
    });
  } catch {
    // Non-extensible thrown values still need to propagate through the chosen error channel.
  }
  return error;
}

function scheduleMicrotask(fn) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
    return;
  }
  Promise.resolve().then(fn);
}

function noop() {}
