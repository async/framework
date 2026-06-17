import { AsyncLoader, createHandlerRegistry, createSignalRegistry, signal } from "../../src/index.js";

const signals = createSignalRegistry({
  title: signal("Streamed Keyboard"),
  selected: signal(false)
});

const loader = AsyncLoader({
  root: document.body,
  signals,
  handlers: createHandlerRegistry({
    streamProduct() {
      this.loader.swap(
        "product",
        `
          <article>
            <h1 data-async-text="title"></h1>
            <button type="button" on:click="select" data-async-class:selected="selected">
              Select
            </button>
          </article>
        `
      );
    },
    select() {
      this.signals.set("selected", true);
    }
  })
});

loader.start();
