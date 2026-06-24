import { isTemplateResult, renderTemplate } from "./html.js";
import { attachRegistryInspection, createRegistryStore } from "./registry-store.js";
import { createLazyRegistry, isLazyDescriptor } from "./lazy-registry.js";

export function createPartialRegistry(initialMap = {}, options = {}) {
  const registryStore = options.registry ?? createRegistryStore();
  const type = options.type ?? "partial";
  const entries = registryStore._map(type);
  const lazyRegistry = options.lazyRegistry ?? createLazyRegistry(options);
  const lazyPartials = new Map();

  const registry = attachRegistryInspection({
    register(id, fn) {
      assertId(id);
      if (typeof fn !== "function" && !isLazyDescriptor(fn)) {
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

    unregister(id) {
      assertId(id);
      lazyPartials.delete(id);
      return entries.delete(id);
    },

    resolve(id) {
      assertId(id);
      const partial = entries.get(id);
      if (!isLazyDescriptor(partial)) {
        return partial;
      }
      if (!lazyPartials.has(id)) {
        lazyPartials.set(id, async function runLazyPartial(...args) {
          const resolved = await lazyRegistry.resolve(type, id, partial);
          if (typeof resolved !== "function") {
            throw new TypeError(`Partial "${id}" did not resolve to a function.`);
          }
          return resolved.apply(this, args);
        });
      }
      return lazyPartials.get(id);
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
      return normalizePartialResult(result, partialContext);
    },

    _adoptMany(map = {}) {
      for (const [id, fn] of Object.entries(map ?? {})) {
        if (!entries.has(id)) {
          registry.register(id, fn);
        }
      }
      return registry;
    }
  }, registryStore, type);

  registry.registerMany(initialMap);
  return registry;
}

export function normalizePartialResult(result, context = {}) {
  if (isPartialEnvelope(result)) {
    const normalized = {
      ...result
    };
    if (Object.hasOwn(result, "html") && result.html !== undefined) {
      normalized.html = renderPartialValue(result.html, context);
    }
    return {
      ...normalized
    };
  }

  return { html: renderPartialValue(result, context) };
}

function renderPartialValue(value, context) {
  if (value?.nodeType) {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (isTemplateResult(value)) {
    return renderTemplate(value, templateRenderOptions(context));
  }
  return renderTemplate(value, templateRenderOptions(context));
}

function templateRenderOptions(context) {
  return {
    attributes: context.loader?.attributes,
    signals: context.signals,
    bind: context.loader?._registerBinding?.bind(context.loader)
  };
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
