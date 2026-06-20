import { Async } from "./app.js";

export function defineAsyncContainerElement(options = {}) {
  const tagName = options.tagName ?? "async-container";
  const registry = options.customElements ?? globalThis.customElements;
  if (!registry) {
    throw new Error("defineAsyncContainerElement(...) requires customElements.");
  }
  const existing = registry.get(tagName);
  if (existing) {
    return existing;
  }
  const app = options.app ?? options.Async ?? Async;
  const HTMLElementBase = options.HTMLElement ?? options.window?.HTMLElement ?? globalThis.HTMLElement;
  if (!HTMLElementBase) {
    throw new Error("defineAsyncContainerElement(...) requires HTMLElement.");
  }

  class AsyncContainerElement extends HTMLElementBase {
    connectedCallback() {
      if (this.__asyncAttached) {
        return;
      }
      const runtime = app._runtime ?? app.start?.();
      runtime?.attachRoot?.(this);
      this.__asyncRuntime = runtime;
      this.__asyncAttached = true;
    }

    disconnectedCallback() {
      if (!this.__asyncAttached) {
        return;
      }
      this.__asyncRuntime?.detachRoot?.(this);
      this.__asyncRuntime = undefined;
      this.__asyncAttached = false;
    }
  }

  registry.define(tagName, AsyncContainerElement);
  return AsyncContainerElement;
}

export function defineAsyncSuspenseElement(options = {}) {
  const tagName = options.tagName ?? "async-suspense";
  const registry = options.customElements ?? globalThis.customElements;
  if (!registry) {
    throw new Error("defineAsyncSuspenseElement(...) requires customElements.");
  }
  const existing = registry.get(tagName);
  if (existing) {
    return existing;
  }
  const HTMLElementBase = options.HTMLElement ?? options.window?.HTMLElement ?? globalThis.HTMLElement;
  if (!HTMLElementBase) {
    throw new Error("defineAsyncSuspenseElement(...) requires HTMLElement.");
  }

  class AsyncSuspenseElement extends HTMLElementBase {}

  registry.define(tagName, AsyncSuspenseElement);
  return AsyncSuspenseElement;
}
