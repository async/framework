const defaultPhases = ["binding", "lifecycle", "effect", "async", "post"];

export function createScheduler(options = {}) {
  const phases = [...(options.phases ?? defaultPhases)];
  const queues = new Map(phases.map((phase) => [phase, []]));
  const keyedJobs = new Map();
  const destroyedObjectScopes = new WeakSet();
  const destroyedPrimitiveScopes = new Set();
  const objectScopeIds = new WeakMap();
  const onError = typeof options.onError === "function" ? options.onError : undefined;
  const maxDepth = options.maxDepth ?? 100;
  const strategy = options.strategy ?? "microtask";
  let destroyed = false;
  let flushing = false;
  let scheduled = false;
  let batchDepth = 0;
  let jobCounter = 0;
  let scopeCounter = 0;

  const api = {
    strategy,
    phases,

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

    async flush() {
      assertActive();
      if (flushing) {
        return;
      }
      scheduled = false;
      flushing = true;
      let depth = 0;
      try {
        while (hasJobs()) {
          depth += 1;
          if (depth > maxDepth) {
            throw new Error(`Scheduler exceeded maxDepth ${maxDepth}.`);
          }
          for (const phase of phases) {
            await flushPhase(phase);
          }
        }
      } finally {
        flushing = false;
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
      try {
        while (hasJobsForScope(scope)) {
          depth += 1;
          if (depth > maxDepth) {
            throw new Error(`Scheduler exceeded maxDepth ${maxDepth}.`);
          }
          for (const phase of phases) {
            await flushPhase(phase, scope);
          }
        }
      } finally {
        flushing = false;
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
        scheduled
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
        void api.flush();
      }
    });
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
          throw error;
        }
      }
    }
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

function scheduleMicrotask(fn) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(fn);
    return;
  }
  Promise.resolve().then(fn);
}

function noop() {}
