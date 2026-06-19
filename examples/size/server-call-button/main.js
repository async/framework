import { Async, createServerProxy, createSignal } from "../../../dist/browser.min.js";

Async.use("signal", {
  productId: createSignal("sku-1"),
  savedTitle: createSignal("")
});
Async.start({
  root: document,
  router: false,
  server: createServerProxy({
    endpoint: "/__async/server",
    async transport() {
      return new Response(JSON.stringify({
        __async_server_result__: 1,
        signals: {
          savedTitle: "Keyboard"
        }
      }), {
        headers: {
          "content-type": "application/json"
        }
      });
    }
  })
});
