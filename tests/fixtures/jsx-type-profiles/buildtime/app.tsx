import { component, signal, type PropsOf } from "@async/framework/jsx/buildtime";

const count = signal(0);

const buttonProps: PropsOf<"button"> = {
  onClick(event) {
    event.currentTarget.setAttribute("data-clicked", "true");
  },
  value: count,
  "data-testid": "count"
};

export const Counter = component(() => (
  <button {...buttonProps}>
    Count
  </button>
));

export const buildtimeView = (
  <section onPointerEnter={() => undefined}>
    Count
  </section>
);
