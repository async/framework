import { Async, AsyncStream, createBoundaryReceiver } from "../../../dist/browser.min.js";

const runtime = Async.start({ root: document, router: false });
const receiver = createBoundaryReceiver({
  loader: runtime.loader,
  signals: runtime.signals,
  cache: runtime.browser.cache,
  scheduler: runtime.scheduler
});

for (const script of document.querySelectorAll("script[async\\:stream-patch]")) {
  void AsyncStream.applyScript(script, {
    receiver,
    root: document,
    attributes: runtime.attributes
  });
}

globalThis.streamBackpatchScenario = receiver;
