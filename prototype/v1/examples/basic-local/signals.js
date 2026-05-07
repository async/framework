import { createSignalRegistry } from "../../index.ts";

export const registry = createSignalRegistry();
export const count = registry.ensure("counter.count", 0);
