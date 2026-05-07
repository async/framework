import { createRunMachine } from "../agentic.ts";
import {
  globalCacheRegistry,
  type CacheInvalidateSignal,
  type CacheRegistry,
  type CacheSetOptions,
} from "../cache-registry.ts";
import { signal } from "../signals-lite.ts";

type QueryStatus = "idle" | "loading" | "success" | "error" | "refreshing";

export type QueryKey = string | readonly unknown[];

export type QueryState<TData> = {
  status: QueryStatus;
  data?: TData;
  error?: unknown;
  updatedAt: number;
  isFetching: boolean;
  isStale: boolean;
};

export type QueryMachineConfig<TData> = {
  queryKey: QueryKey;
  queryFn: () => Promise<TData> | TData;
  staleTime?: number;
  initialData?: TData;
  cacheRegistry?: CacheRegistry;
  cache?: {
    ttl?: number;
    tags?: string[];
    deps?: string[];
    invalidateOn?: CacheInvalidateSignal[];
  };
};

type QueryCacheEntry<TData> = {
  data?: TData;
  error?: unknown;
  updatedAt: number;
  inflight?: Promise<TData>;
};

function serializeKey(queryKey: QueryKey) {
  return Array.isArray(queryKey) ? JSON.stringify(queryKey) : queryKey;
}

function now() {
  return Date.now();
}

function isStale(updatedAt: number, staleTime: number) {
  if (!updatedAt) return true;
  if (staleTime <= 0) return true;
  return now() - updatedAt >= staleTime;
}

export function createQueryMachine<TData>(config: QueryMachineConfig<TData>) {
  const machine = createRunMachine<QueryStatus>("idle", {
    idle: { FETCH: "loading", RESOLVE: "success", REJECT: "error", SET_DATA: "success" },
    loading: { RESOLVE: "success", REJECT: "error", FETCH: "loading" },
    success: { FETCH: "refreshing", INVALIDATE: "success", SET_DATA: "success" },
    refreshing: { RESOLVE: "success", REJECT: "error" },
    error: { FETCH: "loading", SET_DATA: "success" },
  });

  const key = serializeKey(config.queryKey);
  const staleTime = config.staleTime ?? 0;
  const cacheRegistry = config.cacheRegistry ?? globalCacheRegistry;
  const cached = cacheRegistry.get<QueryCacheEntry<TData>>(key);
  const initialData = cached?.data ?? config.initialData;
  const initialUpdatedAt = cached?.updatedAt ?? (initialData !== undefined ? now() : 0);

  const state = signal<QueryState<TData>>({
    status: initialData !== undefined ? "success" : "idle",
    data: initialData,
    error: cached?.error,
    updatedAt: initialUpdatedAt,
    isFetching: false,
    isStale: isStale(initialUpdatedAt, staleTime),
  });

  function update(partial: Partial<QueryState<TData>>) {
    state.value = {
      ...state.value,
      ...partial,
    };
  }

  function writeCache(entry: QueryCacheEntry<TData>) {
    const cacheOptions: CacheSetOptions = {
      ttl: config.cache?.ttl,
      tags: config.cache?.tags,
      deps: config.cache?.deps,
      invalidateOn: config.cache?.invalidateOn,
    };
    cacheRegistry.set(key, entry, cacheOptions);
  }

  function getCache() {
    return cacheRegistry.get<QueryCacheEntry<TData>>(key);
  }

  function fetchStatus() {
    return state.value.data === undefined ? "loading" : "refreshing";
  }

  function syncFromCache(source: "cache" | "inflight") {
    const cachedEntry = getCache();
    if (!cachedEntry) return undefined;
    const stale = isStale(cachedEntry.updatedAt, staleTime);
    const status = cachedEntry.error ? "error" : "success";
    machine.send({ type: cachedEntry.error ? "REJECT" : "RESOLVE", source });
    update({
      status,
      data: cachedEntry.data,
      error: cachedEntry.error,
      updatedAt: cachedEntry.updatedAt,
      isFetching: false,
      isStale: stale,
    });
    return cachedEntry.data;
  }

  async function runFetch(options?: { force?: boolean }) {
    const force = options?.force ?? false;
    const cachedEntry = getCache();
    const hasFreshData = cachedEntry?.data !== undefined &&
      !isStale(cachedEntry.updatedAt, staleTime);

    if (!force && hasFreshData) {
      return syncFromCache("cache") as TData;
    }

    const inflight = cachedEntry?.inflight;
    if (inflight) {
      machine.send({ type: "FETCH", source: "dedupe" });
      update({
        status: fetchStatus(),
        isFetching: true,
      });
      try {
        await inflight;
        return syncFromCache("inflight") as TData;
      } catch (error) {
        syncFromCache("inflight");
        throw error;
      }
    }

    machine.send({ type: "FETCH", source: "network" });
    update({
      status: fetchStatus(),
      isFetching: true,
      error: undefined,
    });

    const nextInflight = Promise.resolve(config.queryFn());
    writeCache({
      ...cachedEntry,
      inflight: nextInflight,
      updatedAt: cachedEntry?.updatedAt ?? state.value.updatedAt,
    });

    try {
      const data = await nextInflight;
      const updatedAt = now();
      writeCache({ data, updatedAt, error: undefined, inflight: undefined });
      machine.send({ type: "RESOLVE", data });
      update({
        status: "success",
        data,
        error: undefined,
        updatedAt,
        isFetching: false,
        isStale: false,
      });
      return data;
    } catch (error) {
      writeCache({
        data: cachedEntry?.data,
        updatedAt: cachedEntry?.updatedAt ?? 0,
        error,
        inflight: undefined,
      });
      machine.send({ type: "REJECT", error });
      update({
        status: "error",
        error,
        isFetching: false,
        isStale: true,
      });
      throw error;
    }
  }

  function invalidate() {
    machine.send({ type: "INVALIDATE" });
    cacheRegistry.invalidate(key, "query.invalidate");
    update({ isStale: true });
  }

  function setData(updater: TData | ((current: TData | undefined) => TData)) {
    const next = typeof updater === "function"
      ? (updater as (current: TData | undefined) => TData)(state.value.data)
      : updater;
    const updatedAt = now();
    machine.send({ type: "SET_DATA" });
    writeCache({ data: next, updatedAt, error: undefined, inflight: undefined });
    update({
      status: "success",
      data: next,
      error: undefined,
      updatedAt,
      isFetching: false,
      isStale: false,
    });
  }

  function refreshStaleness() {
    update({
      isStale: isStale(state.value.updatedAt, staleTime),
    });
  }

  return {
    key,
    machine,
    state,
    fetch: () => runFetch(),
    refetch: () => runFetch({ force: true }),
    invalidate,
    setData,
    refreshStaleness,
    get snapshot() {
      return state.value;
    },
  };
}
