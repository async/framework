import { signal, type Signal } from "./signals-lite.ts";

type SignalInput<T> = T | Signal<T>;

export class SignalRegistry {
  private readonly store = new Map<string, Signal<unknown>>();

  register<T>(id: string, source: SignalInput<T>) {
    const value = isSignal<T>(source) ? source : signal(source);
    this.store.set(id, value as Signal<unknown>);
    return value;
  }

  ensure<T>(id: string, initial: T) {
    if (!this.store.has(id)) {
      return this.register(id, initial);
    }
    return this.get<T>(id)!;
  }

  has(id: string) {
    return this.store.has(id);
  }

  get<T>(id: string) {
    return this.store.get(id) as Signal<T> | undefined;
  }

  getOrThrow<T>(id: string) {
    const target = this.get<T>(id);
    if (!target) throw new Error(`Signal not found in registry: ${id}`);
    return target;
  }

  set<T>(id: string, next: T) {
    const target = this.getOrThrow<T>(id);
    target.value = next;
    return target.value;
  }

  peek<T>(id: string) {
    return this.getOrThrow<T>(id).peek();
  }

  subscribe<T>(id: string, subscriber: (next: T, prev: T) => void) {
    return this.getOrThrow<T>(id).subscribe(subscriber);
  }

  link<T>(id: string) {
    return this.getOrThrow<T>(id);
  }

  entries() {
    return [...this.store.entries()];
  }
}

export function createSignalRegistry() {
  return new SignalRegistry();
}

export const globalSignalRegistry = createSignalRegistry();

function isSignal<T>(input: SignalInput<T>): input is Signal<T> {
  return typeof input === "object" && input !== null && "subscribe" in input &&
    "peek" in input && "value" in input;
}
