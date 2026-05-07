import type { Command, CommandHandler, RunTransition } from "./types.ts";

export function createCommandBus() {
  const handlers = new Map<string, CommandHandler>();

  return {
    on<TPayload = unknown, TResult = unknown>(
      type: string,
      handler: CommandHandler<TPayload, TResult>,
    ) {
      handlers.set(type, handler as CommandHandler);
      return () => handlers.delete(type);
    },
    async send<TPayload = unknown, TResult = unknown>(
      command: Command<TPayload>,
    ): Promise<TResult> {
      const handler = handlers.get(command.type);
      if (!handler) {
        throw new Error(`No command handler registered for ${command.type}`);
      }
      return await handler(command as Command<unknown>) as TResult;
    },
  };
}

export function createRunMachine<TState extends string>(
  initialState: TState,
  transitions: Record<TState, Record<string, TState>>,
) {
  let state = initialState;
  const listeners = new Set<(transition: RunTransition<TState>) => void>();

  return {
    get state() {
      return state;
    },
    get snapshot() {
      return { state };
    },
    send(event: { type: string; [key: string]: unknown }) {
      const next = transitions[state]?.[event.type];
      if (!next) return state;

      const prev = state;
      state = next;

      const transition: RunTransition<TState> = { prev, next, event };
      listeners.forEach((listener) => listener(transition));

      return state;
    },
    subscribe(listener: (transition: RunTransition<TState>) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function createRuntimeService<TState extends string>(args: {
  machine: {
    send: (event: { type: string; [key: string]: unknown }) => TState;
    state: TState;
    snapshot: { state: TState };
  };
  commands: {
    send: <TPayload = unknown, TResult = unknown>(
      command: Command<TPayload>,
    ) => Promise<TResult>;
  };
}) {
  const listeners = new Set<(event: { type: string; [key: string]: unknown }) => void>();

  const emit = (event: { type: string; [key: string]: unknown }) => {
    listeners.forEach((listener) => listener(event));
  };

  return {
    get state() {
      return args.machine.state;
    },
    get snapshot() {
      return args.machine.snapshot;
    },
    subscribe(listener: (event: { type: string; [key: string]: unknown }) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async dispatch<TPayload = unknown, TResult = unknown>(command: Command<TPayload>) {
      emit({ type: "COMMAND_RECEIVED", command });
      const result = await args.commands.send<TPayload, TResult>(command);
      emit({ type: "COMMAND_COMPLETED", command, result });
      return result;
    },
    transition(event: { type: string; [key: string]: unknown }) {
      const nextState = args.machine.send(event);
      emit({ type: "TRANSITION", event, nextState });
      return nextState;
    },
    requestApproval(payload: { runId: string; taskId: string; reason: string }) {
      emit({ type: "APPROVAL_REQUESTED", ...payload });
      return args.machine.send({ type: "WAIT_FOR_APPROVAL", ...payload });
    },
  };
}
