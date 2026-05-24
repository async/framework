import { createSignalRegistry } from "@async/framework-v1";

export const registry = createSignalRegistry();
export const remoteCount = registry.ensure("remote.counter", 0);
