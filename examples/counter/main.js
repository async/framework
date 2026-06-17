import { AsyncLoader, createHandlerRegistry, createSignalRegistry, signal } from "../../src/index.js";

const signals = createSignalRegistry({
  count: signal(0)
});

const handlers = createHandlerRegistry({
  increment() {
    this.signals.update("count", (count) => count + 1);
  },
  decrement() {
    this.signals.update("count", (count) => count - 1);
  }
});

AsyncLoader({ root: document.body, signals, handlers }).start();
