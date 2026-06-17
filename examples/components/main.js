import { AsyncLoader, defineComponent, html } from "../../src/index.js";

const Toggle = defineComponent(function Toggle() {
  const selected = this.signal("selected", false);
  const toggle = this.handler("toggle", function () {
    selected.update((value) => !value);
  });

  this.onMount(() => {
    document.body.dataset.toggleMounted = "true";
  });

  return html`
    <button
      type="button"
      on:click="${toggle}"
      data-async-class:selected="${selected.id}"
      data-async-attr:aria-pressed="${selected.id}"
    >
      Toggle
    </button>
  `;
});

const loader = AsyncLoader({ root: document });
loader.mount(document.querySelector("#app"), Toggle);
