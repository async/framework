import {
  createApp as createBaseApp,
  defineApp as defineBaseApp,
  readSnapshot
} from "./app.js";
import { createRouteRegistry, createRouter } from "./router.js";

const routerFeature = {
  router: {
    createRouteRegistry,
    createRouter
  }
};

export { asyncSignal } from "./async-signal.js";
export { attributeName, defineAttributeConfig } from "./attributes.js";
export { createCacheRegistry, defineCache } from "./cache.js";
export { component, createComponentRegistry, defineComponent } from "./component.js";
export { createDeclarationBus, system as asyncSystem } from "./declaration-bus.js";
export { delay } from "./delay.js";
export { defineAsyncContainerElement, defineAsyncSuspenseElement } from "./elements.js";
export { AsyncError, asyncErrorCodes, isAsyncError, toAsyncDiagnostic } from "./errors.js";
export { createHandlerRegistry } from "./handlers.js";
export { childrenFragment, html, isChildrenFragment } from "./html.js";
export { createLazyRegistry, defineRegistrySnapshot } from "./lazy-registry.js";
export { Loader, AsyncLoader } from "./loader.js";
export { createRegistryStore } from "./registry-store.js";
export { createRouteRegistry, createRouter, defineRoute, route } from "./router.js";
export { createScheduler } from "./scheduler.js";
export { applyServerResult, createServerProxy, resolveServerCommandArguments, unwrapServerResult } from "./server.js";
export { computed, createSignal, createSignalRegistry, effect, signal } from "./signals.js";

export function installRouter(app = Async) {
  if (!app || typeof app._installFeature !== "function") {
    throw new TypeError("installRouter(app) requires an Async app created by @async/framework.");
  }
  app._installFeature(routerFeature);
  return app;
}

export function createApp(appOrDefinition = Async, options = {}) {
  return createBaseApp(appOrDefinition, {
    ...options,
    features: mergeFeatures(routerFeature, options.features)
  });
}

export function defineApp(initial, options = {}) {
  return defineBaseApp(initial, {
    ...options,
    createRuntime: createApp,
    features: mergeFeatures(routerFeature, options.features)
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
