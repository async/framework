const defaultPrefixes = Object.freeze({
  async: ["async:"],
  class: ["class:"],
  signal: ["signal:"],
  intersect: ["intersect:"],
  on: ["on:"]
});

// Activation scans the whole DOM in several passes, and every matchAttribute /
// readAttribute / attributeName call re-normalized the config from scratch
// (5× normalizePrefixes each). On a large tree that recomputes the same result
// millions of times. Memoize by config object identity so the hot path is a
// single WeakMap lookup; the (common) undefined/no-config case is a shared
// frozen default. Traced hot spot: normalizePrefixes + normalizeAttributeConfig.
const normalizedConfigCache = new WeakMap();

function buildNormalizedConfig(config) {
  return {
    async: normalizePrefixes(config.async, defaultPrefixes.async),
    class: normalizePrefixes(config.class, defaultPrefixes.class),
    signal: normalizePrefixes(config.signal, defaultPrefixes.signal),
    intersect: normalizePrefixes(config.intersect, defaultPrefixes.intersect),
    on: normalizePrefixes(config.on, defaultPrefixes.on)
  };
}

const defaultNormalizedConfig = Object.freeze(buildNormalizedConfig({}));

export function defineAttributeConfig(config = {}) {
  return normalizeAttributeConfig(config);
}

export function normalizeAttributeConfig(config) {
  if (config == null) return defaultNormalizedConfig;
  if (typeof config !== "object") return buildNormalizedConfig(config);
  const cached = normalizedConfigCache.get(config);
  if (cached) return cached;
  const normalized = buildNormalizedConfig(config);
  normalizedConfigCache.set(config, normalized);
  return normalized;
}

export function attributeName(attributes, type, name) {
  return normalizeAttributeConfig(attributes)[type][0] + name;
}

export function readAttribute(element, attributes, type, name) {
  for (const prefix of normalizeAttributeConfig(attributes)[type]) {
    const attr = `${prefix}${name}`;
    if (element.hasAttribute?.(attr)) {
      return element.getAttribute(attr);
    }
  }
  return null;
}

export function matchAttribute(name, attributes, type) {
  for (const prefix of normalizeAttributeConfig(attributes)[type]) {
    if (name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return null;
}

function normalizePrefixes(value, fallback) {
  const prefixes = value == null ? fallback : Array.isArray(value) ? value : [value];
  return prefixes.map((prefix) => {
    if (typeof prefix !== "string" || prefix.length === 0) {
      throw new TypeError("Attribute prefixes must be non-empty strings.");
    }
    return prefix;
  });
}
