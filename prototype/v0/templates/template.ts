import { computed, isSignal, ReadSignal, Signal } from "../signals/signals.ts";
import { getCurrentContext } from "../context/context.ts";
import type { ComponentContext } from "../context/types.ts";

// Update types to be more specific and avoid circular references
type PrimitiveValue = string | number | boolean | null | undefined;
type NodeValue = globalThis.Node | globalThis.DocumentFragment;

// Add EventHandler type definition
type EventHandler = string | ((event: Event) => void);

// Define base template value without recursion first
type BaseTemplateValue = PrimitiveValue | NodeValue | EventHandler;

// Add these type definitions at the top with the other types
type SignalValue<T> = Signal<T> | ReadSignal<T>;
type FunctionValue<T> = () => T;

// Now define the full template value type
type TemplateValue =
  | BaseTemplateValue
  | Array<TemplateValue>
  | SignalValue<TemplateValue>
  | FunctionValue<TemplateValue>;

// Why: Type guard for signals
function isSignalLike(value: unknown): value is SignalValue<unknown> {
  return value !== null &&
    typeof value === "object" &&
    "value" in value &&
    "subscribe" in value;
}

// Why: Recursively resolves a value to its final form
function resolveValue(
  value: TemplateValue,
): PrimitiveValue | NodeValue | Array<TemplateValue> {
  // Handle functions
  if (typeof value === "function") {
    return resolveValue((value as () => TemplateValue)());
  }

  // Handle signals
  if (isSignalLike(value)) {
    return resolveValue(value.value as TemplateValue);
  }

  // Handle arrays recursively
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item));
  }

  // Handle DOM nodes
  if (
    value instanceof globalThis.Node ||
    value instanceof globalThis.DocumentFragment
  ) {
    return value.cloneNode(true) as NodeValue;
  }

  // Handle primitives and ensure null/undefined become empty string
  return value ?? "";
}

// Why: Converts resolved value to DOM node
function resolvedValueToNode(
  value: ReturnType<typeof resolveValue>,
): Node | DocumentFragment {
  if (value instanceof Node || value instanceof DocumentFragment) {
    return value.cloneNode(true);
  }

  if (Array.isArray(value)) {
    const fragment = document.createDocumentFragment();
    value.forEach((item) => {
      fragment.appendChild(resolvedValueToNode(resolveValue(item)));
    });
    return fragment;
  }

  return document.createTextNode(String(value));
}

// Why: Main conversion function for template values
function valueToNode(value: TemplateValue): Node | DocumentFragment {
  return resolvedValueToNode(resolveValue(value));
}

// Why: Tracks a section of DOM and its signal dependencies
interface TemplatePart {
  span: HTMLSpanElement;
  value: TemplateValue | EventHandler;
  currentNode: Node | null;
  signals: Set<Signal<any> | ReadSignal<any>>;
  template?: Template;
  isEventHandler?: boolean;
}

// Why: Manages template instance and tracks signal dependencies
class Template {
  private template: HTMLTemplateElement;
  private placeholders: Map<HTMLSpanElement, TemplatePart>;
  private signalMap: Map<Signal<any> | ReadSignal<any>, Set<TemplatePart>>;
  private values: TemplateValue[];

  constructor(
    html: string,
    values: TemplateValue[],
    private context: ComponentContext,
  ) {
    this.template = document.createElement("template");
    this.template.innerHTML = html;
    this.placeholders = new Map();
    this.signalMap = new Map();
    this.values = values;

    // Find and track placeholders
    const spans = this.template.content.querySelectorAll(
      "span[data-placeholder]",
    );
    spans.forEach((span) => {
      const index = parseInt(span.getAttribute("data-placeholder")!, 10);
      const part: TemplatePart = {
        span: span as HTMLSpanElement,
        value: values[index],
        currentNode: null,
        signals: new Set(),
      };
      this.placeholders.set(span as HTMLSpanElement, part);
      this.trackSignals(part);
    });
  }

  // Why: Tracks signal dependencies for a template part
  private trackSignals(part: TemplatePart) {
    const { value } = part;

    if (isSignalLike(value)) {
      part.signals.add(value);
      let deps = this.signalMap.get(value);
      if (!deps) {
        deps = new Set();
        this.signalMap.set(value, deps);
      }
      deps.add(part);
    } else if (typeof value === "function") {
      const computedSignal = computed(value as FunctionValue<unknown>);
      part.signals.add(computedSignal);
      let deps = this.signalMap.get(computedSignal);
      if (!deps) {
        deps = new Set();
        this.signalMap.set(computedSignal, deps);
      }
      deps.add(part);
    }
  }

  // Why: Updates only parts affected by a signal change
  private updateSignalParts(signal: Signal<any> | ReadSignal<any>) {
    const parts = this.signalMap.get(signal);
    if (parts) {
      parts.forEach((part) => {
        if (part.currentNode?.parentNode) {
          this.updatePart(part, part.currentNode.parentNode);
        }
      });
    }
  }

  // Why: Updates a single template part
  private updatePart(part: TemplatePart, target: Node) {
    const { value } = part;
    let newNode: Node | null = null;

    if (isSignalLike(value)) {
      newNode = valueToNode(value.value as TemplateValue);
      const unsubscribe = value.subscribe((newValue) => {
        console.log("Signal update:", { value: newValue });
        const updatedNode = valueToNode(newValue as TemplateValue);
        if (part.currentNode?.parentNode) {
          part.currentNode.parentNode.replaceChild(
            updatedNode,
            part.currentNode,
          );
          part.currentNode = updatedNode;
        }
      });
      this.context.cleanup.add(unsubscribe);
    } else if (typeof value === "function") {
      const computedSignal = computed(value as FunctionValue<unknown>);
      newNode = valueToNode(computedSignal.value as TemplateValue);
      const unsubscribe = computedSignal.subscribe((newValue) => {
        console.log("Computed update:", { value: newValue });
        const updatedNode = valueToNode(newValue as TemplateValue);
        if (part.currentNode?.parentNode) {
          part.currentNode.parentNode.replaceChild(
            updatedNode,
            part.currentNode,
          );
          part.currentNode = updatedNode;
        }
      });
      this.context.cleanup.add(unsubscribe);
    } else {
      newNode = valueToNode(value as TemplateValue);
    }

    if (part.currentNode) {
      target.replaceChild(newNode, part.currentNode);
    } else {
      target.appendChild(newNode);
    }

    part.currentNode = newNode;
    return newNode;
  }

  // Why: Creates a real DOM from template
  render(): DocumentFragment {
    console.log("render start", { template: this.template.innerHTML });

    const fragment = document.createDocumentFragment();
    const content = this.template.content.cloneNode(true) as DocumentFragment;

    // Process placeholders
    for (const [span, part] of this.placeholders) {
      const realSpan = content.querySelector(
        `[data-placeholder="${span.getAttribute("data-placeholder")}"]`,
      );
      console.log("render placeholder", {
        spanAttr: span.getAttribute("data-placeholder"),
        partValue: part.value,
        found: !!realSpan,
      });

      if (realSpan && realSpan.parentNode) {
        const node = this.updatePart(part, realSpan.parentNode);
        realSpan.parentNode.replaceChild(node, realSpan);
      }
    }

    // Process bindings only (skip event handlers)
    const elements = content.querySelectorAll("*");
    elements.forEach((element) => {
      const attrs = Array.from(element.attributes);
      console.log("render element attrs", {
        element: element.tagName,
        attrs: attrs.map((a) => `${a.name}="${a.value}"`),
      });

      // Handle data-bind attributes
      attrs.forEach((attr) => {
        if (attr.name.startsWith("data-bind-")) {
          const bindAttr = attr.name.slice("data-bind-".length);
          const valueIndex = parseInt(attr.value, 10);
          const value = this.values[valueIndex];

          if (isSignalLike(value)) {
            console.log("binding signal", { element, bindAttr, value });

            // Set up two-way binding for inputs
            if (element instanceof HTMLInputElement && bindAttr === "value") {
              // Only set up input event if the signal is writable
              if ("value" in value && typeof value.value !== "undefined") {
                element.addEventListener("input", (e) => {
                  console.log("input event", { element, value });
                  const target = e.target as HTMLInputElement;
                  if ("value" in value) {
                    (value as Signal<any>).value = target.value;
                  }
                });
              }

              // Keep input value in sync with signal
              const unsubscribe = value.subscribe((newValue) => {
                if (element.value !== newValue) {
                  element.value = String(newValue ?? "");
                }
              });
              this.context.cleanup.add(unsubscribe);
            }
          }

          // Remove the binding attribute
          element.removeAttribute(attr.name);
        }
      });
    });

    fragment.appendChild(content);
    console.log("render final", {
      html: fragment.firstElementChild?.outerHTML,
      fragmentContent: fragment.textContent,
      childNodes: Array.from(fragment.childNodes).map((n) => ({
        nodeType: n.nodeType,
        nodeName: n.nodeName,
        textContent: n.textContent,
      })),
    });
    return fragment;
  }

  // Why: Cleans up signal subscriptions
  cleanup() {
    this.signalMap.forEach((parts, signal) => {
      parts.forEach((part) => {
        part.signals.clear();
        if (part.template) {
          part.template.cleanup();
        }
      });
    });
    this.signalMap.clear();
    this.placeholders.clear();
  }
}

// Why: Process template literals while respecting different contexts
export function processTemplate(
  strings: TemplateStringsArray,
  ...values: any[]
): string {
  let result = "";

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];

    if (i < values.length) {
      const value = values[i];
      const beforeText = result.slice(0, result.length);

      console.log("processTemplate value:", {
        value,
        isSignal: isSignalLike(value),
        signalValue: isSignalLike(value) ? value.value : undefined,
      });

      // More specific attribute detection - now handles .attribute syntax
      const attributeMatch = beforeText.match(
        /\s([.:]?[\w-]+)\s*=\s*["']?\s*$/,
      );

      if (attributeMatch) {
        const fullAttrName = attributeMatch[1];
        const attrName = fullAttrName.startsWith(".")
          ? fullAttrName.slice(1)
          : fullAttrName;

        console.log("processTemplate attribute:", {
          fullAttrName,
          attrName,
          value,
        });

        // Skip processing for on: attributes
        if (attrName.startsWith("on:")) {
          result += `"${String(value)}"`;
          continue;
        }

        // Handle boolean attributes (those with . prefix)
        if (fullAttrName.startsWith(".")) {
          if (isSignalLike(value)) {
            result += `${
              value.value ? "" : "false"
            } data-bind-${attrName}="${i}"`;
          } else {
            result += value ? "" : "false";
          }
          continue;
        }

        if (isSignalLike(value)) {
          // For signals, add a data attribute to track the binding
          result += `"${
            String(value.value ?? "")
          }" data-bind-${attrName}="${i}"`;
        } else if (value && typeof value === "object" && !isSignalLike(value)) {
          if (attrName === "class") {
            const classes = Object.entries(value)
              .filter(([_, enabled]) => enabled)
              .map(([className]) => className)
              .join(" ");
            result += `"${classes}"`;
          } else {
            result += `"${JSON.stringify(value)}"`;
          }
        } else {
          result += `"${String(value ?? "")}"`;
        }
      } else {
        result += `<span data-placeholder="${i}"></span>`;
      }
    }
  }

  return result;
}

// Why: Creates a template with reactive placeholders
export function html(
  strings: TemplateStringsArray,
  ...values: TemplateValue[]
): DocumentFragment {
  const context = getCurrentContext();
  if (!context) {
    throw new Error("html template must be used within a component context");
  }

  console.log("html template start", { strings, values });
  const processedHtml = processTemplate(strings, ...values);
  console.log("html processed", { processedHtml });
  const template = new Template(processedHtml, values, context);
  const fragment = template.render();
  console.log("html final fragment", {
    fragment,
    html: fragment.firstElementChild?.outerHTML,
  });
  return fragment;
}

// Why: Helper for conditional templates
export function when<T>(
  condition: SignalValue<T> | FunctionValue<T>,
  template: (value: T) => TemplateValue,
  fallback?: (value: T) => TemplateValue,
): ReadSignal<TemplateValue> {
  return computed(() => {
    const value = isSignalLike(condition) ? condition.value : condition();
    return value ? template(value) : fallback ? fallback(value) : null;
  });
}

// Why: Helper for list templates
export function each<T>(
  items: SignalValue<T[]> | FunctionValue<T[]>,
  template: (item: T, index: number) => TemplateValue,
): ReadSignal<TemplateValue> {
  return computed(() => {
    const array = isSignalLike(items) ? items.value : items();
    return array.map((item, index) => template(item, index));
  });
}
