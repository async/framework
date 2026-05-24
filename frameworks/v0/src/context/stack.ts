import type { BaseContext } from "./types.ts";

// Why: Manages the context stack
export class ContextStack {
  private static instance: ContextStack;
  private stack: BaseContext[] = [];

  static getInstance(): ContextStack {
    if (!ContextStack.instance) {
      ContextStack.instance = new ContextStack();
    }
    return ContextStack.instance;
  }

  push(context: BaseContext): void {
    this.stack.push(context);
  }

  pop(): BaseContext | undefined {
    return this.stack.pop();
  }

  peek(): BaseContext | undefined {
    return this.stack[this.stack.length - 1];
  }

  clear(): void {
    this.stack = [];
  }
}
