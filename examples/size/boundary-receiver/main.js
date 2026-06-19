import { Async, createBoundaryReceiver } from "../../../dist/browser.min.js";

const runtime = Async.start({ root: document, router: false });
const receiver = createBoundaryReceiver({
  loader: runtime.loader,
  signals: runtime.signals,
  cache: runtime.browser.cache,
  scheduler: runtime.scheduler
});

globalThis.boundaryReceiverScenario = receiver;
