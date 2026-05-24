import type { BaseContext } from "./types.ts";

// Why: Manages different types of context IDs and their counters
export class ContextRegistry {
  private static instance: ContextRegistry;
  private counters: Map<string, number> = new Map();
  private contextTypes = new Set<string>();
  private contexts: Map<string, BaseContext> = new Map();

  private constructor() {
    // Register default context types
    this.registerContextType("component");
    this.registerContextType("signal");
    this.registerContextType("computed");
    this.registerContextType("resource");
    this.registerContextType("hook");
    this.registerContextType("global");

    // Allow dynamic registration of ctx- types
    this.registerContextTypePrefix("ctx-");
    this.registerContextTypePrefix("cmp-");
    this.registerContextTypePrefix("sig-");
    this.registerContextTypePrefix("res-");
    this.registerContextTypePrefix("hook-");
  }

  static getInstance(): ContextRegistry {
    if (!ContextRegistry.instance) {
      ContextRegistry.instance = new ContextRegistry();
    }
    return ContextRegistry.instance;
  }

  // Why: Register a new context type with optional prefix check
  registerContextType(type: string): void {
    if (!this.contextTypes.has(type)) {
      this.contextTypes.add(type);
      this.counters.set(type, 0);
    }
  }

  // Why: Register a prefix to allow dynamic type registration
  registerContextTypePrefix(prefix: string): void {
    this.contextTypes.add(prefix);
  }

  // Why: Generate a unique ID with prefix support
  generateId(type: string, parentId?: string): string {
    // Check for exact type match first
    if (!this.contextTypes.has(type)) {
      // Check if type starts with a registered prefix
      const hasValidPrefix = Array.from(this.contextTypes).some((prefix) =>
        prefix.endsWith("-") && type.startsWith(prefix)
      );

      if (!hasValidPrefix) {
        throw new Error(`Unknown context type: ${type}`);
      }

      // Auto-register the new type
      this.registerContextType(type);
    }

    const count = this.counters.get(type) || 0;
    this.counters.set(type, count + 1);

    const parts: string[] = [];
    if (parentId) {
      parts.push(parentId);
    }
    parts.push(`${type}-${count}`);

    return parts.join(".");
  }

  // Why: Store and retrieve contexts
  setContext(id: string, context: BaseContext): void {
    this.contexts.set(id, context);
  }

  getContext(id: string): BaseContext | undefined {
    return this.contexts.get(id);
  }

  // Why: Reset registry for testing purposes
  reset(): void {
    this.counters.clear();
    this.contexts.clear();
    this.contextTypes.forEach((type) => this.counters.set(type, 0));
  }
}
