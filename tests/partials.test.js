import assert from "node:assert/strict";
import { test } from "node:test";
import { createPartialRegistry, createServerRegistry, html } from "../src/index.js";

test("partial registry renders templates and can call this.server", async () => {
  const server = createServerRegistry({
    "products.get"(id) {
      return {
        value: {
          id,
          title: "Keyboard"
        }
      };
    }
  });
  const partials = createPartialRegistry({
    "product.card": async function ({ id }) {
      const product = await this.server.products.get(id);
      return html`<article data-id="${product.id}">${product.title}</article>`;
    }
  });

  const result = await partials.render("product.card", { id: "sku-1" }, { server });

  assert.deepEqual(result, {
    html: `<article data-id="sku-1">Keyboard</article>`
  });
});

test("missing partials fail with a useful error", async () => {
  const partials = createPartialRegistry();

  await assert.rejects(
    partials.render("missing"),
    /Partial "missing" is not registered/
  );
});
