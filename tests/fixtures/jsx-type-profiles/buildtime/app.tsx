import { component, signal, type PropsOf } from "@async/framework/jsx/buildtime";
import type { Children, ComponentContext, ComponentFunction } from "@async/framework";

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

interface CardProps {
  title: string;
  children?: Children;
}

declare const context: ComponentContext;

const Card: ComponentFunction<CardProps> = function Card(props) {
  void props.children;
  return props.title;
};

context.render(Card, { title: "Status" }, "Ready");
context.render(Card, { title: "Status" }, () => "Ready");
// @ts-expect-error default children must use the third render argument after lowering.
context.render(Card, { title: "Status", children: "Ready" });
