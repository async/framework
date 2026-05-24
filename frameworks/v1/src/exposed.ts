import { AsyncLoader, type AsyncLoaderOptions } from "./loader.ts";
import { HandlerRegistry } from "./handler-registry.ts";
import type { HandlerContext, HandlerLike, RemoteProvider } from "./types.ts";

export function createExposedHandlers<
  TContext extends HandlerContext = HandlerContext,
>(registry = new HandlerRegistry<TContext>()) {
  return {
    registry,
    register: (key: string, handler: HandlerLike<TContext>) => registry.register(key, handler),
    registerMany: (handlers: Record<string, HandlerLike<TContext>>) =>
      registry.registerHandlers(handlers),
    registerRemoteProvider: (provider: RemoteProvider) =>
      registry.registerRemoteProvider(provider),
    registerRemoteHandlers: (
      source:
        | Record<string, HandlerLike<TContext>>
        | ((key: string) =>
          HandlerLike<TContext> | Promise<HandlerLike<TContext> | undefined> | undefined),
    ) => registry.registerRemoteHandlers(source),
    registerRemoteManifest: (manifestUrl: string, options?: { baseUrl?: string }) =>
      registry.registerRemoteManifest(manifestUrl, options),
  };
}

export function createLoader(options: Omit<AsyncLoaderOptions, "registry"> & {
  registry?: HandlerRegistry<HandlerContext>;
}) {
  return new AsyncLoader(options);
}

export function createAsyncFramework(options: Omit<AsyncLoaderOptions, "registry">) {
  const handlers = createExposedHandlers();
  const loader = new AsyncLoader({ ...options, registry: handlers.registry });

  return {
    handlers,
    loader,
    start: () => loader.init(),
  };
}
