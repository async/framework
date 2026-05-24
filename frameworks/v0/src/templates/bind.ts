export function bind<T extends HTMLElement, E extends Event>(
  element: T,
  method: (this: T, event: E) => void,
): (event: E) => void {
  return method.bind(element);
}
