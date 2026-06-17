import {
  createApp as createBaseApp,
  defineApp as defineBaseApp,
  readSnapshot
} from "./app.js";
import { createServerRegistry } from "./server-registry.js";

export function createApp(appOrDefinition = Async, options = {}) {
  return createBaseApp(appOrDefinition, {
    serverFactory: createServerRegistry,
    ...options
  });
}

export function defineApp(initial) {
  return defineBaseApp(initial, { createRuntime: createApp });
}

export const Async = defineApp();
export { readSnapshot };
