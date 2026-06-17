import { Async, createSignal } from "../../src/index.js";

Async.use({
  signal: {
    streamingDemo: createSignal({
      title: "Streamed Keyboard",
      selected: false
    })
  },
  handler: {
    "streamingDemo.streamProduct"() {
      this.loader.swap(
        "product",
        `
          <article>
            <h1 signal:text="streamingDemo.title"></h1>
            <button type="button" on:click="streamingDemo.select" signal:class:selected="streamingDemo.selected">
              Select
            </button>
          </article>
        `
      );
    },
    "streamingDemo.select"() {
      this.signals.set("streamingDemo.selected", true);
    }
  }
});

Async.start({ root: document.body, router: false });
