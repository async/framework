import {
  appendChild,
  handleAttribute,
  type JSXChild,
  renderComponent,
} from "./component/render.ts";

// Define types for JSX elements and children
type Signal<T> = {
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
};

type ReadSignal<T> = Omit<Signal<T>, "set">;
type JSXAttributes = Record<
  string,
  string | number | boolean | Signal<any> | ReadSignal<any> | undefined
>;
type JSXElement = HTMLElement | Element | DocumentFragment;
type Component = (props: any) => JSXElement | Signal<any>;

// Why: Provides JSX runtime support with context awareness
export function jsx(
  this: any,
  type: string | Component,
  props: Record<string, any> | null,
  ...children: JSXChild[]
): JSXElement {
  if (typeof type === "function") {
    return renderComponent(type, props, children);
  }

  const element = document.createElement(type);

  if (!props) {
    if (children.length) {
      for (const child of children) {
        appendChild(element, child);
      }
    }
    return element;
  }

  try {
    const entries = Object.entries(props);
    for (const [key, value] of entries) {
      if (key === "children") {
        const propsChildren = Array.isArray(value) ? value : [value];
        for (const child of propsChildren) {
          appendChild(element, child);
        }
      } else if (key.startsWith("on") && typeof value === "function") {
        const eventName = key.toLowerCase().slice(2);
        const handler = value;
        element.addEventListener(eventName, handler);
      } else if (value !== null && value !== undefined) {
        handleAttribute(element, key, value);
      }
    }
    if (!props.children && children.length) {
      for (const child of children) {
        appendChild(element, child);
      }
    }
  } catch (error) {
    console.error("Error setting attributes:", error);
    throw error;
  }

  return element;
}

export const jsxs = jsx;
export const jsxDEV = jsx;

// Why: Provides Fragment support with proper typing
export const Fragment = (
  props: { children: JSXChild | JSXChild[] },
): DocumentFragment => {
  const fragment = document.createDocumentFragment();
  const children = Array.isArray(props.children)
    ? props.children
    : [props.children];

  for (const child of children) {
    appendChild(fragment, child);
  }

  return fragment;
};
