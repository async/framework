import type { Signal } from "./signals.ts";

export class SignalRegistry {
  private static instance: SignalRegistry;
  private subscriptions = new Map<
    string,
    Map<string, Set<(value: any, oldValue: any) => void>>
  >();
  private signals = new Map<string, Signal<any>>();
  private globalId = "global";

  private constructor() {}

  static getInstance(): SignalRegistry {
    if (!SignalRegistry.instance) {
      SignalRegistry.instance = new SignalRegistry();
    }
    return SignalRegistry.instance;
  }

  register<T>(signal: Signal<T>): void {
    if (this.signals.has(signal.id)) {
      console.error(`Signal with id ${signal.id} already registered`);
      return;
    }
    if (signal.id === "global") {
      console.error(`Signal with id ${signal.id} is reserved`);
      return;
    }
    if (!signal.id) {
      console.error(`Signal with id ${signal.id} is required`);
      return;
    }
    this.signals.set(signal.id, signal);
  }
  set<T>(signal: Signal<T>): void {
    return this.register(signal);
  }

  get<T>(signalId: string): Signal<T> | undefined {
    if (!signalId) {
      console.error(`Signal with id ${signalId} is required`);
      return;
    }
    if (signalId === "global") {
      console.error(`Signal with id ${signalId} is reserved`);
      return;
    }
    if (!this.signals.has(signalId)) {
      console.error(`Signal with id ${signalId} is not registered`);
      return;
    }
    return this.signals.get(signalId) as Signal<T> | undefined;
  }

  getAllSignals(): Map<string, Signal<any>> {
    return new Map(this.signals);
  }

  subscribe<T>(
    signal: Signal<T>,
    callback: (value: T, oldValue: T) => void,
    contextId?: string,
  ): () => void {
    const signalId = signal.id;
    const subId = contextId || this.globalId;

    if (!this.subscriptions.has(signalId)) {
      this.subscriptions.set(signalId, new Map());
    }

    const signalSubs = this.subscriptions.get(signalId)!;
    if (!signalSubs.has(subId)) {
      signalSubs.set(subId, new Set());
    }

    signalSubs.get(subId)!.add(callback);

    return () => this.unsubscribe(signal, callback, contextId);
  }

  unsubscribe<T>(
    signal: Signal<T>,
    callback?: (value: T, oldValue: T) => void,
    contextId?: string,
  ): void {
    const signalId = signal.id;
    const subId = contextId || this.globalId;

    const signalSubs = this.subscriptions.get(signalId);
    if (!signalSubs) return;

    if (callback) {
      // Remove specific callback
      const callbacks = signalSubs.get(subId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          signalSubs.delete(subId);
        }
      }
    } else {
      // Remove all callbacks for context
      signalSubs.delete(subId);
    }

    if (signalSubs.size === 0) {
      this.subscriptions.delete(signalId);
    }
  }

  notify<T>(signal: Signal<T>, newValue: T, oldValue: T): void {
    const signalId = signal.id;
    const signalSubs = this.subscriptions.get(signalId);
    if (!signalSubs) return;

    signalSubs.forEach((callbacks) => {
      callbacks.forEach((callback) => callback(newValue, oldValue));
    });
  }
}
