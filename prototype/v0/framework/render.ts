// create global signalRegistry
import { signalRegistry } from "../signals/instance.ts";
import { templateRegistry } from "../templates/instance.ts";
import { HandlerRegistry } from "../handlers/index.ts";
import { AsyncLoader } from "../loader/loader.ts";

// Export instances
export { signalRegistry, templateRegistry };
export interface RenderConfig {
  root?: HTMLElement;
  element?: HTMLElement;
  basePath?: string;
  origin?: string;
  eventPrefix?: string;
  containerAttribute?: string;
  events?: string[];
  context?: Record<string, unknown>;
  handlerRegistry?: HandlerRegistry;
}

export function render(
  element?: HTMLElement | RenderConfig,
  config?: RenderConfig,
) {
  if (element && (element as HTMLElement)?.hasAttribute?.("data-container")) {
    // only root was provided
    config = {
      root: element,
    } as RenderConfig;
    element = undefined;
  }
  if (!config) {
    if (typeof element === "object" && Object.keys(element).length > 0) {
      config = element as RenderConfig;
      element = config.element;
    }
    if (!element) {
      element = document.querySelector(
        "[data-container='root']",
      ) as HTMLElement;
    }
  }
  // Handle case where config is just the root element
  let domRoot = config instanceof HTMLElement || config === undefined
    ? config
    : config.root;
  const renderConfig: RenderConfig =
    config instanceof HTMLElement || config === undefined ? {} : config;
  if (!domRoot) {
    domRoot = document.querySelector("[data-container='root']") as HTMLElement;
    if (!domRoot) {
      throw new Error("Root element is required for rendering");
    }
  }
  const currentPath = location.pathname;
  const containerAttribute = renderConfig.containerAttribute ??
    "data-container";
  const context = renderConfig.context ?? {};
  const events = renderConfig.events ?? [];
  // should be /handlers?
  const basePath = renderConfig.basePath ?? currentPath;
  const origin = renderConfig.origin ?? "";
  const eventPrefix = renderConfig.eventPrefix ?? "on:";

  // Set container attribute for event delegation
  if (!domRoot.hasAttribute(containerAttribute)) {
    domRoot.setAttribute(containerAttribute, "root");
  }

  // Create HandlerRegistry with config
  const handlerRegistry = renderConfig.handlerRegistry ?? new HandlerRegistry({
    basePath,
    origin,
    eventPrefix,
  });

  // Create AsyncLoader with config and registry
  const loader = new AsyncLoader({
    // Pass in the registries
    handlerRegistry,
    signalRegistry,
    templateRegistry,

    events,
    containerAttribute,
    eventPrefix,
    domRoot,
    context,
  });

  // Return utilities for cleanup and access to loader/registry
  const asyncFramework = {
    loader,
    signals: signalRegistry,
    handlers: handlerRegistry,
    templates: templateRegistry,
    unmount: () => {
      if (element && domRoot !== element && element instanceof HTMLElement) {
        domRoot.removeChild(element);
      }
    },
  };
  if (typeof element === "function") {
    element = (element as Function).call(asyncFramework, renderConfig);
  }

  // Append element to root
  if (element && domRoot !== element && element instanceof HTMLElement) {
    domRoot.appendChild(element);
  } else {
    console.warn("No element provided to render hooking up to root");
  }

  // Initialize event handling
  loader.init(domRoot);
  return asyncFramework;
}

// Example usage:

// Simple: with defaults
// render();

// Container Only: with loader only no rendering
// render(document.getElementById('[data-container="root"]'));

// Client Rendering and Default Config:
// render(App);

// With Config:
// render(App, {
//   root: document.getElementById('app'),
//   basePath: './',
//   origin: '',
//   eventPrefix: 'on:',
//   context: { someSharedState: {} }
// });
