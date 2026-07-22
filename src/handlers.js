import {
  defaultInput,
  resolveServerCommandArguments
} from "./server.js";
import { AsyncError, asyncErrorCodes } from "./errors.js";
import { attachRegistryInspection, createRegistryStore } from "./registry-store.js";
import { createLazyRegistry, isLazyDescriptor } from "./lazy-registry.js";

const builtInTokens = new Set(["prevent", "preventDefault", "stopPropagation", "stopImmediatePropagation"]);
const builtInHandlers = {
  prevent: preventDefault,
  preventDefault,
  stopPropagation() {
    this.event?.stopPropagation?.();
  },
  stopImmediatePropagation() {
    this.event?.stopImmediatePropagation?.();
  }
};

function preventDefault() {
  this.event?.preventDefault?.();
}

export function createHandlerRegistry(initialMap = {}, options = {}) {
  const registryStore = options.registry ?? createRegistryStore();
  const type = options.type ?? "handler";
  const handlers = registryStore._map(type);
  const lazyRegistry = options.lazyRegistry ?? createLazyRegistry(options);
  const lazyHandlers = new Map();

  const registry = attachRegistryInspection({
    register(id, fn) {
      assertId(id);
      if (typeof fn !== "function" && !isLazyDescriptor(fn)) {
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

    unregister(id) {
      assertId(id);
      lazyHandlers.delete(id);
      return handlers.delete(id);
    },

    resolve(id) {
      assertId(id);
      const handler = handlers.get(id);
      if (!isLazyDescriptor(handler)) {
        return handler;
      }
      if (!lazyHandlers.has(id)) {
        lazyHandlers.set(id, async function runLazyHandler(...args) {
          const resolved = await lazyRegistry.resolve(type, id, handler);
          if (typeof resolved !== "function") {
            throw new TypeError(`Handler "${id}" did not resolve to a function.`);
          }
          return resolved.apply(this, args);
        });
      }
      return lazyHandlers.get(id);
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
            throw new AsyncError({
              code: asyncErrorCodes.serverCommandUnavailable,
              message: `Server command "${step.id}" cannot run without a server registry.`,
              context: { serverCommand: step.id }
            });
          }
          const resolved = resolveServerCommandArguments(step.args, runContext);
          const result = await runContext.server.run(step.id, resolved.args, {
            ...runContext,
            signalPaths: resolved.signalPaths,
            signalValues: resolved.signalValues
          });
          results.push(result);
          continue;
        }

        const handler = registry.resolve(step.id);
        if (!handler) {
          throw new AsyncError({
            code: asyncErrorCodes.handlerNotRegistered,
            message: `Handler "${step.id}" is not registered.`,
            context: { handler: step.id }
          });
        }
        const handlerContext = step.args
          ? {
              ...runContext,
              ...resolveHandlerCommandInput(step.args, runContext)
            }
          : runContext;
        const value = await handler.call(handlerContext, handlerContext);
        if (!(builtInTokens.has(step.id) && handler === builtInHandlers[step.id])) {
          results.push(value);
        }
      }

      return results;
    },

    _adoptMany(map = {}) {
      for (const [id, fn] of Object.entries(map ?? {})) {
        if (!handlers.has(id)) {
          registry.register(id, fn);
        }
      }
      return registry;
    }
  }, registryStore, type);

  registerBuiltIns(registry, handlers);
  registry.registerMany(initialMap);
  return registry;
}

function registerBuiltIns(registry, handlers) {
  for (const [id, fn] of Object.entries(builtInHandlers)) {
    if (!handlers.has(id)) {
      registry.register(id, fn);
      continue;
    }
    if (handlers.get(id) !== fn) {
      throw new Error(`Handler "${id}" is already registered.`);
    }
  }
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
    return parseHandlerCommand(command);
  }
  return { type: "handler", id: command };
}

function parseHandlerCommand(command) {
  const open = command.indexOf("(");
  if (open === -1 || !command.endsWith(")")) {
    throw invalidHandlerCommand(`Command "${command}" is not supported.`, command);
  }

  const id = command.slice(0, open).trim();
  if (!isHandlerCommandId(id)) {
    throw invalidHandlerCommand(`Command "${command}" has an invalid handler id.`, command);
  }

  return {
    type: "handler",
    id,
    args: parseArguments(command.slice(open + 1, -1))
  };
}

function parseServerCommand(command) {
  const open = command.indexOf("(");
  if (open === -1 || !command.endsWith(")")) {
    throw invalidHandlerCommand(`Server command "${command}" must be called with parentheses.`, command);
  }

  const id = command.slice("server.".length, open).trim();
  if (!isServerCommandId(id)) {
    throw invalidHandlerCommand(`Server command "${command}" has an invalid function id.`, command);
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
    throw invalidHandlerCommand(`Argument "${token}" is not supported.`, token);
  }
  if (token.startsWith("$")) {
    return { type: "local", name: token };
  }
  return { type: "signal", path: token };
}

function invalidHandlerCommand(message, command) {
  return new AsyncError({
    code: asyncErrorCodes.invalidHandlerCommand,
    message,
    context: { command }
  });
}

function isServerCommandId(id) {
  return /^[^.\s();]+(?:\.[^.\s();]+)*$/.test(id);
}

function isHandlerCommandId(id) {
  return /^[^.\s();]+(?:\.[^.\s();]+)*$/.test(id);
}

function resolveHandlerCommandInput(args, context) {
  const resolved = resolveServerCommandArguments(args, {
    ...context,
    allowUnsafeLocals: true
  });
  const input = resolved.args.length === 1 ? resolved.args[0] : resolved.args;

  return {
    input,
    signalPaths: resolved.signalPaths,
    signalValues: resolved.signalValues
  };
}
