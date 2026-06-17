import {
  Async,
  createSignal,
  defineCache
} from "../../src/index.js";

Async.use({
  signal: {
    cacheDemo: createSignal({
      productId: "sku-1",
      title: "",
      calls: 0
    })
  },
  cache: {
    browser: {
      "cacheDemo.product": defineCache({ ttl: 60_000 })
    },
    server: {
      "cacheDemo.products.get": defineCache({ ttl: 30_000 })
    }
  },
  server: {
    async "cacheDemo.products.get"(id) {
      return this.cache.getOrSet(`cacheDemo.products:${id}`, () => {
        return {
          id,
          title: "Cached Keyboard",
          calls: this.signals.get("cacheDemo.calls") + 1
        };
      }, { cache: "cacheDemo.products.get" });
    }
  },
  handler: {
    async "cacheDemo.loadProduct"() {
      const id = this.signals.get("cacheDemo.productId");
      const product = await this.cache.getOrSet(`cacheDemo.product:${id}`, () => {
        return this.server.cacheDemo.products.get(id);
      }, { cache: "cacheDemo.product" });

      this.signals.set("cacheDemo.title", product.title);
      this.signals.set("cacheDemo.calls", product.calls);
    }
  }
});

Async.start({ root: document, router: false });
