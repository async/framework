export type Subscriber<T> = (next: T, prev: T) => void;

type Computation = {
  run: () => void;
  deps: Set<Set<Computation>>;
};

export type Signal<T> = {
  get value(): T;
  set value(next: T);
  subscribe: (subscriber: Subscriber<T>) => () => void;
  peek: () => T;
};

let activeComputation: Computation | null = null;

function cleanupComputation(computation: Computation) {
  computation.deps.forEach((depSet) => depSet.delete(computation));
  computation.deps.clear();
}

function trackDependency(observers: Set<Computation>) {
  if (!activeComputation) return;
  observers.add(activeComputation);
  activeComputation.deps.add(observers);
}

export function signal<T>(initial: T): Signal<T> {
  let current = initial;
  const subscribers = new Set<Subscriber<T>>();
  const observers = new Set<Computation>();

  const notify = (next: T, prev: T) => {
    subscribers.forEach((subscriber) => subscriber(next, prev));
    [...observers].forEach((computation) => computation.run());
  };

  return {
    get value() {
      trackDependency(observers);
      return current;
    },
    set value(next: T) {
      const prev = current;
      if (Object.is(prev, next)) return;
      current = next;
      notify(next, prev);
    },
    subscribe(subscriber: Subscriber<T>) {
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
    peek() {
      return current;
    },
  };
}

function createComputation(run: () => void): Computation {
  const computation: Computation = {
    deps: new Set(),
    run: () => {
      cleanupComputation(computation);
      const prev = activeComputation;
      activeComputation = computation;
      try {
        run();
      } finally {
        activeComputation = prev;
      }
    },
  };
  return computation;
}

export function computed<T>(calc: () => T): Signal<T> {
  const target = signal<T>(undefined as T);
  const computation = createComputation(() => {
    target.value = calc();
  });
  computation.run();
  return target;
}

export function effect(run: () => void) {
  const computation = createComputation(run);
  computation.run();
  return () => cleanupComputation(computation);
}
