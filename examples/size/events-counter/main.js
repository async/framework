import { Async, createSignal } from "../../../dist/browser.min.js";

const count = createSignal(0);

Async.use("signal", { count });
Async.use("handler", {
  increment() {
    count.update((value) => value + 1);
  }
});
Async.start({ root: document });
