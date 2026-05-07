// deno-lint-ignore-file no-explicit-any
import { escapeSelector, isPromise, querySelectorAll } from "../utils.ts";
import type { Signal } from "../signals/signals.ts";
import { SignalRegistry } from "../signals/registry.ts";
// import { contextStack, contextRegistry } from "../context/instance.ts";
import {
  getCurrentContext,
  popContext,
  pushContext,
} from "../context/context.ts";

export interface AsyncLoaderContext<T = any, M = any, C = Element> {
  value: T | undefined | null | Promise<T>;
  attrValue: string;
  dispatch: (eventName: string, detail?: T) => void;
  element: Element;
  event: Event & { detail?: T };
  eventName: string;
  handlers: {
    handler: <R = any>(
      this: M,
      context: AsyncLoaderContext<T, M, C>,
    ) => Promise<R> | R;
  };
  signals: {
    get: (id: string) => Signal<any> | undefined;
    set: (signal: Signal<any>) => void;
  };
  container: C;
  module: M;
  break: () => void;
  // mimic Event
  preventDefault: () => void;
  stopPropagation: () => void;
  target: Event["target"];
  rootContext?: any;
}

export interface AsyncLoaderConfig {
  handlerRegistry: {
    handler: (context: AsyncLoaderContext<any>) => Promise<any> | any;
  };
  signalRegistry: {
    get: (id: string) => Signal<any> | undefined;
    set: (id: string, signal: Signal<any>) => void;
  };
  templateRegistry: {
    get: (id: string) => string | undefined;
    set: (id: string, template: string) => void;
  };
  containerAttribute?: string;
  eventPrefix?: string;
  containers?: Map<Element, Map<string, Map<Element, string>>>;
  events?: string[];
  processedContainers?: WeakSet<Element>;
  domRoot?: Element | HTMLElement;
  rootContext?: any;
}

export class AsyncLoader {
  /**
   * Data structure: Map<Element, Map<string, Map<Element, string>>>
   *
   * This is a three-level nested Map structure:
   *
   * Level 1: Container Element Map
   * - Key: Element (the container element)
   * - Value: Map<string, Map<Element, string>> (event type map for this container)
   *
   *   Level 2: Event Type Map
   *   - Key: string (the event type, e.g., "click", "custom:event")
   *   - Value: Map<Element, string> (element-handler map for this event type)
   *
   *     Level 3: Element-Handler Map
   *     - Key: Element (the element with the event listener)
   *     - Value: string (the attribute value containing handler information)
   *
   * Example structure:
   * Map(
   *   [containerElement1, Map(
   *     ["click", Map(
   *       [buttonElement1, "handleClick"],
   *       [buttonElement2, "handleOtherClick"]
   *     )],
   *     ["custom:event", Map(
   *       [customElement1, "handleCustomEvent"]
   *     )]
   *   )],
   *   [containerElement2, Map(
   *     ["submit", Map(
   *       [formElement1, "handleSubmit"]
   *     )]
   *   )]
   * )
   *
   * This structure allows for efficient lookup of event handlers:
   * 1. Find the container element
   * 2. Find the event type within that container
   * 3. Find the specific element and its associated handler
   */
  private containers: Map<Element, Map<string, Map<Element, string>>>;
  private handlerRegistry: { handler: (context: any) => Promise<any> | any };
  private signalRegistry: {
    get: (id: string) => Signal<any> | undefined;
    set: (id: string, signal: Signal<any>) => void;
  };
  private templateRegistry: {
    get: (id: string) => string | undefined;
    set: (id: string, template: string) => void;
  };
  private events: string[];
  private eventPrefix: string;
  private containerAttribute: string;
  private processedContainers: WeakSet<Element>;
  private rootContext: any;
  private domRoot: Element | HTMLElement;
  private config: AsyncLoaderConfig;
  constructor(config: AsyncLoaderConfig) {
    this.config = config;
    this.rootContext = config.rootContext || {};
    // TODO: better way to grab instance
    this.handlerRegistry = config.handlerRegistry;
    // TODO: better way to grab instance
    this.signalRegistry = config.signalRegistry || SignalRegistry.getInstance();
    // TODO: better way to grab instance
    this.templateRegistry = config.templateRegistry;
    this.eventPrefix = config.eventPrefix || "on:";
    this.containerAttribute = config.containerAttribute || "data-container";
    this.containers = config.containers || new Map();
    this.domRoot = config.domRoot || document.body;

    // Discover custom events if no events are provided
    if (!config.events || config.events?.length === 0) {
      this.events = this.discoverCustomEvents(this.domRoot);
    } else {
      this.events = this.dedupeEvents(config.events);
    }

    // Set of processed containers
    this.processedContainers = config.processedContainers || new WeakSet();
  }

  // Initializes the event handling system by parsing the DOM
  // Why: Entry point that bootstraps the event handling system. It initializes event listeners
  // and container management starting from a specified root element or the default domRoot.
  init(containerElement = this.domRoot) {
    this.parseDOM(containerElement); // Start parsing from the body element
  }

  dedupeEvents(events: string[]) {
    const uniqueEvents = new Set(events);
    if (uniqueEvents.size < events.length) {
      const duplicates = events.filter((event, index) =>
        events.indexOf(event) !== index
      );
      // if no events or empty array, don't log duplicates
      if (this.config.events && this.config.events.length > 0) {
        console.warn(
          "AsyncLoader.dedupeEvents: Found duplicate events:",
          duplicates,
        );
      }
    }
    return [...uniqueEvents];
  }


  // Discovers custom events on the container element
  // Why: Automatically detects all custom event types used in the application by:
  // 1. Scanning all container elements for attributes starting with the event prefix
  // 2. Extracting and normalizing event names from these attributes
  // 3. Removing duplicates to ensure each event type is only registered once
  // This enables automatic event registration without manual event configuration.
  discoverCustomEvents(bodyElement: Element) {
    const customEventAttributes = querySelectorAll(bodyElement, "*")
      .flatMap((el: any) => Array.from(el.attributes))
      .filter((attr: any) => attr.name.startsWith(this.eventPrefix))
      .map((attr: any) => attr.name.slice(this.eventPrefix.length));

    console.log(
      "AsyncLoader.discoverCustomEvents: discovered custom events:",
      this.dedupeEvents(customEventAttributes),
    );
    return this.dedupeEvents(customEventAttributes);
  }

  // Parses a root element to identify and handle new containers
  // Why: Processes DOM elements to set up event handling by:
  // 1. Handling different input types (undefined, arrays, single elements)
  // 2. Processing only valid container elements with the specified container attribute
  // 3. Avoiding duplicate processing of containers
  // 4. Supporting both initial load and dynamically added containers
  // This ensures consistent event handling setup across the application.
  parseDOM(containerElement: undefined | any[] | any) {
    const self = this;
    if (!containerElement) {
      const containerEls = querySelectorAll(this.domRoot, `[${this.containerAttribute}]`);
      containerEls.forEach(function newHandleForEachContainer(el) {
        self.handleNewContainer(el);
      });
    }
    if (Array.isArray(containerElement)) {
      containerElement.forEach(function newHandleForEachContainer(el) {
        self.handleNewContainer(el);
      });
    } else if (containerElement?.hasAttribute?.(this.containerAttribute)) {
      this.handleNewContainer(containerElement);
    } else {
      console.warn("AsyncLoader.parseDOM: no container element provided");
    }
  }

  // Handles the setup for a new container
  // Why: Manages the lifecycle of container elements by:
  // 1. Verifying container connectivity to prevent processing detached elements
  // 2. Preventing duplicate processing through WeakSet tracking
  // 3. Setting up event delegation through container listeners
  // 4. Managing cleanup for disconnected elements
  // This ensures proper initialization and cleanup of container elements.
  handleNewContainer(el) {
    // Avoid reprocessing the same container
    if (!el.isConnected) {
      console.warn(
        "AsyncLoader.handleNewContainer: container was processed but is not connected",
        el,
      );
      this.processedContainers.delete(el);
    }
    if (this.processedContainers.has(el)) {
      console.warn(
        "AsyncLoader.handleNewContainer: container was already processed",
        el,
      );
      return;
    }

    // Set up event listeners for the container
    const processed = this.setupContainerListeners(el);
    // this.observeContainer(container); // Watch for DOM changes within the container
    if (processed) {
      this.processedContainers.add(el); // Mark the container as processed
    } else {
      if (!el.isConnected) {
        console.log(
          "AsyncLoader.handleNewContainer: container was processed but is not connected",
          el,
        );
      } else {
        console.warn(
          "AsyncLoader.handleNewContainer: container was processed but is not connected",
          el,
        );
        this.processedContainers.delete(el);
      }
    }

    // TODO: add onMount lifecycle hook
    // if (container._controller && typeof container._controller.onMount === 'function') {
    //   container._controller.onMount.call(container._controller, container); // Invoke the onMount lifecycle hook
    // }
  }

  // Sets up event listeners for a container based on its elements
  // Why: Implements efficient event delegation by:
  // 1. Creating a single listener per event type at the container level
  // 2. Using event capturing for early interception
  // 3. Supporting lazy parsing of event handlers
  // 4. Maintaining a map of event listeners for proper cleanup
  // This reduces memory usage and improves performance compared to individual element listeners.
  setupContainerListeners(containerElement): boolean {
    let success = false;
    if (!containerElement.isConnected) {
      return success;
    }
    // avoid re-setting up listeners for the same container
    if (this.containers.has(containerElement)) {
      return success;
    }
    const listeners = new Map();
    this.containers.set(containerElement, listeners);
    const self = this;

    // TODO: We still need to parse the container for the event type
    // even when doing lazy event registration
    this.events.forEach(function newAddEventListener(eventName) {
      // console.log('setupContainerListeners: adding event listener for', eventName);
      containerElement.addEventListener(
        eventName,
        function newHandleContainerEvent(event) {
          // TODO: we may not need to parse the container anymore for the event type
          // when doing lazy event registration

          // Lazy parse the element for the event type before handling the event
          self.parseContainerElement(containerElement, eventName);
          // Handle the event when it occurs
          self.handleContainerEvent(containerElement, event);
          // console.log('setupContainerListeners: event handled', res);
        },
        true, // Use capturing phase to ensure the handler runs before other listeners
      );
    });
    success = true;
    return success;
  }

  // Parses elements within a container to identify and register event handlers
  // Why: Analyzes container elements for event bindings by:
  // 1. Finding elements with specific event attributes
  // 2. Registering handler associations in the event map
  // 3. Supporting lazy parsing for better performance
  // This enables dynamic handler registration without requiring immediate processing of all elements.
  parseContainerElement(containerElement, eventName) {
    const self = this;
    // Select elements with 'on:{event}' attributes for example 'on:click'
    const eventAttr = `${self.eventPrefix}${eventName}`;
    const elements = querySelectorAll(
      containerElement,
      `[${escapeSelector(eventAttr)}]`,
    );
    // console.log('parseContainerElement: parsing container elements', elements, eventName);
    elements.forEach(function newParseContainerElement(element: Element) {
      const eventAttrValue = element.getAttribute(eventAttr);
      if (eventAttrValue) {
        // console.log('parseContainerElement: one attribute value', eventAttrValue);
        self.addEventData(containerElement, eventName, element, eventAttrValue);
      }
    });

    // Mark this event as processed for this container
    // processedEvents.add(eventName);
  }

  // Registers event listeners for specific elements within a container
  // Why: Manages the event handler registry by:
  // 1. Maintaining a three-level map structure (container → event → element → handler)
  // 2. Validating element connectivity before registration
  // 3. Handling cleanup of disconnected elements
  // 4. Preventing duplicate handler registration
  // This provides efficient lookup and management of event handlers during event delegation.
  addEventData(containerElement, eventName, element, attrValue) {
    if (!containerElement.isConnected) {
      console.warn(
        "AsyncLoader.addEventData: container is not connected",
        containerElement,
      );
      this.processedContainers.delete(containerElement);
      this.containers.delete(containerElement);
      return;
    }
    const listeners = this.containers.get(containerElement);
    if (!listeners) {
      console.warn(
        "AsyncLoader.addEventData: no listeners found for container",
        containerElement,
      );
      return;
    }
    let eventListeners = listeners.get(eventName);
    if (!eventListeners) {
      // console.log('addEventData: adding event listener for', eventName, 'to container', container);
      eventListeners = new Map();
      listeners.set(eventName, eventListeners);
    }
    if (!eventListeners.has(element)) {
      if (element.isConnected) {
        eventListeners.set(element, attrValue); // Map script paths to the element for the given event
      } else {
        console.warn(
          "AsyncLoader.addEventData: element is not connected",
          element,
        );
        eventListeners.delete(element);
      }
    } else {
      /*
        if an element doesn't have any event listeners,
        it means it's a new element or just an element with an attribute like 'on:click'
      */
      // console.warn('addEventData: event listener already exists for', eventName, 'on element', element);
    }
    // console.log('addEventData: listeners', listeners);
  }

  // Creates a custom event
  createEvent(eventName, detail) {
    return new CustomEvent(eventName, {
      bubbles: true,
      cancelable: true,
      detail: detail,
    });
  }

  // Dispatches a custom event to all registered listeners across containers
  // Why: Enables custom event broadcasting across the application by:
  // 1. Supporting both string-based and CustomEvent dispatching
  // 2. Lazy-parsing containers for relevant event handlers
  // 3. Managing cleanup of disconnected elements during dispatch
  // 4. Ensuring events reach all registered handlers
  // This provides a reliable system for cross-component communication.
  dispatch(eventName: string | CustomEvent, detail?: any) {
    // create the custom event
    let customEvent;
    let success = false;
    if (eventName instanceof CustomEvent) {
      customEvent = eventName;
      detail = eventName.detail;
      eventName = eventName.type;
    } else {
      customEvent = this.createEvent(eventName, detail);
    }
    const self = this;
    // grab all listeners for the event and emit the event to all elements that have registered handlers for the event
    this.containers.forEach(
      function newAddEventListener(listeners, containerElement) {
        // TODO: refactor code to avoid adding the same event listener multiple times
        // this is now lazy registering
        if (!self.events.includes(eventName)) {
          self.events.push(eventName);
          // add the event listener to the container
          containerElement.addEventListener(
            eventName,
            function newHandleContainerEvent(event) {
              // TODO: we don't need to parse the container for the event type
              // when doing lazy event registration

              // Lazy parse the element for the event type before handling the event
              // this.parseContainerElement(containerElement, eventName);
              // Handle the event when it occurs
              self.handleContainerEvent(containerElement, event);
              // console.log('setupContainerListeners: event handled', res);
            },
            true, // Use capturing phase to ensure the handler runs before other listeners
          );
          // add the event to the events array
        }
        // console.log('dispatch: parsing container elements for event', eventName);
        // lazy parse the container for the event type
        self.parseContainerElement(containerElement, eventName);
        // if there are listeners for the event and rely on side effects
        if (listeners.has(eventName)) {
          // Parse the container for the event type before handling the event
          const eventListeners = listeners.get(eventName);
          if (eventListeners) {
            const cleanup: Element[] = [];
            eventListeners.forEach(function newHandleEventListeners(
              _attrValue,
              element,
            ) {
              if (element.isConnected) {
                element.dispatchEvent(customEvent);
                success = true;
              } else {
                cleanup.push(element);
              }
            });
            // remove elements that are not connected
            cleanup.forEach(function newHandleCleanup(element) {
              eventListeners.delete(element);
            });
          }
        }
      },
    );
    return success;
  }

  // Handles an event occurring within a container
  // Why: Coordinates event handling and delegation by:
  // 1. Traversing the DOM from target to container for matching handlers
  // 2. Creating and managing handler execution context
  // 3. Supporting both synchronous and asynchronous handlers
  // 4. Implementing event bubbling control
  // 5. Providing error handling and cleanup
  // This ensures reliable and controlled execution of event handlers while maintaining proper context.
  async handleContainerEvent(containerElement, domEvent) {
    // deno-lint-ignore no-this-alias
    const self = this;
    // console.log('handleContainerEvent: handling container event', event);
    const listeners = self.containers.get(containerElement);
    if (!listeners) {
      // console.error(
      //   "handleContainerEvent: no listeners found for container",
      //   container
      // );
      return;
    }

    const eventListeners = listeners.get(domEvent.type);
    if (!eventListeners) {
      // if click on elements that don't have event listeners
      // console.error(
      //   "handleContainerEvent: no event listeners found for event",
      //   event.type,
      //   "in container",
      //   container
      // );
      return;
    }

    let element = domEvent.target;
    let stop = false;
    while (element && element !== containerElement && !stop) {
      // console.log('handleContainerEvent: handling event for element', element.tagName, event.type, eventListeners);
      if (eventListeners.has(element)) {
        // Define the context with getters for accessing current state and elements
        // Set the value to the event value
        let value = domEvent instanceof CustomEvent
          ? domEvent.detail
          : undefined;
        let module = undefined;

        const attrValue = eventListeners.get(element); // || element.getAttribute(this.eventPrefix + domEvent.type);
        // Define the context with getters for accessing current state and elements
        const context = {
          get event() {
            return domEvent;
          },
          get element() {
            return element;
          },
          dispatch: self.dispatch.bind(self),

          // set the value to pass between chained handlers
          set value(v) {
            value = v;
          },
          // get the value to pass between chained handlers
          get value() {
            return value;
          },
          // get the attribute value for the event
          get attrValue() {
            return attrValue;
          },
          // get the event name
          get eventName() {
            return domEvent.type;
          },
          get handlers() {
            return self.handlerRegistry;
          },
          get signals() {
            return self.signalRegistry;
          },
          get templates() {
            return self.templateRegistry;
          },
          get container() {
            return containerElement;
          },
          get module() {
            return module;
          },
          set module(m) {
            module = m;
          },
          get canceled() {
            return stop;
          },
          set canceled(v) {
            console.warn(
              "Please use context.break() instead of context.canceled",
              v,
            );
            stop = Boolean(v);
          },
          stringify(value, replacer = null, space = 2) {
            return JSON.stringify(value, replacer, space);
          },

          // Mimic the event object
          get target() {
            return domEvent.target;
          },
          preventDefault() {
            return domEvent.preventDefault();
          },
          stopPropagation() {
            return domEvent.stopPropagation();
          },

          // If the handler sets break to true, stop processing further handlers for this event
          break() {
            stop = true;
            return stop;
          },

          get rootContext() {
            return self.rootContext;
          },
        };
        // this is too hard to handle the types
        // copy the context properties from the async loader
        // Object.defineProperties(
        //   context,
        //   Object.getOwnPropertyDescriptors(this.context),
        //   // get signals() {
        //   //   return container._controller.signals;
        //   // }
        // );

        try {
          // create context stack
          // console.log('handleContainerEvent: creating context');
          const parentContext = getCurrentContext();
          pushContext(element, parentContext);
          let res = self.handlerRegistry.handler(context);
          // console.log('handleContainerEvent: handler result', res);
          if (isPromise(res)) {
            res = await res;
          }
          // console.log('handleContainerEvent: handler result after await', res);
        } catch (error) {
          // Reset value if there's an error
          console.error(
            `AsyncLoader.handleContainerEvent: Error`,
            error,
          ); // Log any errors during handler execution
        } finally {
          // clear the context
          popContext();
          // clear and references to avoid memory leak
          value = undefined;
          module = undefined;
        }

        // If the event doesn't bubble, stop after handling the first matching element
        if (stop) {
          console.log(
            "AsyncLoader.handleContainerEvent: event was stopped by the handler",
            domEvent,
          );
          break;
        }
        if (!domEvent.bubbles) {
          console.log(
            "AsyncLoader.handleContainerEvent: event does not bubble",
            domEvent,
          );
          stop = true;
          break;
        }
        // if (domEvent.cancelBubble) {
        //   console.log('handleContainerEvent: event was cancelled by the handler', domEvent);
        //   stop = true;
        //   break;
        // }
      }
      // Traverse up the DOM tree for event delegation
      element = element.parentElement;
    }
  }
}
