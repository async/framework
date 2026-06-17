import { Async, createSignal } from "../../src/index.js";

Async.use({
  signal: {
    counter: createSignal({ count: 0 })
  },
  handler: {
    "counter.increment"() {
      this.signals.update("counter.count", (count) => count + 1);
    },
    "counter.decrement"() {
      this.signals.update("counter.count", (count) => count - 1);
    }
  }
});

Async.start({ root: document.body, router: false });
