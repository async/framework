// deno-lint-ignore-file no-explicit-any
// handlerRegistry.ts
import { isPromise } from "../utils.ts";
import {
  preventAndStop,
  preventDefault,
  stopPropagation,
} from "./default-handlers.ts";

type FileModule = {
  default?: any;
  [key: string]: any;
};
/**
 * Grabs the handler from the module based on the event name and handler name.
 * @param {FileModule} mod - The module to grab the handler from.
 * @param {string} eventName - The event name.
 * @param {string} handlerName - The handler name.
 * @returns {any} - The handler.
 */
function grabHandler(mod: FileModule, eventName: string, handlerName: string) {
  // Return specific event handler if available
  // e.g. mod[handlerName] = onDragover
  if (eventName && mod[handlerName]) {
    return mod[handlerName];
  }

  // Return default export if available
  if (typeof mod.default === "function") {
    return mod.default;
  }

  // Return module if it's a function if the user manually set the handler
  if (typeof mod === "function") {
    return mod;
  }

  return null;
}

/**
 * Converts an event string to a title case event name.
 * @param {string} eventString - The event string to convert.
 * @returns {string} - The converted event name.
 */
function convertToEventName(eventString: string) {
  if (!eventString) return "";
  // First, replace any hyphens with spaces
  let processed = eventString.replace(/-/g, " ");

  // Then apply title case
  processed = processed.split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");

  // Remove any remaining spaces
  return processed.replace(/\s/g, "");
}

export class HandlerRegistry {
  static defaultHandlers = {
    "prevent-default.js": preventDefault,
    "stop-propagation.js": stopPropagation,
    "prevent-and-stop.js": preventAndStop,
  };
  public splitIndex: string;
  private registry: Map<string, any>;
  private attributeRegistry: Map<string, any>;
  private eventPrefix: string;
  private defaultHandler: string;
  private basePath: string;
  private origin: string;

  /**
   * Constructor for the HandlerRegistry class.
   * @param {Object} config - Configuration object.
   */
  constructor(config: any = {}) {
    this.registry = config.registry || new Map([
      ...Object.entries(HandlerRegistry.defaultHandlers),
    ]);
    this.attributeRegistry = config.attributeRegistry || new Map();
    this.eventPrefix = (config.eventPrefix || "on").toLowerCase().replace(
      /:|-/g,
      "",
    );
    this.defaultHandler = config.defaultHandler || "handler";
    // The character used to split the script path into its components
    this.splitIndex = config.splitIndex || ",";
    this.basePath = config.basePath || "./";
    this.origin = config.origin || "";

    console.log("HandlerRegistry.constructor: basePath", config.basePath);
  }

  /**
   * Parses the attribute value into an array of script paths.
   * @param {string} attrValue - The attribute value to parse.
   * @returns {string[]} - The array of script paths.
   */
  parseAttribute(attrValue: string, splitIndex: string = this.splitIndex) {
    if (!attrValue) return [];
    if (this.attributeRegistry.has(attrValue)) {
      return this.attributeRegistry.get(attrValue);
    }
    // console.log('parseElementForEvent: event name', eventName);
    const split = attrValue.split(splitIndex);
    // console.log('parseElementForEvent: event name', split);

    // Handle multiple handlers separated by commas
    const scriptPaths = split.map((path) => path.trim()).filter((path) => path);
    // console.log('parseElementForEvent: script paths', scriptPaths);
    return scriptPaths;
  }

  /**
   * Processes the handlers for an event.
   * @param {string[] | string} attrValue - The attribute value to process.
   * @param {any} context - The context object.
   * @param {any} value - The value to pass to the handlers.
   * @returns {Promise<any>} - The value returned by the handlers.
   */
  async handler(context: any) {
    // context.eventName, context.attrValue, context.value, context.break
    const attrValue = context.attrValue;
    const processedAttrValue = Array.isArray(attrValue)
      ? attrValue
      : this.parseAttribute(attrValue);
    // console.log("HandlerRegistry.handler: processedAttrValue", context.element.tagName, JSON.stringify(processedAttrValue, null, 2));
    for (const scriptPath of processedAttrValue) {
      try {
        // Retrieve the handler from the registry
        //                                        context.eventName
        // context.module is set. then it's to undefined after each handler call
        let handler = this.getHandler(scriptPath, context);
        // If we need to grab an async handler, wait for it to resolve
        if (isPromise(handler)) {
          // console.log('HandlerRegistry.handler: waiting for handler to resolve', scriptPath);
          handler = await (handler as Promise<any>);
        }
        if (typeof handler === "function") {
          type handlerType = (context: any) => Promise<any> | any;
          // returnedValue = handler(context);
          let returnedValue = (handler as handlerType).call(context, context);
          // if the handler returns a promise, wait for it to resolve
          if (isPromise(returnedValue)) {
            // console.log('HandlerRegistry.handler: waiting for handler to resolve', scriptPath);
            // Execute the handler asynchronously
            returnedValue = await (returnedValue as Promise<any>);
          }
          // clear the module reference
          context.module = undefined;
          // If the handler returns a value, store it
          if (returnedValue !== undefined) {
            // pass the returned value to the next handler
            context.value = returnedValue;
          }
          // If the handler sets break to true, stop processing further handlers for this event
          if (context.canceled) {
            console.log(
              "HandlerRegistry.handler: event was cancelled by the handler",
              context,
            );
            break;
          }
        }
      } catch (error) {
        console.error(
          `HandlerRegistry.processHandlers: Failed to load handler at ${scriptPath}:`,
          error,
        );
        throw error;
      }
      // end loop
    }
    return context;
  }

  /**
   * Retrieves a handler function by its script path.
   * If the handler is not cached, it dynamically imports the script.
   *
   * @param {string} scriptPath - The relative path to the handler script.
   * @returns {Function} - The handler function.
   */
  async getHandler(
    scriptPath,
    // SET: context.module, GET: context.eventName
    context,
  ): Promise<((context: any) => Promise<any>) | ((context: any) => any)> {
    // Split the path and hash consistently at the start
    const [path, hash] = scriptPath.split("#");
    const cacheKey = hash ? `${path}#${hash}` : path;

    // Check cache using the consistent key
    if (this.registry.has(cacheKey)) {
      const module = this.registry.get(cacheKey);
      const eventName = context.eventName;
      const handlerName = hash ||
        (eventName
          ? this.eventPrefix + convertToEventName(eventName)
          : this.defaultHandler);
      // set the module reference
      context.module = module;
      const handler = grabHandler(module, eventName, handlerName);
      return handler;
    }

    try {
      // Import the module using just the path
      const module = await import(`${this.origin}${this.basePath}${path}`);

      const eventName = context.eventName;
      const handlerName = hash ||
        (eventName
          ? this.eventPrefix + convertToEventName(eventName)
          : this.defaultHandler);

      const handler = grabHandler(module, eventName, handlerName);

      if (typeof handler === "function") {
        // Cache using the consistent key
        this.registry.set(cacheKey, module);
        context.module = module;
        return handler;
      } else {
        console.error(
          `HandlerRegistry.getHandler: Handler "${handlerName}" at ${scriptPath} is not a function.`,
        );
        throw new Error(
          `Handler "${handlerName}" at ${scriptPath} is not a function.`,
        );
      }
    } catch (error) {
      console.error(
        `HandlerRegistry.getHandler: Failed to load handler at ${scriptPath}:`,
        error,
      );
      throw error;
    }
  }
}
