export function createRuntimeController(controller, signal) {
  if (signal) {
    if (signal.aborted) {
      controller.stop();
    } else {
      signal.addEventListener("abort", () => controller.stop(), { once: true });
    }
  }
  return controller;
}

export function normalizeRuntimeStartArgs(rootOrOptions, planArg, optionsArg) {
  if (rootOrOptions && typeof rootOrOptions === "object" && "root" in rootOrOptions) {
    return {
      root: requireRoot(rootOrOptions.root),
      plan: rootOrOptions.plan,
      options: {
        ...rootOrOptions.options,
        ...withoutKeys(rootOrOptions, ["root", "plan", "options"])
      }
    };
  }

  return {
    root: requireRoot(rootOrOptions),
    plan: planArg,
    options: optionsArg ?? {}
  };
}

export function resolveElements(root, locators, options = {}) {
  if (!Array.isArray(locators)) {
    throw new TypeError("Runtime element locators must be an array.");
  }
  return locators.map((locator, index) => resolveElement(root, locator, index, options));
}

function resolveElement(root, locator, index, options) {
  const record = normalizeLocator(locator);
  const element = root.querySelector(record.selector);
  if (!element && !record.optional) {
    throw new Error(`Runtime locator ${index} did not match: ${record.selector}`);
  }
  if (!element) {
    options.onDiagnostic?.({
      type: "missing-optional-locator",
      index,
      selector: record.selector
    });
  }
  return element;
}

function normalizeLocator(locator) {
  if (typeof locator === "string") {
    return { selector: locator, optional: false };
  }
  if (locator && typeof locator === "object" && typeof locator.selector === "string") {
    return {
      selector: locator.selector,
      optional: Boolean(locator.optional)
    };
  }
  throw new TypeError("Runtime element locator must be a selector string or selector record.");
}

function requireRoot(root) {
  if (!root || typeof root.querySelector !== "function") {
    throw new TypeError("Runtime root must be a Document, Element, or DocumentFragment with querySelector.");
  }
  if (typeof root.addEventListener !== "function") {
    throw new TypeError("Runtime root must support addEventListener.");
  }
  return root;
}

function withoutKeys(source, keys) {
  const result = {};
  for (const [key, value] of Object.entries(source)) {
    if (!keys.includes(key)) {
      result[key] = value;
    }
  }
  return result;
}
