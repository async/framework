import { createSignalRegistry } from "@async/framework-v1";

export const registry = createSignalRegistry();
export const count = registry.ensure("counter.count", 0);
