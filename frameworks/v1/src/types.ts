export type HandlerContext<T = unknown> = {
  event: Event;
  element: Element;
  root: Element;
  value?: T;
  stop: () => void;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export type HandlerFn<
  TContext extends HandlerContext = HandlerContext,
  TResult = unknown,
> = (
  context: TContext,
) => TResult | Promise<TResult> | void | Promise<void>;

export type HandlerModule = {
  default?: HandlerFn<any, any>;
  handler?: HandlerFn<any, any>;
  [key: string]: unknown;
};

export type HandlerLike<TContext extends HandlerContext = HandlerContext> =
  | HandlerFn<TContext, unknown>
  | HandlerModule;

export type HandlerProtocol = "local" | "remote";

export type ParsedHandlerRef = {
  protocol: HandlerProtocol;
  target: string;
  exportName?: string;
  cacheKey: string;
};

export type RemoteProvider = (
  key: string,
  protocol?: HandlerProtocol,
) => Promise<HandlerLike<any> | undefined> | HandlerLike<any> | undefined;

export type Command<TPayload = unknown> = {
  type: string;
  payload?: TPayload;
};

export type CommandHandler<TPayload = unknown, TResult = unknown> = (
  command: Command<TPayload>,
) => TResult | Promise<TResult>;

export type RunTransition<TState extends string = string> = {
  prev: TState;
  next: TState;
  event: { type: string; [key: string]: unknown };
};
