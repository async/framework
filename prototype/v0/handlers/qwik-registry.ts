// deno-lint-ignore-file no-explicit-any
import { HandlerRegistry } from "./registry.ts";
import { isPromise } from "../utils.ts";

interface QwikHandlerContext {
  qBase?: string;
  qManifest?: string;
  qVersion?: string;
  href?: string;
  symbol?: string;
  element?: Element;
  reqTime?: number;
  error?: Error;
  importError?: "sync" | "async" | "no-symbol";
}

interface QwikInvocationContext {
  readonly $type$: string;
  readonly $element$: Element;
  readonly $event$: Event;
  readonly $url$: URL;
  readonly $qrl$: string;
  readonly $props$: Record<string, any>;
  readonly $renderCtx$?: { [key: string]: any };
  readonly $seq$?: number;
  readonly $hostElement$?: Element;
  readonly $locale$?: string;
}

export class QwikHandlerRegistry extends HandlerRegistry {
  private qwikContainers: WeakMap<Element, any>;
  private visibilityObservers: WeakMap<
    Element | ShadowRoot,
    IntersectionObserver
  >;

  constructor(config: any = {}) {
    super(config);
    this.qwikContainers = new WeakMap();
    this.visibilityObservers = new WeakMap();
  }

  /**
   * Checks if an element is within a Qwik container
   */
  private isQwikElement(element: Element): boolean {
    return !!element.closest("[q\\:container]");
  }

  /**
   * Gets Qwik container metadata
   */
  private getQwikContainer(element: Element) {
    const container = element.closest("[q\\:container]");
    if (!container) return null;

    if (this.qwikContainers.has(container)) {
      return this.qwikContainers.get(container);
    }

    const containerData = {
      qBase: container.getAttribute("q:base"),
      qVersion: container.getAttribute("q:version") || "unknown",
      qManifest: container.getAttribute("q:manifest-hash") || "dev",
      qInstance: container.getAttribute("q:instance"),
    };

    this.qwikContainers.set(container, containerData);
    return containerData;
  }

  /**
   * Resolves container JSON if needed
   */
  private resolveContainer(container: Element) {
    const Q_JSON = "_qwikjson_";
    if ((container as any)[Q_JSON] === undefined) {
      const parentJSON = container === document.documentElement
        ? document.body
        : container;
      let script = parentJSON.lastElementChild;
      while (script) {
        if (
          script.tagName === "SCRIPT" &&
          script.getAttribute("type") === "qwik/json"
        ) {
          (container as any)[Q_JSON] = JSON.parse(
            script.textContent!.replace(/\\x3C(\/?script)/gi, "<$1"),
          );
          break;
        }
        script = script.previousElementSibling;
      }
    }
  }

  /**
   * Emits Qwik-specific events
   */
  private emitQwikEvent(eventName: string, detail: QwikHandlerContext) {
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
  }

  /**
   * Creates a Qwik invocation context
   */
  private createInvocationContext(
    element: Element,
    event: Event,
    url: URL,
    props = {},
  ): QwikInvocationContext {
    return {
      $type$: "event",
      $element$: element,
      $event$: event,
      $url$: url,
      $qrl$: url.toString(),
      $props$: props,
      $renderCtx$: (element as any)._qc_,
      $seq$: 0,
      $hostElement$: element.closest("[q\\:container]") || undefined,
      $locale$: document.documentElement.lang || undefined,
    };
  }

  /**
   * Sets up the Qwik invocation context
   */
  private setInvocationContext(context: QwikInvocationContext): void {
    const doc = document as any;
    doc.__q_context__ = [
      context.$element$,
      context.$event$,
      context.$url$,
      context,
    ];
  }

  /**
   * Override handler to support Qwik-specific behavior
   */
  override async handler(context: any) {
    // Check if this is a Qwik element
    if (context.element && this.isQwikElement(context.element)) {
      const container = this.getQwikContainer(context.element);
      if (!container) return context;

      // Process container for shadow roots and visibility
      const containerEl = context.element.closest("[q\\:container]")!;
      if (!this.visibilityObservers.has(containerEl)) {
        this.findShadowRoots(containerEl);
        this.setupVisibilityObserver(containerEl);
      }

      // Enhance context with Qwik data
      context.qBase = container.qBase;
      context.qVersion = container.qVersion;
      context.qManifest = container.qManifest;
      context.qInstance = container.qInstance;

      try {
        // Add prevention checks
        if (
          context.element.hasAttribute("preventdefault:" + context.eventName)
        ) {
          context.event.preventDefault();
        }
        if (
          context.element.hasAttribute("stoppropagation:" + context.eventName)
        ) {
          context.event.stopPropagation();
        }

        // Handle sync Qwik handlers
        if (context.attrValue.startsWith("#")) {
          const symbol = context.attrValue.slice(1);
          const handler =
            ((document as any)["qFuncs_" + container.qInstance] || [])[
              Number.parseInt(symbol)
            ];

          if (!handler) {
            throw new Error("sync handler error for symbol: " + symbol);
          }

          context.value = await this.executeQwikHandler(handler, context);
          return context;
        }

        // Handle async Qwik handlers
        this.resolveContainer(context.element.closest("[q\\:container]")!);
        return await super.handler(context);
      } catch (error) {
        const eventData: QwikHandlerContext = {
          qBase: container.qBase,
          qManifest: container.qManifest,
          qVersion: container.qVersion,
          element: context.element,
          reqTime: performance.now(),
          error: error as Error,
          importError: context.attrValue.startsWith("#") ? "sync" : "async",
        };

        this.emitQwikEvent("qerror", eventData);
        throw error;
      }
    }

    // Not a Qwik element, use default handling
    return super.handler(context);
  }

  /**
   * Override getHandler to support Qwik URL resolution and symbols
   */
  override async getHandler(scriptPath: string, context: any) {
    if (context.element && this.isQwikElement(context.element)) {
      const [path, hash] = scriptPath.split("#");
      const container = this.getQwikContainer(context.element);

      if (container) {
        const isSync = path.startsWith("#");

        // Parse the symbol and lexical scope indices
        let symbol = hash || "default";
        let lexicalIndices: number[] = [];

        // Check for lexical scope indices (e.g., s_gRRz00JItKA[0,1])
        const lexicalMatch = symbol.match(/^(.+?)\[([^\]]+)\]$/);
        if (lexicalMatch) {
          symbol = lexicalMatch[1];
          // Ensure indices are properly comma-separated
          lexicalIndices = lexicalMatch[2]
            .split(/[\s,]+/) // Split on commas or whitespace
            .filter(Boolean) // Remove empty strings
            .map((i) => parseInt(i, 10));
        }

        const eventData: QwikHandlerContext = {
          qBase: container.qBase,
          qManifest: container.qManifest,
          qVersion: container.qVersion,
          href: path,
          symbol,
          element: context.element,
          reqTime: performance.now(),
        };

        try {
          if (isSync) {
            // Handle sync case
            const qInstance = container.qInstance;
            const handler = ((document as any)["qFuncs_" + qInstance] || [])[
              Number.parseInt(symbol)
            ];
            if (!handler) {
              eventData.importError = "sync";
              throw new Error("sync handler error for symbol: " + symbol);
            }
            this.emitQwikEvent("qsymbol", eventData);
            return handler;
          }

          // Handle async case
          const base = new URL(container.qBase!, document.baseURI);
          const url = new URL(path, base);
          eventData.href = url.href;

          // Import the module
          const module = await import(url.href);

          // Get the handler from the module
          const handler = module[symbol];
          if (typeof handler !== "function") {
            eventData.importError = "no-symbol";
            throw new Error(`No handler found for symbol ${symbol}`);
          }

          // If we have lexical indices, we need to restore the lexical scope
          if (lexicalIndices.length > 0) {
            this.resolveContainer(container);
            const containerData = (container as any)._qwikjson_;

            const closureWithScope = (...args: any[]) => {
              const captured = lexicalIndices.map((index) =>
                containerData?.objs?.[index]
              );

              // Create invocation context for the closure
              const url = new URL(context.attrValue, document.baseURI);
              const invocationContext = this.createInvocationContext(
                context.element,
                args[0], // event
                url,
                context.module?.$props$ || {},
              );
              this.setInvocationContext(invocationContext);

              // Call the handler with the captured values and proper this context
              return handler.apply(invocationContext, [...captured, ...args]);
            };

            this.emitQwikEvent("qsymbol", eventData);
            return closureWithScope;
          }

          this.emitQwikEvent("qsymbol", eventData);
          return (...args: any[]) => {
            // Create invocation context for direct handler calls
            const url = new URL(context.attrValue, document.baseURI);
            const invocationContext = this.createInvocationContext(
              context.element,
              args[0], // event
              url,
              context.module?.$props$ || {},
            );
            this.setInvocationContext(invocationContext);

            return handler.apply(invocationContext, args);
          };
        } catch (error) {
          eventData.error = error as Error;
          if (!eventData.importError) {
            eventData.importError = isSync ? "sync" : "async";
          }
          this.emitQwikEvent("qerror", eventData);
          throw error;
        }
      }
    }

    return super.getHandler(scriptPath, context);
  }

  private async executeQwikHandler(handler: Function, context: any) {
    const previousCtx = (document as any)["__q_context__"];
    try {
      const url = new URL(context.attrValue, document.baseURI);
      const invocationContext = this.createInvocationContext(
        context.element,
        context.event,
        url,
        context.module?.$props$ || {},
      );
      this.setInvocationContext(invocationContext);

      // If we have lexical scope, apply it
      const result = handler.apply(invocationContext, [
        context.event,
        context.element,
      ]);
      if (isPromise(result)) {
        return await result;
      }
      return result;
    } finally {
      (document as any)["__q_context__"] = previousCtx;
    }
  }

  // Add to QwikHandlerRegistry
  private findShadowRoots(root: Element | ShadowRoot) {
    // Process the current element's shadow root if it exists
    if (root instanceof Element && "shadowRoot" in root && root.shadowRoot) {
      this.handleShadowRoot(root.shadowRoot);
    }

    // Find all shadow root hosts - simplified
    const hosts = root.querySelectorAll("[q\\:shadowroot]");

    hosts.forEach((host) => {
      if ("shadowRoot" in host && host.shadowRoot) {
        this.handleShadowRoot(host.shadowRoot);
      }
    });
  }

  private handleShadowRoot(shadowRoot: ShadowRoot) {
    // Set up visibility observer for the shadow root
    this.setupVisibilityObserver(shadowRoot);

    // Process any nested shadow roots
    this.findShadowRoots(shadowRoot);

    // Set up event delegation for the shadow root
    const host = shadowRoot.host;
    const container = host.closest("[q\\:container]");
    if (container) {
      // Add shadow root to container's tracked roots
      const data = this.qwikContainers.get(container) || {};
      if (!data.shadowRoots) {
        data.shadowRoots = new Set();
      }
      data.shadowRoots.add(shadowRoot);
      this.qwikContainers.set(container, data);
    }
  }

  private setupVisibilityObserver(root: Element | ShadowRoot) {
    // Don't set up multiple observers for the same root
    if (this.visibilityObservers.has(root)) {
      return;
    }

    const visibilitySelector = "[on\\:qvisible]";
    const elements = root.querySelectorAll(visibilitySelector);

    if (elements.length > 0) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.unobserve(entry.target);

            // Create and dispatch qvisible event
            const event = new CustomEvent("qvisible", {
              detail: entry,
              bubbles: true,
              composed: true, // Allow the event to cross shadow DOM boundaries
            });

            entry.target.dispatchEvent(event);
          }
        }
      }, {
        root: root instanceof ShadowRoot ? root : null,
        threshold: 0,
      });

      elements.forEach((el) => observer.observe(el));
      this.visibilityObservers.set(root, observer);
    }
  }

  override parseAttribute(attrValue: string) {
    // Split by newlines for Qwik handlers
    // qwik uses \n for multiline handlers
    const qwikSplitIndex = "\n";
    if (attrValue.includes(qwikSplitIndex)) {
      return super.parseAttribute(attrValue, qwikSplitIndex);
    }
    // to comma
    const commaSplitIndex = ",";
    if (attrValue.includes(commaSplitIndex)) {
      return super.parseAttribute(attrValue, commaSplitIndex);
    }
    // default to this.splitIndex
    return super.parseAttribute(attrValue);
  }

  // Add cleanup method
  public cleanup(container: Element) {
    // Cleanup visibility observers
    this.visibilityObservers.get(container)?.disconnect();
    this.visibilityObservers.delete(container);

    // Cleanup shadow roots
    const data = this.qwikContainers.get(container);
    if (data?.shadowRoots) {
      data.shadowRoots.forEach((shadowRoot: ShadowRoot) => {
        this.visibilityObservers.get(shadowRoot)?.disconnect();
        this.visibilityObservers.delete(shadowRoot);
      });
    }

    // Cleanup container data
    this.qwikContainers.delete(container);
  }
}
