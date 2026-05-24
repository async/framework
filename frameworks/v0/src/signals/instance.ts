import { SignalRegistry } from "./registry.ts";

export const signalRegistry = SignalRegistry.getInstance();

// TODO: better way to do this?
if (typeof globalThis !== "undefined") {
  globalThis.signalRegistry = signalRegistry;
}
