import { AsyncLoader, createSignal, createSignalRegistry, delay } from "../../src/index.js";

const products = {
  "sku-1": {
    title: "Mechanical Keyboard",
    description: "A compact keyboard loaded through an async signal."
  },
  "sku-2": {
    title: "Studio Headphones",
    description: "Closed-back headphones loaded through the same boundary."
  }
};

const signals = createSignalRegistry({
  productId: createSignal("sku-1")
});

signals.asyncSignal("product", async function () {
  const id = this.signals.get("productId");
  await delay(150, this.abort);
  return products[id];
});

AsyncLoader({ root: document.body, signals }).start();
