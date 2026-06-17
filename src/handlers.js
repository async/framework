import {
  applyServerResult,
  defaultInput,
  resolveServerCommandArguments,
  unwrapServerResult
} from "./server.js";

const builtInTokens = new Set(["preventDefault", "stopPropagation", "stopImmediatePropagation"]);
const builtInHandlers = {
  preventDefault() {
    this.event?.preventDefault?.();
  },
  stopPropagation() {
    this.event?.stopPropagation?.();
  },
  stopImmediatePropagation() {
    this.event?.stopImmediatePropagation?.();
  }
};

export function createHandlerRegistry(initialMap = {}) {
  const handlers = new Map();

  const registry = {
    register(id, fn) {
      assertId(id);
      if (typeof fn !== "function") {
        throw new TypeError(`Handler "${id}" must be a function.`);
      }
      if (handlers.has(id)) {
        throw new Error(`Handler "${id}" is already registered.`);
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
        input: context.input ?? defaultInput(context),
        stop() {
          stopped = true;
        }
      };

      for (const step of steps) {
        if (stopped) {
          break;
        }

        if (step.type === "server") {
          if (!runContext.server || typeof runContext.server.run !== "function") {
            throw new Error(`Server command "${step.id}" cannot run without a server registry.`);
          }
          const resolved = resolveServerCommandArguments(step.args, runContext);
          const result = await runContext.server.run(step.id, resolved.args, {
            ...runContext,
            signalPaths: resolved.signalPaths,
            signalValues: resolved.signalValues
          });
          await applyServerResult(result, runContext);
          results.push(unwrapServerResult(result));
          continue;
        }

        const handler = registry.resolve(step.id);
        if (!handler) {
          throw new Error(`Handler "${step.id}" is not registered.`);
        }
        const value = await handler.call(runContext, runContext);
        if (!(builtInTokens.has(step.id) && handler === builtInHandlers[step.id])) {
          results.push(value);
        }
      }

      return results;
    }
  };

  registry.registerMany(builtInHandlers);
  registry.registerMany(initialMap);
  return registry;
}

export function parseHandlerRef(ref) {
  if (typeof ref !== "string" || ref.trim().length === 0) {
    throw new TypeError("Handler ref must be a non-empty string.");
  }

  return ref
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseCommand);
}

export function isHandlerToken(value) {
  return builtInTokens.has(value);
}

function assertId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new TypeError("Handler id must be a non-empty string.");
  }
}

function parseCommand(command) {
  if (command.startsWith("server.")) {
    return parseServerCommand(command);
  }
  if (command.includes("(") || command.includes(")")) {
    throw new Error(`Command "${command}" is not supported.`);
  }
  return { type: "handler", id: command };
}

function parseServerCommand(command) {
  const open = command.indexOf("(");
  if (open === -1 || !command.endsWith(")")) {
    throw new Error(`Server command "${command}" must be called with parentheses.`);
  }

  const id = command.slice("server.".length, open).trim();
  if (!isServerCommandId(id)) {
    throw new Error(`Server command "${command}" has an invalid function id.`);
  }

  return {
    type: "server",
    id,
    args: parseArguments(command.slice(open + 1, -1))
  };
}

function parseArguments(source) {
  if (source.trim().length === 0) {
    return [];
  }

  return source
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(parseArgument);
}

function parseArgument(token) {
  if (!/^[^\s,();]+$/.test(token)) {
    throw new Error(`Argument "${token}" is not supported.`);
  }
  if (token.startsWith("$")) {
    return { type: "local", name: token };
  }
  return { type: "signal", path: token };
}

function isServerCommandId(id) {
  return /^[^.\s();]+(?:\.[^.\s();]+)*$/.test(id);
}
