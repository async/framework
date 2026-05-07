import type { Command } from "./types.ts";
import { createStore } from "./rendering.ts";

export type CtpSnapshot<TState extends string> = {
  state: TState;
  timeline: TState[];
  logs: string[];
  lastCommand?: string;
};

export function createCommandTransitionProjectionPattern<TState extends string>(
  runtime: {
    state: TState;
    subscribe: (listener: (event: { type: string; [key: string]: unknown }) => void) => () => void;
    dispatch: <TPayload = unknown, TResult = unknown>(
      command: Command<TPayload>,
    ) => Promise<TResult>;
  },
  initialState: TState,
) {
  const store = createStore<CtpSnapshot<TState>>({
    state: initialState,
    timeline: [initialState],
    logs: ["runtime initialized"],
  });

  const log = (message: string) => {
    store.update((current) => ({
      ...current,
      logs: [...current.logs, message],
    }));
  };

  const unsubscribe = runtime.subscribe((event) => {
    if (event.type === "TRANSITION") {
      store.update((current) => ({
        ...current,
        state: runtime.state,
        timeline: [...current.timeline, runtime.state],
      }));
    }

    if (event.type === "COMMAND_RECEIVED") {
      const command = event.command as Command | undefined;
      if (command?.type) {
        store.update((current) => ({
          ...current,
          lastCommand: command.type,
        }));
      }
    }

    log(JSON.stringify(event));
  });

  const run = async <TPayload = unknown, TResult = unknown>(command: Command<TPayload>) => {
    return await runtime.dispatch<TPayload, TResult>(command);
  };

  return {
    store,
    log,
    run,
    cleanup: unsubscribe,
  };
}
