import assert from "node:assert/strict";
import { test } from "node:test";
import { createServerRegistry, html } from "../../src/index.js";
import { createPartialRegistry } from "../../src/partials.js";

test("partial registry renders templates and can call this.server", async () => {
  const server = createServerRegistry({
    "products.get"(id) {
      return serverEnvelope({
        value: {
          id,
          title: "Keyboard"
        }
      });
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

function serverEnvelope(fields = {}) {
  return {
    __async_server_result__: 1,
    ...fields
  };
}

test("missing partials fail with a useful error", async () => {
  const partials = createPartialRegistry();

  await assert.rejects(
    partials.render("missing"),
    (error) => {
      assert.match(error.message, /Partial "missing" is not registered/);
      assert.equal(error.code, "partial-not-registered");
      assert.match(error.hint, /Register the partial/);
      assert.deepEqual(error.context, { partial: "missing" });
      return true;
    }
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

test("partial registry preserves undefined envelope html for route no-op handling", async () => {
  const partials = createPartialRegistry({
    noop() {
      return { html: undefined, status: 204 };
    }
  });

  const result = await partials.render("noop");

  assert.equal(Object.hasOwn(result, "html"), true);
  assert.equal(result.html, undefined);
  assert.equal(result.status, 204);
});

test("partial registry preserves no-op route partial shapes", async () => {
  const partials = createPartialRegistry({
    missingHtml() {
      return {};
    },
    emptyResult() {
      return undefined;
    },
    nullResult() {
      return null;
    },
    statusOnly() {
      return { status: 204 };
    }
  });

  assert.deepEqual(await partials.render("missingHtml"), {});
  assert.deepEqual(await partials.render("emptyResult"), {});
  assert.deepEqual(await partials.render("nullResult"), {});
  assert.deepEqual(await partials.render("statusOnly"), { status: 204 });
});
