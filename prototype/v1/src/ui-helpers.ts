import type { Command, HandlerContext } from "./types.ts";

type CommandBinding =
  | string
  | Command
  | ((context: HandlerContext) => Command | Promise<Command>);

export function createCommandHandlers(
  run: <TPayload = unknown, TResult = unknown>(
    command: Command<TPayload>,
  ) => Promise<TResult>,
  bindings: Record<string, CommandBinding>,
) {
  return Object.fromEntries(
    Object.entries(bindings).map(([handlerKey, binding]) => {
      const handler = async (context: HandlerContext) => {
        let command: Command;

        if (typeof binding === "string") {
          command = { type: binding };
        } else if (typeof binding === "function") {
          command = await binding(context);
        } else {
          command = binding;
        }

        return await run(command);
      };

      return [handlerKey, handler];
    }),
  );
}

export function registerCommandHandlers(
  framework: {
    handlers: {
      registerHandlers: (handlers: Record<string, (context: HandlerContext) => Promise<unknown>>) => void;
    };
  },
  run: <TPayload = unknown, TResult = unknown>(
    command: Command<TPayload>,
  ) => Promise<TResult>,
  bindings: Record<string, CommandBinding>,
) {
  framework.handlers.registerHandlers(createCommandHandlers(run, bindings));
}
