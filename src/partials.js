import { isTemplateResult, renderTemplate } from "./html.js";
import { attachRegistryInspection, createRegistryStore } from "./registry-store.js";

export function createPartialRegistry(initialMap = {}, options = {}) {
  const registryStore = options.registry ?? createRegistryStore();
  const type = options.type ?? "partial";
  const entries = registryStore._map(type);

  const registry = attachRegistryInspection({
    register(id, fn) {
      assertId(id);
      if (typeof fn !== "function") {
        throw new TypeError(`Partial "${id}" must be a function.`);
      }
      if (entries.has(id)) {
        throw new Error(`Partial "${id}" is already registered.`);
      }
      entries.set(id, fn);
      return id;
    },

    registerMany(map) {
      for (const [id, fn] of Object.entries(map ?? {})) {
        registry.register(id, fn);
      }
      return registry;
    },

    resolve(id) {
      assertId(id);
      return entries.get(id);
    },

    async render(id, props = {}, context = {}) {
      assertId(id);
      const fn = registry.resolve(id);
      if (!fn) {
        throw new Error(`Partial "${id}" is not registered.`);
      }

      const partialContext = {
        ...context,
        id,
        props,
        cache: context.cache,
        partials: registry
      };
      const result = await fn.call(partialContext, props);
      return normalizePartialResult(result);
    },

    _adoptMany() {
      return registry;
    }
  }, registryStore, type);

  registry.registerMany(initialMap);
  return registry;
}

export function normalizePartialResult(result) {
  if (isPartialEnvelope(result)) {
    return {
      ...result,
      html: Object.hasOwn(result, "html") ? renderPartialValue(result.html) : result.html
    };
  }

  return { html: renderPartialValue(result) };
}

function renderPartialValue(value) {
  if (value?.nodeType) {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (isTemplateResult(value)) {
    return renderTemplate(value);
  }
  return renderTemplate(value);
}

function isPartialEnvelope(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (Object.hasOwn(value, "html") ||
        Object.hasOwn(value, "signals") ||
        Object.hasOwn(value, "boundary") ||
        Object.hasOwn(value, "redirect") ||
        Object.hasOwn(value, "status") ||
        Object.hasOwn(value, "cache"))
  );
}

function assertId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Partial id must be a non-empty string.");
  }
}
