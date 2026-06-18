import { Async, createSignal } from "../../src/index.js";

Async.use({
  signal: {
    serverCall: createSignal({
      productId: "sku-1",
      savedTitle: ""
    })
  },
  server: {
    "serverCall.products.save"(productId, form) {
      return {
        __async_server_result__: 1,
        value: { id: productId, ...form },
        signals: {
          "serverCall.savedTitle": form.title
        }
      };
    }
  }
});

Async.start({ root: document, router: false });
