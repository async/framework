import {
  ReadSignal,
  Signal,
  signal as createSignal,
} from "../signals/index.ts";

// TODO: rename to when()
// Why: Provides a type-safe way to handle conditional rendering based on signals
export function iif<T = any, C = any>(
  condition: Signal<C> | ReadSignal<C>,
  first: (val: C) => T,
  second: (val?: C) => T | null = () => null,
) {
  const result = condition.value;
  let val = Boolean(result);
  if (Array.isArray(result)) {
    val = result.length > 0;
  }
  const resultSignal = createSignal<T | null>(
    val ? first(result) : second(result),
  );
  condition.subscribe((newValue) => {
    let val = Boolean(newValue);
    if (Array.isArray(newValue)) {
      val = newValue.length > 0;
    }
    // console.log("iif", condition.value, first(),  second());
    resultSignal.value = val ? first(newValue) : second(newValue);
  });
  // TODO: this shouldn't live here
  // Remove old value if it exists
  resultSignal.subscribe((newValue, oldValue: any) => {
    // TODO:signal arrays type??
    if (Array.isArray(newValue) && Array.isArray(oldValue)) {
      for (const child of oldValue) {
        if (child && child?.remove && child?.isConnected) {
          child.remove();
        }
      }
    } else if (oldValue && oldValue?.remove && oldValue?.isConnected) {
      // TODO: handle dom elements
      oldValue.remove();
    }
  });
  return resultSignal;
}
