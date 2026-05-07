import type { ComponentContext } from "../context/types.ts";
import {
  cleanupContext,
  popContext,
  pushContext,
} from "../context/context.ts";
import { isSignal } from "../signals/signals.ts";
import { renderSignalToElement } from "../component/render.ts";

// Why: Implements router outlet as custom element
export class RouterOutlet extends HTMLElement {
  private context: ComponentContext | null = null;
  private routes: Map<string, () => Promise<any>> = new Map();

  static get observedAttributes() {
    return ["route"];
  }

  connectedCallback() {
    this.style.display = "contents";
  }

  disconnectedCallback() {
    this.cleanup();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === "route" && oldValue !== newValue) {
      this.updateRoute(newValue);
    }
  }

  private cleanup() {
    if (this.context) {
      cleanupContext(this.context);
      this.context = null;
    }
    this.innerHTML = "";
  }

  private async updateRoute(route: string) {
    this.cleanup();

    try {
      // Load component for route
      const component = await this.loadComponent(route);
      if (!component) {
        console.warn(`No component found for route: ${route}`);
        return;
      }

      // Create new context and render component
      const context = pushContext(this);
      this.context = context;

      try {
        const result = component({});
        if (isSignal(result)) {
          renderSignalToElement(result, this, context);
        } else if (result instanceof Node) {
          this.appendChild(result);
        }

        context.mounted = true;
      } finally {
        popContext();
      }
    } catch (error) {
      console.error("Failed to render route:", error);
    }
  }

  // Register a route handler
  registerRoute(path: string, loader: () => Promise<any>) {
    this.routes.set(path, loader);
  }

  private async loadComponent(route: string) {
    const loader = this.routes.get(route);
    if (!loader) return null;

    try {
      return await loader();
    } catch (error) {
      console.error(`Failed to load component for route ${route}:`, error);
      return null;
    }
  }
}

customElements.define("router-outlet", RouterOutlet);
