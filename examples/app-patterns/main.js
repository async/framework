import { Async, component, html } from "../../src/index.js";

const catalog = [
  {
    id: "keyboard",
    title: "Keyboard",
    description: "A compact mechanical keyboard."
  },
  {
    id: "trackpad",
    title: "Trackpad",
    description: "A wireless multi-touch trackpad."
  },
  {
    id: "display",
    title: "Display",
    description: "A color-accurate desktop display."
  }
];

const CatalogApp = component(function CatalogApp() {
  const selectedId = this.signal("selectedId", catalog[0].id);
  const selectedTitle = this.computed("selectedTitle", () => {
    return catalog.find((item) => item.id === selectedId.value)?.title ?? "";
  });
  const selectedDescription = this.computed("selectedDescription", () => {
    return catalog.find((item) => item.id === selectedId.value)?.description ?? "";
  });
  const select = this.handler("select", function ({ element }) {
    selectedId.set(element.dataset.catalogId);
  });

  const choices = catalog.map((item) => {
    const selected = this.computed(`selected.${item.id}`, () => selectedId.value === item.id);
    return html`
      <button
        type="button"
        data-catalog-id="${item.id}"
        on:click="${select}"
        class:selected="${selected.id}"
        signal:attr:aria-pressed="${selected.id}"
      >
        ${item.title}
      </button>
    `;
  });

  return html`
    <section aria-labelledby="catalog-title">
      <h1 id="catalog-title">Catalog</h1>
      <nav aria-label="Products">${choices}</nav>
      <article aria-live="polite">
        <h2 signal:text="${selectedTitle.id}"></h2>
        <p signal:text="${selectedDescription.id}"></p>
      </article>
    </section>
  `;
});

Async.use({ component: { CatalogApp } });
Async.start({
  root: document,
  router: false,
  onError({ error, diagnostic }) {
    console.error(`[async:${diagnostic.code}] ${diagnostic.message}`, error);
  }
});
