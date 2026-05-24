import { SIGNAL, Signal } from "../signals/signals.ts";
import type { ComponentContext } from "../context/types.ts";
import { getCurrentContext, popContext, pushContext } from "../context/context.ts";
import { AsyncComponentElement, AsyncSignalElement } from "./elements.ts";

// Update appendChild to use AsyncSignalElement
export function appendChild(
  parent: HTMLElement | DocumentFragment,
  child: JSXChild,
): void {
  if (child === null || child === undefined) {
    return;
  }

  // grab signal from element
  // this is the same as Solid signal getter/setter
  if (!isSignal(child) && child[SIGNAL]) {
    child = child[SIGNAL];
  }

  if (isSignal(child)) {
    const wrapper = new AsyncSignalElement();
    const context = pushContext(wrapper);
    try {
      wrapper.context = context;
      wrapper.setAttribute("signal-id", child.id);
      wrapper.setAttribute("signal-type", child.type);
      wrapper.setAttribute("context-id", context.id);

      renderSignalToElement(child, wrapper, context);
      appendChild(parent, wrapper);
    } finally {
      popContext();
    }
    return;
  }

  if (
    typeof child === "string" ||
    typeof child === "number" ||
    typeof child === "boolean"
  ) {
    parent.appendChild(document.createTextNode(String(child)));
    return;
  }

  if (
    child instanceof Node ||
    child instanceof DocumentFragment ||
    child instanceof Text ||
    child instanceof Comment ||
    child instanceof HTMLElement ||
    child instanceof HTMLDivElement
  ) {
    parent.appendChild(child);
    return;
  }

  if (Array.isArray(child)) {
    for (const subChild of child) {
      appendChild(parent, subChild);
    }
    return;
  }

  parent.appendChild(document.createTextNode(String(child)));
}

// Why: Handles rendering of signal values while preserving existing content
export function renderSignalToElement(
  signal: Signal<any>,
  element: HTMLElement,
  context: ComponentContext,
) {
  let currentNode: Text | Node | null = null;

  const updateContent = (value: any) => {
    // Handle different types of signal values
    let newNode: Node;

    if (value instanceof Node) {
      newNode = value;
    } else if (typeof value === "function") {
      const result = value();
      if (result instanceof Node) {
        newNode = result;
      } else {
        return appendChild(element, result);
        // newNode = document.createTextNode(String(result));
      }
    } else if (isSignal(value)) {
      // For computed signals, we want to use their current value
      const computedValue = value.value;
      if (computedValue instanceof Node) {
        newNode = computedValue;
      } else if (typeof computedValue === "function") {
        const result = computedValue();
        newNode = document.createTextNode(String(result));
      } else if (Array.isArray(computedValue)) {
        newNode = document.createDocumentFragment();
        for (const child of computedValue) {
          appendChild(newNode as DocumentFragment, child);
        }
      } else {
        newNode = document.createTextNode(String(computedValue));
      }
    } else if (Array.isArray(value)) {
      newNode = document.createDocumentFragment();
      for (const child of value) {
        appendChild(newNode as DocumentFragment, child);
      }
    } else {
      // Handle primitive values and objects
      const stringValue = value?.valueOf?.() ?? value;
      newNode = document.createTextNode(String(stringValue ?? ""));
    }

    if (!currentNode) {
      currentNode = newNode;
      element.appendChild(currentNode);
    } else if (element.firstChild === currentNode) {
      element.replaceChild(newNode, currentNode);
      currentNode = newNode;
    } else {
      currentNode = newNode;
      appendChild(element, currentNode);
    }
  };

  updateContent(signal.value);

  // Subscribe using the hierarchical context ID
  const unsubscribe = signal.subscribe((newValue) => {
    updateContent(newValue);
  }, context.id); // Use context.id directly since it's already hierarchical

  context.cleanup.add(unsubscribe);
  context.signals.add(signal);
}

// Why: Handles rendering of different value types to DOM elements
export function renderValueBasedOnType(
  parent: HTMLElement | DocumentFragment,
  type: string,
  newValue: any,
  oldValue: any,
) {
  switch (type) {
    case "number":
    case "string":
    case "boolean":
      const oldValueString = String(oldValue);
      const newValueString = String(newValue);
      const textNode = document.createTextNode(newValueString);
      if (parent && !parent.firstChild) {
        parent.appendChild(textNode);
        return;
      }
      let replaced = false;
      Array.from(parent.childNodes).forEach((child) => {
        if (child.textContent === oldValueString) {
          parent.replaceChild(textNode, child);
          replaced = true;
        }
      });
      if (!replaced) {
        parent.appendChild(textNode);
      }
      break;
    case "function":
      const result = newValue();
      return renderValueBasedOnType(parent, typeof result, result, oldValue);
    default:
      if (parent.firstElementChild === oldValue && parent.firstElementChild) {
        parent.replaceChild(newValue, parent.firstElementChild);
      } else if (parent.firstChild === oldValue && parent.firstChild) {
        parent.replaceChild(newValue, parent.firstChild);
      } else if (Array.isArray(newValue)) {
        for (const child of newValue) {
          appendChild(parent, child);
        }
      } else if (newValue === null && oldValue) {
        if (Array.isArray(oldValue)) {
          for (const child of oldValue) {
            parent.removeChild(child);
          }
        } else {
          parent.removeChild(oldValue);
        }
      } else if (isSignal(newValue?.type)) {
        const value = newValue.value;
        renderValueBasedOnType(parent, typeof value, value, oldValue);
        return;
      } else {
        parent.appendChild(newValue);
      }
  }
}

// Why: Handles attribute updates for DOM elements
export function handleAttribute(
  element: HTMLElement,
  key: string,
  value: any,
): void {
  if (isSignal(value)) {
    const updateAttribute = (newValue: any) => {
      if (newValue === null || newValue === undefined) {
        element.removeAttribute(key);
        return;
      }

      // Get the actual value, handling both regular and computed signals
      const finalValue = isSignal(newValue) ? newValue.value : newValue;

      if (key === "class" || key === "className") {
        // For class attributes, handle both string and object formats
        if (typeof finalValue === "object" && !Array.isArray(finalValue)) {
          element.className = Object.entries(finalValue)
            .filter(([_, v]) => v)
            .map(([k]) => k)
            .join(" ");
        } else {
          element.className = String(finalValue);
        }
      } else if (key === "value" && element instanceof HTMLInputElement) {
        element.value = String(finalValue);
      } else {
        element.setAttribute(key, String(finalValue));
      }
    };

    // Initial update
    updateAttribute(value.value);

    // Subscribe to changes
    const unsubscribe = value.subscribe((newValue) => {
      updateAttribute(newValue);
    });

    // Store cleanup in the element's context
    const context = pushContext(element);
    context.cleanup.add(unsubscribe);
    popContext();
  } else {
    // Handle non-signal values
    if (value === null || value === undefined) {
      element.removeAttribute(key);
    } else if (key === "class" || key === "className") {
      if (typeof value === "object" && !Array.isArray(value)) {
        element.className = Object.entries(value)
          .filter(([_, v]) => v)
          .map(([k]) => k)
          .join(" ");
      } else {
        element.className = String(value);
      }
    } else if (key === "value" && element instanceof HTMLInputElement) {
      element.value = String(value);
    } else {
      element.setAttribute(key, String(value));
    }
  }
}

// Helper function to check if a value is a signal
function isSignal(value: unknown): value is Signal<any> {
  return value !== null &&
    typeof value === "object" &&
    "type" in (value as any) &&
    (value as any).type.includes("signal");
}

// Add necessary type definitions
export type JSXChild =
  | string
  | number
  | boolean
  | Node
  | Signal<any>
  | JSXChild[]
  | null
  | undefined;

// Update the jsx function's component handling
export function renderComponent(
  type: Function,
  props: Record<string, any> | null,
  children: JSXChild[],
): Element {
  const wrapper = new AsyncComponentElement();
  const parentContext = getCurrentContext();
  const context = pushContext(wrapper, parentContext);

  try {
    wrapper.context = context;
    wrapper.setAttribute("component-name", type.name || "anonymous");
    wrapper.setAttribute("context-id", context.id);

    const result = type.call(null, { ...props, children });

    if (isSignal(result)) {
      renderSignalToElement(result, wrapper, context);
    } else if (result instanceof Node) {
      wrapper.appendChild(result);
    } else if (result !== null && result !== undefined) {
      wrapper.appendChild(document.createTextNode(String(result)));
    }

    return wrapper;
  } finally {
    popContext();
  }
}
