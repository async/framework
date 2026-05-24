import type {
  HandlerContext,
  HandlerFn,
  HandlerLike,
  HandlerModule,
  HandlerProtocol,
  ParsedHandlerRef,
  RemoteProvider,
} from "./types.ts";

function normalizeEventName(eventName: string) {
  return eventName
    .replace(/[-_:](\w)/g, (_, char) => char.toUpperCase())
    .replace(/^(\w)/, (_, char) => char.toUpperCase());
}

function pickExport<TContext extends HandlerContext>(
  module: HandlerModule,
  eventName: string,
  explicit?: string,
) {
  if (explicit && typeof module[explicit] === "function") {
    return module[explicit] as HandlerFn<TContext>;
  }

  const convention = `on${normalizeEventName(eventName)}`;
  if (typeof module[convention] === "function") {
    return module[convention] as HandlerFn<TContext>;
  }

  if (typeof module.handler === "function") {
    return module.handler as HandlerFn<TContext>;
  }

  if (typeof module.default === "function") {
    return module.default as HandlerFn<TContext>;
  }

  return undefined;
}

function splitExport(ref: string) {
  const [target, exportName] = ref.split("#");
  return { target, exportName };
}

function isImportLike(path: string) {
  return path.startsWith("http://") || path.startsWith("https://") ||
    path.startsWith("./") || path.startsWith("../") || path.startsWith("/");
}

function parseHandlerRef(pathWithExport: string): ParsedHandlerRef {
  const { target, exportName } = splitExport(pathWithExport.trim());

  const remoteProtocol = "remote:";
  const localProtocol = "local:";

  if (target.startsWith(remoteProtocol)) {
    const rawTarget = target.slice(remoteProtocol.length);
    return {
      protocol: "remote",
      target: rawTarget,
      exportName,
      cacheKey: `remote:${rawTarget}`,
    };
  }

  if (target.startsWith(localProtocol)) {
    const rawTarget = target.slice(localProtocol.length);
    return {
      protocol: "local",
      target: rawTarget,
      exportName,
      cacheKey: `local:${rawTarget}`,
    };
  }

  // Default protocol is local.
  return {
    protocol: "local",
    target,
    exportName,
    cacheKey: `local:${target}`,
  };
}

export class HandlerRegistry<TContext extends HandlerContext = HandlerContext> {
  private readonly cache = new Map<string, HandlerLike<TContext>>();
  private readonly remoteProviders: RemoteProvider[] = [];

  register(key: string, handler: HandlerLike<TContext>) {
    this.cache.set(`local:${key}`, handler);
  }

  registerHandlers(handlers: Record<string, HandlerLike<TContext>>) {
    for (const [key, handler] of Object.entries(handlers)) {
      this.register(key, handler);
    }
  }

  registerRemoteProvider(provider: RemoteProvider) {
    this.remoteProviders.push(provider);
  }

  registerRemoteHandlers(
    source:
      | Record<string, HandlerLike<TContext>>
      | ((key: string) =>
        HandlerLike<TContext> | Promise<HandlerLike<TContext> | undefined> | undefined),
  ) {
    if (typeof source === "function") {
      this.registerRemoteProvider(async (key) => {
        return await source(key);
      });
      return;
    }

    this.registerRemoteProvider((key) => {
      return source[key];
    });
  }

  async registerRemoteManifest(manifestUrl: string, options?: { baseUrl?: string }) {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      throw new Error(`Unable to fetch remote manifest: ${manifestUrl}`);
    }

    const manifest = await response.json() as Record<string, string>;
    const baseUrl = options?.baseUrl ?? new URL(".", manifestUrl).href;

    this.registerRemoteProvider(async (key) => {
      const modulePath = manifest[key];
      if (!modulePath) return undefined;
      const moduleUrl = new URL(modulePath, baseUrl).href;
      return await import(moduleUrl);
    });
  }

  private async resolveByProtocol(ref: ParsedHandlerRef) {
    if (this.cache.has(ref.cacheKey)) return this.cache.get(ref.cacheKey);

    if (ref.protocol === "remote") {
      for (const provider of this.remoteProviders) {
        const resolved = await provider(ref.target, ref.protocol);
        if (resolved) {
          this.cache.set(ref.cacheKey, resolved);
          return resolved;
        }
      }

      if (isImportLike(ref.target)) {
        const mod = await import(ref.target);
        this.cache.set(ref.cacheKey, mod);
        return mod;
      }

      return undefined;
    }

    // local protocol
    if (this.cache.has(ref.cacheKey)) {
      return this.cache.get(ref.cacheKey);
    }

    if (isImportLike(ref.target)) {
      const mod = await import(ref.target);
      this.cache.set(ref.cacheKey, mod);
      return mod;
    }

    return undefined;
  }

  async resolve(pathWithExport: string, eventName: string): Promise<HandlerFn<TContext> | undefined> {
    const ref = parseHandlerRef(pathWithExport);
    const raw = await this.resolveByProtocol(ref);
    if (!raw) return undefined;

    if (typeof raw === "function") return raw as HandlerFn<TContext>;

    return pickExport<TContext>(raw as HandlerModule, eventName, ref.exportName);
  }

  parseRef(pathWithExport: string) {
    return parseHandlerRef(pathWithExport);
  }
}

export function defineHandlers<TContext extends HandlerContext>() {
  return <T extends Record<string, HandlerLike<TContext>>>(handlers: T) => handlers;
}
