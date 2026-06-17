import { AsyncLocalStorage } from "node:async_hooks";

export function createRequestContextStore() {
  const storage = new AsyncLocalStorage();

  return {
    storage,

    run(context, fn, ...args) {
      if (typeof fn !== "function") {
        throw new TypeError("requestContext.run(context, fn) requires a function.");
      }
      return storage.run(context ?? {}, fn, ...args);
    },

    get() {
      return storage.getStore();
    },

    snapshot() {
      return { ...(storage.getStore() ?? {}) };
    }
  };
}

export function readRequestContext(store) {
  if (!store) {
    return {};
  }
  if (typeof store.get === "function") {
    return store.get() ?? {};
  }
  if (typeof store.getStore === "function") {
    return store.getStore() ?? {};
  }
  if (typeof store === "object") {
    return store;
  }
  return {};
}
