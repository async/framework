import {
  getCurrentContext,
  popContext,
  pushContext,
} from "./context.ts";
import type { ComponentContext } from "./types.ts";
import { contextRegistry } from "./instance.ts";

// Why: Sanitizes element names for context IDs
export function sanitizeElementName(element: HTMLElement | null): string {
  if (!element) return "anonymous";
  const name = element.tagName.toLowerCase();
  return `ctx-${name.includes("-") ? name : `el-${name}`}`;
}


export interface ContextWrapper<T extends HTMLElement = HTMLElement> {
  cleanup(): void;
  context: ComponentContext;
  render(fn: () => DocumentFragment): void;
  update(fn: () => DocumentFragment): void;
  mounted: boolean;
}


export function wrapContext<T extends HTMLElement>(
  element: T,
  fn: (context: ComponentContext) => void,
): ContextWrapper<T> {
  const parentContext = getCurrentContext();
  const context = pushContext(element, parentContext);

  const elementName = sanitizeElementName(element);
  context.id = contextRegistry.generateId(elementName, parentContext?.id);

  try {
    fn(context);
  } finally {
    popContext();
  }
  let mounted = false;

  return {
    cleanup() {
      if (context.cleanup) {
        context.cleanup.forEach((cleanup) => cleanup());
        context.cleanup.clear();
      }
      if (context.signals) {
        context.signals.clear();
      }
      mounted = false;
    },
    get context() {
      return context;
    },
    render(fn: () => DocumentFragment, renderFn?: (template: DocumentFragment) => void) {
      // Push context before rendering
      pushContext(element, context);
      try {
        if (!mounted) {
          mounted = true;
        }
        if (renderFn) {
          renderFn(fn());
        } else {
          const template = fn();
          // TODO: better way to "render"
          if (element) {
            element.innerHTML = "";
            element.appendChild(template.cloneNode(true));
          }
        }
      } finally {
        popContext();
      }
    },
    update(fn: () => DocumentFragment) {
      if (this.mounted) {
        this.render(fn);
      } else {
        console.warn("Wrapper is not mounted, skipping update.");
      }
    },
    get mounted() {
      return mounted;
    },
  };
}
