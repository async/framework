import { Async, html, route } from "../../../dist/browser.min.js";

Async.use({
  partial: {
    "routerBasic.product"({ id }) {
      return html`<h1>${id}</h1>`;
    }
  },
  route: {
    "/size-products/:id": route("routerBasic.product")
  }
});

Async.start({
  root: document,
  mode: "csr",
  boundary: "route"
});
