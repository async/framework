import {
  Async,
  html
} from "../../src/index.js";

let runtime;

Async.use({
  server: {
    "partialsDemo.products.get"(id) {
      return {
        __async_server_result__: 1,
        value: {
          id,
          title: "Keyboard"
        }
      };
    }
  },
  partial: {
    "partialsDemo.product.card": async function ({ id }) {
      const product = await this.server.partialsDemo.products.get(id);
      return html`
        <article>
          <h1>${product.title}</h1>
          <p>${product.id}</p>
        </article>
      `;
    }
  },
  handler: {
    async "partialsDemo.loadProduct"() {
      const result = await runtime.partials.render("partialsDemo.product.card", { id: "sku-1" }, {
        cache: this.cache,
        loader: this.loader,
        server: this.server,
        signals: this.signals
      });
      this.loader.swap("product", result.html);
    }
  }
});

runtime = Async.start({ root: document, router: false });
