import { HandlerRegistry } from "./handler-registry.ts";
import type { HandlerContext } from "./types.ts";

export type AsyncLoaderOptions = {
  root: Element;
  events?: string[];
  eventPrefix?: string;
  splitBy?: string;
  registry?: HandlerRegistry;
};

export class AsyncLoader {
  readonly root: Element;
  readonly events: string[];
  readonly eventPrefix: string;
  readonly splitBy: string;
  readonly registry: HandlerRegistry;

  constructor(options: AsyncLoaderOptions) {
    this.root = options.root;
    this.eventPrefix = options.eventPrefix ?? "on:";
    this.splitBy = options.splitBy ?? ",";
    this.registry = options.registry ?? new HandlerRegistry();
    this.events = options.events?.length
      ? [...new Set(options.events)]
      : this.discoverEvents();
  }

  private discoverEvents() {
    const all = Array.from(this.root.querySelectorAll("*"));
    const names = new Set<string>();

    for (const element of all) {
      for (const attr of Array.from(element.attributes)) {
        if (attr.name.startsWith(this.eventPrefix)) {
          names.add(attr.name.slice(this.eventPrefix.length));
        }
      }
    }

    return [...names];
  }

  init() {
    for (const eventName of this.events) {
      this.root.addEventListener(eventName, (event) => this.handleEvent(event));
    }
  }

  async handleEvent(event: Event) {
    const target = event.target as Element | null;
    if (!target) return;

    const path = event.composedPath().filter((value): value is Element =>
      value instanceof Element
    );

    const matched = path.find((node) => {
      if (node === this.root) return false;
      return node.hasAttribute(`${this.eventPrefix}${event.type}`);
    });

    if (!matched) return;

    const attrValue = matched.getAttribute(`${this.eventPrefix}${event.type}`) ?? "";
    const handlerRefs = attrValue
      .split(this.splitBy)
      .map((entry) => entry.trim())
      .filter(Boolean);

    let stopped = false;
    let result: unknown;

    for (const handlerRef of handlerRefs) {
      const handler = await this.registry.resolve(handlerRef, event.type);
      if (!handler) {
        console.warn(`[simplified-async-framework] handler not found: ${handlerRef}`);
        continue;
      }

      const context: HandlerContext = {
        event,
        element: matched,
        root: this.root,
        value: result,
        stop: () => {
          stopped = true;
        },
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      };

      result = await handler(context);
      if (stopped) break;
    }
  }
}
