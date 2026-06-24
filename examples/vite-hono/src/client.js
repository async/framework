import {
  Async,
  createSignal
} from "../../../src/browser.js";

Async.use({
  signal: {
    demo: createSignal({
      count: 0,
      selected: false
    })
  },
  handler: {
    "demo.increment"() {
      this.signals.update("demo.count", (count) => count + 1);
      this.signals.set("demo.selected", true);
    }
  }
});

Async.start({ root: document, router: false });
