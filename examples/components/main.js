import { Loader, component, html } from "../../src/index.js";

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

const loader = Loader({ root: document });
loader.mount(document.querySelector("#app"), Toggle);
