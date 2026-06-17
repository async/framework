const defaultPrefixes = Object.freeze({
  async: ["async:"],
  class: ["class:"],
  signal: ["signal:"],
  on: ["on:"]
});

export function defineAttributeConfig(config = {}) {
  return normalizeAttributeConfig(config);
}

export function normalizeAttributeConfig(config = {}) {
  return {
    async: normalizePrefixes(config.async, defaultPrefixes.async),
    class: normalizePrefixes(config.class, defaultPrefixes.class),
    signal: normalizePrefixes(config.signal, defaultPrefixes.signal),
    on: normalizePrefixes(config.on, defaultPrefixes.on)
  };
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
