import { getCurrentContext } from "../context/context.ts";
import { contextRegistry } from "../context/instance.ts";
import { ComponentContext, ComputedContext } from "../context/types.ts";
import { SignalRegistry } from "./registry.ts";

// Why: Tracks the current computation context for signal dependencies
// TODO: refactor to context and slacks
let currentTracker: (() => void) | null = null;

/**
 * Symbol used to tell `Signal`s apart from other functions.
 *
 * This can be used to auto-unwrap signals in various cases, or to auto-wrap non-signal values.
 */
export const SIGNAL = /* @__PURE__ */ Symbol("SIGNAL");

export interface Signal<T> {
  id: string;
  type: string;
  value: T;
  get: () => T;
  set: (value: T) => void;
  subscribe: (
    callback: (value: T, oldValue: T) => void,
    contextId?: string,
  ) => () => void;
  track: <R>(computation: () => R) => R;
  valueOf: () => T;
}

export interface SignalOptions {
  id?: string;
  context?: string;
}

// Add this interface to properly type the signal context
interface SignalContext<T> {
  type: string;
  id: string;
  cleanup: Set<() => void>;
  parent: ComponentContext | null;
  value: T;
}

// Why: Creates a signal with tracking capabilities
export function signal<T>(
  initialValue: T,
  options: SignalOptions | string = {},
) {
  const context = getCurrentContext();
  if (typeof options === "string") {
    options = { id: options };
  }
  const id = options.id || contextRegistry.generateId("signal", context?.id);

  // TODO: better way to get signal registry
  const signalRegistry = SignalRegistry.getInstance();
  // Update the signal context with proper typing
  const signalContext: SignalContext<T> = {
    type: "signal",
    id,
    cleanup: new Set<() => void>(),
    parent: context || null,
    value: initialValue,
  };

  contextRegistry.setContext(id, signalContext);

  let value = initialValue;

  // Create the signal object first so we can pass it to the registry
  const signalObj = {
    id,
    type: "signal",
    get value() {
      return get.call(signalObj);
    },
    set value(newValue: T) {
      set.call(signalObj, newValue);
    },
    get,
    set,
    subscribe(
      callback: (value: T, oldValue: T) => void,
      subContextId?: string,
    ) {
      return signalRegistry.subscribe(
        signalObj,
        callback,
        subContextId || context?.id,
      );
    },
    track<R>(computation: () => R): R {
      const prevTracker = currentTracker;
      currentTracker = function signalComputed() {
        return computation.call(signalObj);
      };
      try {
        return computation.call(signalObj);
      } finally {
        currentTracker = prevTracker;
      }
    },
    valueOf: () => value,
  };

  function get() {
    if (currentTracker) {
      signalRegistry.subscribe(signalObj, currentTracker, context?.id);
    }
    return value;
  }

  function set(newValue: T) {
    const oldValue = value;
    if (isSignal(oldValue) || isSignal(newValue)) {
      console.log("signal.set: oldValue is a signal", oldValue);
      return;
    }
    if (newValue === oldValue) return;

    value = newValue;
    signalRegistry.notify(signalObj, newValue, oldValue);
  }

  get[SIGNAL] = signalObj;
  set[SIGNAL] = signalObj;
  signalObj[SIGNAL] = signalObj;

  // Register the signal
  signalRegistry.register(signalObj);

  return signalObj;
}

// Why: Type guard for signals
export function isSignal(value: unknown): value is Signal<any> {
  return value !== null &&
    typeof value === "object" &&
    "type" in (value as any) &&
    (value as any).type.includes("signal");
}

// Why: Creates a read-only version of a signal
export type ReadSignal<T> = Omit<Signal<T>, "set" | "value"> & {
  readonly value: T;
  [SIGNAL]: Signal<T>;
};

// Why: To create a signal with a getter, setter, and signal object
export function createSignal<T>(
  initialValue: T,
  options: SignalOptions = {},
): [() => T, (newValue: T) => void] {
  const sig = signal<T>(initialValue, options);
  return [sig.get, sig.set];
}

// Why: Creates a read-only version of a signal
export function readSignal<T>(sig: Signal<T>): ReadSignal<T> {
  return {
    id: sig.id,
    type: "read-signal",
    get: sig.get,
    subscribe: (
      callback: (value: T, oldValue: T) => void,
      contextId?: string,
    ) => sig.subscribe(callback, contextId),
    track: sig.track,
    valueOf: sig.valueOf,
    get value() {
      return sig.value;
    },
    [SIGNAL]: sig,
  };
}

// Why: Creates a computed signal that tracks its dependencies
export function computed<T>(
  computation: () => T,
  options: SignalOptions = {},
): ReadSignal<T> {
  const context = getCurrentContext();
  const id = options.id ||
    contextRegistry.generateId("computed", options.context || context?.id);

  const computedContext: ComputedContext = {
    type: "computed",
    id,
    cleanup: new Set(),
    parent: context || null,
    value: undefined,
    dependencies: new Set(),
  };

  contextRegistry.setContext(id, computedContext);

  const sig = signal<T>(computation(), { id });

  // Track dependencies
  sig.track(function signalComputed() {
    const newValue = computation();
    computedContext.value = newValue;
    sig.value = newValue;
  });

  return readSignal(sig);
}

// Why: Creates a computed signal that returns getter and read-only signal
export function createComputed<T>(
  computation: () => T,
  options: SignalOptions = {},
): [() => T] {
  const context = getCurrentContext();
  const id = options.id ||
    contextRegistry.generateId("computed", options.context || context?.id);

  const sig = signal<T>(computation(), { id, context: options.context });

  sig.track(function signalComputed() {
    sig.value = computation();
  });

  return [sig.get];
}

// Why: Creates a resource signal that handles async data loading
export function createResource<T = any>(
  fetcher: (
    track: <R>(fn: () => R) => R,
  ) => Promise<T | Signal<T> | ReadSignal<T>>,
  options: SignalOptions = {},
): {
  data: Signal<T | undefined>;
  loading: Signal<boolean>;
  error: Signal<Error | undefined>;
  dispose: () => void;
} {
  const context = getCurrentContext();
  const baseId = options.id ||
    contextRegistry.generateId("resource", options.context || context?.id);

  const data = signal<T | undefined>(undefined, {
    id: `${baseId}.data`,
    context: options.context,
  });
  const loading = signal(true, {
    id: `${baseId}.loading`,
    context: options.context,
  });
  const error = signal<Error | undefined>(undefined, {
    id: `${baseId}.error`,
    context: options.context,
  });

  let isDisposed = false;
  let cleanup: (() => void) | undefined;

  function track<R>(fn: () => R): R {
    return data.track(fn);
  }

  async function load() {
    if (isDisposed) return;

    loading.value = true;
    error.value = undefined;

    try {
      const result = await fetcher(track);
      if (!isDisposed) {
        if (isSignal(result)) {
          const signalResult = result as Signal<T>;
          data.value = signalResult.value;
          cleanup = signalResult.subscribe((newValue) => {
            if (!isDisposed) {
              data.value = newValue;
            }
          }, options.context || context?.id);
        } else {
          data.value = result as T;
        }
      }
    } catch (err) {
      if (!isDisposed) {
        error.value = err instanceof Error ? err : new Error(String(err));
      }
    } finally {
      if (!isDisposed) {
        loading.value = false;
      }
    }
  }

  // Initial load
  load();

  const dispose = () => {
    isDisposed = true;
    if (cleanup) {
      cleanup();
    }
  };

  return { data, loading, error, dispose };
}
