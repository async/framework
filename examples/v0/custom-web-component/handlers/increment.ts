import type { AsyncLoaderContext } from "@async/framework-v0";
import type { CounterElement } from "../component.ts";

export default function handler(
  { element }: AsyncLoaderContext<any, any, any>,
) {
  const component = element.closest("counter-element") as CounterElement;
  component.increment();
}
