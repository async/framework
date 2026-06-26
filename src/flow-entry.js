import {
  createApp as createBaseApp,
  defineApp as defineBaseApp,
  readSnapshot
} from "./app.js";
import { mountFlowRegistrations } from "./flow.js";

const flowFeature = {
  flow: {
    mountRegistrations: mountFlowRegistrations
  }
};

export { asyncSignal } from "./async-signal.js";
export { attributeName, defineAttributeConfig } from "./attributes.js";
export { createCacheRegistry, defineCache } from "./cache.js";
export { component, createComponentRegistry, defineComponent } from "./component.js";
export { createDeclarationBus, system as asyncSystem } from "./declaration-bus.js";
export { delay } from "./delay.js";
export { defineAsyncContainerElement, defineAsyncSuspenseElement } from "./elements.js";
export { asyncSignal as flowAsyncSignal, computed as flowComputed, defineFrameworkFlow, flow, signal as flowSignal, isFrameworkFlowDefinition, onError, set, update, when } from "./flow.js";
export { createHandlerRegistry } from "./handlers.js";
export { childrenFragment, html, isChildrenFragment } from "./html.js";
export { createLazyRegistry, defineRegistrySnapshot } from "./lazy-registry.js";
export { Loader, AsyncLoader } from "./loader.js";
export { createRegistryStore } from "./registry-store.js";
export { createScheduler } from "./scheduler.js";
export { applyServerResult, createServerProxy, resolveServerCommandArguments, unwrapServerResult } from "./server.js";
export { computed, createSignal, createSignalRegistry, effect, signal } from "./signals.js";

export function installFlow(app = Async) {
  if (!app || typeof app._installFeature !== "function") {
    throw new TypeError("installFlow(app) requires an Async app created by @async/framework.");
  }
  app._installFeature(flowFeature);
  return app;
}

export function createApp(appOrDefinition = Async, options = {}) {
  return createBaseApp(appOrDefinition, {
    ...options,
    features: mergeFeatures(flowFeature, options.features)
  });
}

export function defineApp(initial, options = {}) {
  return defineBaseApp(initial, {
    ...options,
    createRuntime: createApp,
    features: mergeFeatures(flowFeature, options.features)
  });
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
