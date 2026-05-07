import type { Signal } from "./signals-lite.ts";

export type CacheInvalidateSignal = Signal<unknown> | {
  signal: Signal<unknown>;
  when?: (next: unknown, prev: unknown) => boolean;
};

export type CacheSetOptions = {
  ttl?: number;
  tags?: string[];
  deps?: string[];
  invalidateOn?: CacheInvalidateSignal[];
  meta?: Record<string, unknown>;
};

export type CacheEntry<T = unknown> = {
  key: string;
  value: T;
  updatedAt: number;
  expiresAt?: number;
  tags: string[];
  deps: string[];
  meta?: Record<string, unknown>;
};

type CacheEventType =
  | "set"
  | "delete"
  | "invalidate"
  | "expire"
  | "clear";

export type CacheEvent = {
  type: CacheEventType;
  key?: string;
  reason?: string;
};

function now() {
  return Date.now();
}

function toInvalidateSource(input: CacheInvalidateSignal) {
  if ("signal" in input) return input;
  return { signal: input };
}

function unique(values?: string[]) {
  if (!values?.length) return [];
  return [...new Set(values)];
}

export class CacheRegistry {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly listeners = new Set<(event: CacheEvent) => void>();
  private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly cleanups = new Map<string, Array<() => void>>();
  private readonly reverseDeps = new Map<string, Set<string>>();

  private emit(event: CacheEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  private clearTimer(key: string) {
    const timer = this.expiryTimers.get(key);
    if (!timer) return;
    clearTimeout(timer);
    this.expiryTimers.delete(key);
  }

  private clearCleanup(key: string) {
    const cleanupList = this.cleanups.get(key) ?? [];
    cleanupList.forEach((cleanup) => cleanup());
    this.cleanups.delete(key);
  }

  private unlinkDeps(key: string) {
    this.reverseDeps.forEach((dependents, depKey) => {
      dependents.delete(key);
      if (dependents.size === 0) this.reverseDeps.delete(depKey);
    });
  }

  private linkDeps(key: string, deps: string[]) {
    deps.forEach((dep) => {
      const set = this.reverseDeps.get(dep) ?? new Set<string>();
      set.add(key);
      this.reverseDeps.set(dep, set);
    });
  }

  private scheduleExpiry(entry: CacheEntry<unknown>) {
    this.clearTimer(entry.key);
    if (!entry.expiresAt) return;
    const ms = Math.max(0, entry.expiresAt - now());
    const timer = setTimeout(() => {
      this.invalidate(entry.key, "expired");
      this.emit({ type: "expire", key: entry.key });
    }, ms);
    this.expiryTimers.set(entry.key, timer);
  }

  private connectInvalidationSignals(key: string, invalidateOn: CacheInvalidateSignal[]) {
    if (!invalidateOn.length) return;
    const cleanupList = this.cleanups.get(key) ?? [];
    invalidateOn.forEach((source) => {
      const target = toInvalidateSource(source);
      const unsubscribe = target.signal.subscribe((next, prev) => {
        if (target.when && !target.when(next, prev)) return;
        this.invalidate(key, "signal");
      });
      cleanupList.push(unsubscribe);
    });
    this.cleanups.set(key, cleanupList);
  }

  set<T>(key: string, value: T, options?: CacheSetOptions) {
    const ttl = options?.ttl;
    const next: CacheEntry<T> = {
      key,
      value,
      updatedAt: now(),
      expiresAt: ttl && ttl > 0 ? now() + ttl : undefined,
      tags: unique(options?.tags),
      deps: unique(options?.deps),
      meta: options?.meta,
    };

    this.clearCleanup(key);
    this.unlinkDeps(key);
    this.store.set(key, next as CacheEntry<unknown>);
    this.linkDeps(key, next.deps);
    this.connectInvalidationSignals(key, options?.invalidateOn ?? []);
    this.scheduleExpiry(next as CacheEntry<unknown>);
    this.emit({ type: "set", key });
    return value;
  }

  get<T>(key: string, options?: { allowExpired?: boolean }) {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (!options?.allowExpired && this.isExpired(key)) {
      this.delete(key, "expired");
      return undefined;
    }
    return entry.value;
  }

  getOrSet<T>(
    key: string,
    fallback: T | (() => T),
    options?: CacheSetOptions,
  ) {
    const current = this.get<T>(key);
    if (current !== undefined) return current;
    const next = typeof fallback === "function"
      ? (fallback as () => T)()
      : fallback;
    return this.set(key, next, options);
  }

  entry<T>(key: string, options?: { allowExpired?: boolean }) {
    const cached = this.store.get(key) as CacheEntry<T> | undefined;
    if (!cached) return undefined;
    if (!options?.allowExpired && this.isExpired(key)) {
      this.delete(key, "expired");
      return undefined;
    }
    return cached;
  }

  has(key: string) {
    return this.get(key) !== undefined;
  }

  isExpired(key: string) {
    const entry = this.store.get(key);
    if (!entry?.expiresAt) return false;
    return now() >= entry.expiresAt;
  }

  delete(key: string, reason = "manual") {
    const existed = this.store.delete(key);
    this.clearTimer(key);
    this.clearCleanup(key);
    this.unlinkDeps(key);
    if (existed) {
      this.emit({ type: "delete", key, reason });
    }
    return existed;
  }

  invalidate(key: string, reason = "manual") {
    const didDelete = this.delete(key, reason);
    if (!didDelete) return false;
    this.invalidateDependents(key, "dependency");
    this.emit({ type: "invalidate", key, reason });
    return didDelete;
  }

  invalidateDependents(key: string, reason = "dependency") {
    const dependents = [...(this.reverseDeps.get(key) ?? [])];
    dependents.forEach((dependentKey) => {
      this.delete(dependentKey, reason);
    });
    return dependents.length;
  }

  invalidateByTag(tag: string, reason = "tag") {
    const targets: string[] = [];
    this.store.forEach((entry, key) => {
      if (entry.tags.includes(tag)) targets.push(key);
    });
    targets.forEach((key) => this.invalidate(key, reason));
    return targets.length;
  }

  clear(reason = "manual") {
    [...this.store.keys()].forEach((key) => this.delete(key, reason));
    this.emit({ type: "clear", reason });
  }

  keys() {
    return [...this.store.keys()];
  }

  entries() {
    return [...this.store.entries()];
  }

  subscribe(listener: (event: CacheEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export function createCacheRegistry() {
  return new CacheRegistry();
}

export const globalCacheRegistry = createCacheRegistry();
