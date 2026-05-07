import { ContextRegistry } from "./registry.ts";
import { ContextStack } from "./stack.ts";
export const contextStack = ContextStack.getInstance();
export const contextRegistry = ContextRegistry.getInstance();

// TODO: better way to do this?
if (typeof globalThis !== "undefined") {
  globalThis.contextStack = contextStack;
  globalThis.contextRegistry = contextRegistry;
}
