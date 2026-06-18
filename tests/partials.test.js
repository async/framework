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

test("lazy partial descriptors render through the async partial path", async () => {
  const imports = [];
  const partials = createPartialRegistry({
    "product.card": { url: "product.card.js" }
  }, {
    importModule(url) {
      imports.push(url);
      return {
        card({ id }) {
          return html`<article>${id}</article>`;
        }
      };
    }
  });

  const result = await partials.render("product.card", { id: "sku-1" });

  assert.deepEqual(imports, ["/_async/partial/product.card.js"]);
  assert.deepEqual(result, {
    html: "<article>sku-1</article>"
  });
});
