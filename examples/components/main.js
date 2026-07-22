import { Async, component, html } from "../../src/index.js";

const Toggle = component(function Toggle() {
  const selected = this.signal(false);
  const attach = this.handler("attach", function ({ element }) {
    element.dataset.attached = "true";
  });

  return html`
    <button
      type="button"
      on:attach="${attach}"
      on:click="${this.handler(function () {
        selected.update((value) => !value);
      })}"
      class:selected="${selected}"
      signal:class="${["toggle", { active: selected }]}"
      signal:attr:aria-pressed="${selected}"
    >
      Toggle
    </button>
  `;
});

Async.use({ component: { Toggle } });
Async.start({ root: document, router: false });
