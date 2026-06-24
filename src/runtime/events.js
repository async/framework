import {
  createRuntimeController,
  normalizeRuntimeStartArgs,
  resolveElements
} from "./shared.js";

export function startEvents(rootOrOptions, planArg, optionsArg) {
  const { root, plan, options } = normalizeRuntimeStartArgs(rootOrOptions, planArg, optionsArg);
  assertEventPlan(plan);
  assertHandlers(plan.handlers ?? {});
  const runtimeOptions = {
    ...options,
    root,
    moduleCache: new Map()
  };
  const elements = options.resolvedElements ?? resolveElements(root, options.elements ?? [], {
    onDiagnostic: options.onDiagnostic
  });
  const listeners = [];
  let stopped = false;

  try {
    const bindingsByType = groupEventBindings(plan.events, elements);
    for (const [eventType, bindings] of bindingsByType) {
      const listener = (event) => {
        void dispatchPlannedEvent(event, bindings, plan.handlers ?? {}, runtimeOptions);
      };
      root.addEventListener(eventType, listener);
      listeners.push([eventType, listener]);
    }
  } catch (error) {
    for (const [eventType, listener] of listeners) {
      root.removeEventListener(eventType, listener);
    }
    throw error;
  }

  return createRuntimeController({
    get stopped() {
      return stopped;
    },
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      for (const [eventType, listener] of listeners.splice(0).reverse()) {
        root.removeEventListener(eventType, listener);
      }
    }
  }, options.signal);
}

function assertEventPlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new TypeError("Event runtime plan must be an object.");
  }
  if (plan.version !== undefined && plan.version !== 1) {
    throw new Error(`Unsupported event runtime plan version: ${String(plan.version)}.`);
  }
  if (!Array.isArray(plan.events)) {
    throw new TypeError("Event runtime plan requires an events array.");
  }
}

function groupEventBindings(records, elements) {
  const groups = new Map();
  for (const record of records) {
    const [elementIndex, eventType, commands] = assertEventBinding(record);
    const element = elements[elementIndex];
    if (!element) {
      throw new Error(`Event binding target ${elementIndex} was not resolved.`);
    }
    if (!groups.has(eventType)) {
      groups.set(eventType, []);
    }
    groups.get(eventType).push({ element, commands });
  }
  return groups;
}

function assertEventBinding(record) {
  if (!Array.isArray(record) || record.length !== 3) {
    throw new TypeError("Event binding records must be [element, event, commands].");
  }
  const [elementIndex, eventType, commands] = record;
  if (!Number.isInteger(elementIndex) || elementIndex < 0) {
    throw new TypeError("Event binding element index must be a non-negative integer.");
  }
  if (typeof eventType !== "string" || eventType.length === 0) {
    throw new TypeError("Event binding event type must be a non-empty string.");
  }
  if (!Array.isArray(commands)) {
    throw new TypeError("Event binding commands must be an array.");
  }
  return record;
}

async function dispatchPlannedEvent(event, bindings, handlers, options) {
  for (const binding of bindings) {
    if (!event.composedPath?.().includes(binding.element) && !binding.element.contains(event.target)) {
      continue;
    }
    for (const command of binding.commands) {
      const result = await runCommand(command, event, binding.element, handlers, options);
      if (result === "stop-immediate") {
        return;
      }
    }
  }
}

async function runCommand(command, event, element, handlers, options) {
  if (!Array.isArray(command) || typeof command[0] !== "string") {
    throw new TypeError("Event command must be a tuple with a command name.");
  }

  switch (command[0]) {
    case "preventDefault":
      event.preventDefault();
      return;
    case "stopPropagation":
      event.stopPropagation();
      return;
    case "stopImmediatePropagation":
      event.stopImmediatePropagation();
      return "stop-immediate";
    case "setSignal":
      if (!options.signals || typeof options.signals.set !== "function") {
        throw new Error("setSignal command requires a signal runtime controller.");
      }
      options.signals?.set(command[1], readEventValue(event, command[2]));
      return;
    case "handler": {
      const handler = await resolveHandler(command[1], handlers, options);
      await handler({ event, element, el: element, root: options.root, signals: options.signals });
      return;
    }
    default:
      throw new Error(`Unsupported event command: ${command[0]}.`);
  }
}

function readEventValue(event, source) {
  if (!Array.isArray(source)) {
    throw new TypeError("Event value source must be a tuple.");
  }
  switch (source[0]) {
    case "event.target.value":
      return event.target?.value;
    case "event.target.checked":
      return Boolean(event.target?.checked);
    case "constant":
      return source[1];
    default:
      throw new Error(`Unsupported event value source: ${source[0]}.`);
  }
}

async function resolveHandler(id, handlers, options) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Handler command requires a non-empty id.");
  }
  const descriptor = handlers[id];
  if (typeof descriptor === "function") {
    return descriptor;
  }
  assertStrictDescriptor(id, descriptor);
  const importModule = options.importModule ?? ((specifier) => import(/* @vite-ignore */ specifier));
  if (!options.moduleCache.has(descriptor.browserImport)) {
    options.moduleCache.set(descriptor.browserImport, importModule(descriptor.browserImport));
  }
  const module = await options.moduleCache.get(descriptor.browserImport);
  const handler = module?.[descriptor.exportName];
  if (typeof handler !== "function") {
    throw new TypeError(`Strict handler "${id}" did not resolve export "${descriptor.exportName}".`);
  }
  return handler;
}

function assertHandlers(handlers) {
  for (const [id, descriptor] of Object.entries(handlers)) {
    if (typeof descriptor !== "function") {
      assertStrictDescriptor(id, descriptor);
    }
  }
}

function assertStrictDescriptor(id, descriptor) {
  if (!descriptor || typeof descriptor !== "object") {
    throw new TypeError(`Handler "${id}" must be a function or strict descriptor.`);
  }
  if (descriptor.mode !== undefined && descriptor.mode !== "strict") {
    throw new TypeError(`Handler "${id}" must use a strict descriptor.`);
  }
  if (typeof descriptor.browserImport !== "string" || descriptor.browserImport.length === 0) {
    throw new TypeError(`Handler "${id}" requires browserImport.`);
  }
  if (typeof descriptor.exportName !== "string" || descriptor.exportName.length === 0) {
    throw new TypeError(`Handler "${id}" requires exportName.`);
  }
  if (descriptor.version !== undefined) {
    const url = new URL(descriptor.browserImport, "https://async.local/");
    if (url.searchParams.get("v") !== String(descriptor.version)) {
      throw new TypeError(`Handler "${id}" browserImport must include version query v=${descriptor.version}.`);
    }
  }
}
