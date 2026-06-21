import { component, type PropsOf } from "@async/framework/jsx/buildtime";

const invalidSignalProps: PropsOf<"button"> = {
  // @ts-expect-error strict buildtime props reject protocol signal bindings.
  "signal:text": "count"
};

const invalidClassProps: PropsOf<"button"> = {
  // @ts-expect-error strict buildtime props reject protocol class toggles.
  "class:active": true
};

void invalidSignalProps;
void invalidClassProps;

export const InvalidBuildtime = component(() => (
  <button
    // @ts-expect-error strict buildtime JSX rejects protocol event props.
    on:click="increment"
  >
    Count
  </button>
));
