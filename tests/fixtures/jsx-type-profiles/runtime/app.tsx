import { component, signal, type PropsOf } from "@async/framework/jsx/runtime";

const count = signal(0);

const buttonProps: PropsOf<"button", "runtime"> = {
  "on:click": "increment",
  "signal:text": count,
  "class:active": true,
  "data-testid": "count",
  "aria-live": "polite"
};

export const Counter = component(() => (
  <button {...buttonProps}>
    Count
  </button>
));

export const runtimeView = (
  <section signal:text={count} class:ready={true}>
    Count
  </section>
);
