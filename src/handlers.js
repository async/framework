const builtInTokens = new Set(["preventDefault", "stopPropagation"]);

export function createHandlerRegistry(initialMap = {}) {
  const handlers = new Map();

  const registry = {
    register(id, fn) {
      assertId(id);
      if (typeof fn !== "function") {
        throw new TypeError(`Handler "${id}" must be a function.`);
      }
      handlers.set(id, fn);
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
      return handlers.get(id);
    },

    async run(ref, context = {}) {
      const steps = parseHandlerRef(ref);
      const results = [];
      let stopped = false;
      const runContext = {
        ...context,
        handlers: registry,
        preventDefault() {
          context.event?.preventDefault?.();
        },
        stopPropagation() {
          context.event?.stopPropagation?.();
        },
        stop() {
          stopped = true;
        }
      };

      for (const step of steps) {
        if (stopped) {
          break;
        }
        if (step === "preventDefault") {
          runContext.preventDefault();
          continue;
        }
        if (step === "stopPropagation") {
          runContext.stopPropagation();
          continue;
        }

        const handler = registry.resolve(step);
        if (!handler) {
          throw new Error(`Handler "${step}" is not registered.`);
        }
        results.push(await handler.call(runContext, runContext));
      }

      return results;
    }
  };

  registry.registerMany(initialMap);
  return registry;
}

export function parseHandlerRef(ref) {
  if (typeof ref !== "string" || ref.trim().length === 0) {
    throw new TypeError("Handler ref must be a non-empty string.");
  }

  return ref
    .split(",")
    .flatMap((part) => part.trim().split(/\s+/))
    .filter(Boolean);
}

export function isHandlerToken(value) {
  return builtInTokens.has(value);
}

function assertId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Handler id must be a non-empty string.");
  }
}
