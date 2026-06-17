import {
  Async,
  createSignal,
  defineRoute,
  html
} from "../../src/index.js";

Async.use({
  signal: {
    routerDemo: createSignal({
      productId: "sku-1",
      cartCount: 0
    })
  },
  server: {
    "routerDemo.cart.add"(productId) {
      return {
        value: { productId },
        signals: {
          "routerDemo.cartCount": 1
        }
      };
    }
  },
  partial: {
    "routerDemo.home"() {
      return html`
        <h1>Home</h1>
        <p>Cart: <strong data-async-text="routerDemo.cartCount"></strong></p>
      `;
    },
    "routerDemo.product.page"({ id }) {
      return html`
        <article>
          <h1>Product ${id}</h1>
          <p>Cart: <strong data-async-text="routerDemo.cartCount"></strong></p>
          <button type="button" on:click="server.routerDemo.cart.add(routerDemo.productId)">Add</button>
        </article>
      `;
    }
  },
  route: {
    "/": defineRoute("routerDemo.home"),
    "/products/:id": defineRoute("routerDemo.product.page")
  }
});

Async.start({
  mode: "ssr-spa",
  root: document,
  boundary: "route"
});
