import { createSignalRegistry } from "../../index.ts";

export const registry = createSignalRegistry();
export const remoteCount = registry.ensure("remote.counter", 0);
