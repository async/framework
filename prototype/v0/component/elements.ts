// New file for custom elements definitions
import type { ComponentContext } from "../context/types.ts";

// Why: Provides a base element for signals with lifecycle management
export class AsyncSignalElement extends HTMLElement {
  context?: ComponentContext;

  constructor() {
    super();
    this.style.display = "contents";
  }

  connectedCallback() {
    // Signal mount logic will be handled by the render function
  }

  disconnectedCallback() {
    // Cleanup when element is removed
    this.context?.cleanup.forEach((cleanup) => cleanup());
  }
}

// Why: Provides a base element for components with lifecycle management
export class AsyncComponentElement extends HTMLElement {
  context?: ComponentContext;

  constructor() {
    super();
    this.style.display = "contents";
  }

  connectedCallback() {
    if (this.context) {
      this.context.mounted = true;
    }
  }

  disconnectedCallback() {
    // Cleanup when element is removed
    this.context?.cleanup.forEach((cleanup) => cleanup());
  }
}

// Register custom elements
customElements.define("async-signal", AsyncSignalElement);
customElements.define("async-component", AsyncComponentElement);
