import { component } from "@async/framework/jsx/runtime";

export const InvalidRuntime = component(() => (
  <button
    // @ts-expect-error strict runtime JSX rejects JSX-native event props.
    onClick={() => undefined}
  >
    Count
  </button>
));
