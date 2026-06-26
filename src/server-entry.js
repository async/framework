import {
  createApp as createBaseApp,
  defineApp as defineBaseApp,
  readSnapshot
} from "./app.js";
import { mountFlowRegistrations } from "./flow.js";
import { createRouteRegistry, createRouter } from "./router.js";
import { createServerRegistry } from "./server-registry.js";

const serverFeatures = {
  flow: {
    mountRegistrations: mountFlowRegistrations
  },
  router: {
    createRouteRegistry,
    createRouter
  }
};

export function createApp(appOrDefinition = Async, options = {}) {
  return createBaseApp(appOrDefinition, {
    ...options,
    serverFactory: createServerRegistry,
    features: mergeFeatures(serverFeatures, options.features)
  });
}

export function defineApp(initial) {
  return defineBaseApp(initial, { createRuntime: createApp, features: serverFeatures });
}

export const Async = defineApp();
export { readSnapshot };

function mergeFeatures(...featureSets) {
  const merged = {};
  for (const featureSet of featureSets) {
    if (!featureSet) {
      continue;
    }
    if (featureSet.flow) {
      merged.flow = {
        ...(merged.flow ?? {}),
        ...featureSet.flow
      };
    }
    if (featureSet.router) {
      merged.router = {
        ...(merged.router ?? {}),
        ...featureSet.router
      };
    }
  }
  return merged;
}
