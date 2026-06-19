import {
  createRuntimeController,
  normalizeRuntimeStartArgs,
  resolveElements
} from "./shared.js";

export function startSignals(rootOrOptions, planArg, optionsArg) {
  const { root, plan, options } = normalizeRuntimeStartArgs(rootOrOptions, planArg, optionsArg);
  assertSignalPlan(plan);
  const store = new Map();
  const subscribers = new Map();
  const cleanups = [];
  let stopped = false;

  for (const [path, value] of plan.values ?? []) {
    assertPath(path);
    store.set(path, value);
  }

  const elements = options.resolvedElements ?? resolveElements(root, options.elements ?? [], {
    onDiagnostic: options.onDiagnostic
  });

  try {
    for (const binding of plan.bindings ?? []) {
      cleanups.push(bindSignal(binding, elements, { get, subscribe }));
    }
  } catch (error) {
    for (const cleanup of cleanups.splice(0).reverse()) {
      cleanup();
    }
    throw error;
  }

  const controller = createRuntimeController({
    get stopped() {
      return stopped;
    },
    get,
    set,
    update,
    subscribe,
    snapshot,
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      for (const cleanup of cleanups.splice(0).reverse()) {
        cleanup();
      }
      subscribers.clear();
    }
  }, options.signal);

  return controller;

  function get(path) {
    assertPath(path);
    return store.get(path);
  }

  function set(path, value) {
    assertOpen();
    assertPath(path);
    if (Object.is(store.get(path), value)) {
      return;
    }
    store.set(path, value);
    for (const fn of subscribers.get(path) ?? []) {
      fn(value);
    }
  }

  function update(path, fn) {
    if (typeof fn !== "function") {
      throw new TypeError("update(path, fn) requires a function.");
    }
    const next = fn(get(path));
    set(path, next);
    return next;
  }

  function subscribe(path, fn) {
    assertOpen();
    assertPath(path);
    if (typeof fn !== "function") {
      throw new TypeError("subscribe(path, fn) requires a function.");
    }
    if (!subscribers.has(path)) {
      subscribers.set(path, new Set());
    }
    subscribers.get(path).add(fn);
    return () => {
      subscribers.get(path)?.delete(fn);
    };
  }

  function snapshot() {
    return Object.fromEntries(store);
  }

  function assertOpen() {
    if (stopped) {
      throw new Error("Signal runtime controller has stopped.");
    }
  }
}

function assertSignalPlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new TypeError("Signal runtime plan must be an object.");
  }
  if (plan.version !== undefined && plan.version !== 1) {
    throw new Error(`Unsupported signal runtime plan version: ${String(plan.version)}.`);
  }
}

function bindSignal(record, elements, signals) {
  const [elementIndex, kind, ...args] = assertSignalBinding(record);
  const element = elements[elementIndex];
  if (!element) {
    throw new Error(`Signal binding target ${elementIndex} was not resolved.`);
  }
  const path = args.at(-1);
  const apply = () => applyBinding(element, kind, args, signals.get(path));
  apply();
  return signals.subscribe(path, apply);
}

function assertSignalBinding(record) {
  if (!Array.isArray(record) || record.length < 3) {
    throw new TypeError("Signal binding records must be tuple arrays.");
  }
  const [elementIndex, kind] = record;
  if (!Number.isInteger(elementIndex) || elementIndex < 0) {
    throw new TypeError("Signal binding element index must be a non-negative integer.");
  }
  if (!["text", "value", "attr", "prop", "class", "classList"].includes(kind)) {
    throw new Error(`Unsupported signal binding kind: ${String(kind)}.`);
  }
  return record;
}

function applyBinding(element, kind, args, value) {
  switch (kind) {
    case "text":
      element.textContent = stringify(value);
      return;
    case "value":
      if ("value" in element) {
        element.value = value ?? "";
      } else {
        applyAttribute(element, "value", value);
      }
      return;
    case "attr":
      applyAttribute(element, args[0], value);
      return;
    case "prop":
      element[args[0]] = value;
      return;
    case "class":
      element.classList.toggle(args[0], Boolean(value));
      return;
    case "classList":
      applyClassList(element, value);
      return;
    default:
      throw new Error(`Unsupported signal binding kind: ${String(kind)}.`);
  }
}

function applyAttribute(element, name, value) {
  if (typeof name !== "string" || name.length === 0) {
    throw new TypeError("Attribute signal binding requires an attribute name.");
  }
  if (value === false || value === null || value === undefined) {
    element.removeAttribute(name);
    return;
  }
  if (value === true) {
    element.setAttribute(name, "");
    return;
  }
  element.setAttribute(name, String(value));
}

function applyClassList(element, value) {
  const previous = element.__asyncRuntimeClassList ?? new Set();
  for (const token of previous) {
    element.classList.remove(token);
  }
  const next = new Set(String(value ?? "").split(/\s+/).filter(Boolean));
  for (const token of next) {
    element.classList.add(token);
  }
  element.__asyncRuntimeClassList = next;
}

function assertPath(path) {
  if (typeof path !== "string" || path.length === 0) {
    throw new TypeError("Signal path must be a non-empty string.");
  }
}

function stringify(value) {
  return value === null || value === undefined ? "" : String(value);
}
