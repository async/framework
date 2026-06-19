import { Async, createSignal } from "../../../dist/browser.min.js";

Async.use("signal", {
  signalCount: createSignal(1)
});
Async.start({ root: document });
