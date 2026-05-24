import { signalRegistry } from "../signals/instance.ts";
import { contextRegistry, contextStack } from "./instance.ts";
import type { ComponentContext } from "./types.ts";

// Why: Generates unique IDs for components and signals
export function generateId(type: string, parentId?: string): string {
  return contextRegistry.generateId(type, parentId);
}

// Why: Manages the current component context
export function getCurrentContext(): ComponentContext | null {
  return contextStack.peek() as ComponentContext | null;
}

// Why: Creates and pushes a new component context
export function pushContext(
  element: HTMLElement | null = null,
  parentContext?: ComponentContext | null,
): ComponentContext {
  const context: ComponentContext = {
    type: "component",
    id: generateId("component", parentContext?.id),
    hooks: [],
    hookIndex: 0,
    signals: new Set(),
    cleanup: new Set(),
    mounted: false,
    element,
    parent: parentContext || null,
  };

  contextStack.push(context);
  return context;
}

// Why: Pops and cleans up the current context
export function popContext(): void {
  contextStack.pop();
}

// Why: Runs cleanup functions for a context
export function cleanupContext(context: ComponentContext): void {
  context.cleanup.forEach((cleanup) => cleanup());
  context.signals.forEach((signal) => {
    signalRegistry.unsubscribe(signal, undefined, context.id);
  });
  context.cleanup.clear();
  context.signals.clear();
}
