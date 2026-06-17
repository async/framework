import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  AsyncLoader,
  createHandlerRegistry,
  createSignalRegistry,
  delay,
  signal
} from "../src/index.js";

test("AsyncLoader binds text, values, attributes, classes, and input writes", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main data-async-container>
      <span data-async-text="product.title"></span>
      <input data-async-value="productId">
      <button data-async-attr:disabled="product.$loading" data-async-class:selected="selected"></button>
    </main>
  `;

  const signals = createSignalRegistry({
    productId: signal("sku-1"),
    product: signal({ title: "Keyboard" }),
    selected: signal(false)
  });

  const loader = AsyncLoader({ root: document.body, signals }).start();
  const text = document.querySelector("span");
  const input = document.querySelector("input");
  const button = document.querySelector("button");

  assert.equal(text.textContent, "Keyboard");
  assert.equal(input.value, "sku-1");
  assert.equal(button.classList.contains("selected"), false);

  signals.set("product.title", "Headphones");
  signals.set("selected", true);
  assert.equal(text.textContent, "Headphones");
  assert.equal(button.classList.contains("selected"), true);

  input.value = "sku-2";
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await delay(0);
  assert.equal(signals.get("productId"), "sku-2");

  loader.destroy();
});

test("AsyncLoader renders async boundaries through loading, ready, and error templates", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <section data-async-boundary="product">
      <template data-async-loading="product"><p class="loading">Loading</p></template>
      <template data-async-ready="product"><h1 data-async-text="product.title"></h1></template>
      <template data-async-error="product"><p class="error" data-async-text="product.$error.message"></p></template>
    </section>
  `;

  const signals = createSignalRegistry();
  signals.asyncSignal("product", async function () {
    await delay(5, this.abort);
    return { title: "Keyboard" };
  });

  AsyncLoader({ root: document.body, signals }).start();

  assert.equal(document.querySelector(".loading").textContent, "Loading");
  await delay(10);
  assert.equal(document.querySelector("h1").textContent, "Keyboard");
});

test("AsyncLoader dispatches async:error for missing delegated handlers", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<button on:click="missing">Missing</button>`;
  let seen;

  document.body.addEventListener("async:error", (event) => {
    seen = event.detail.error;
  });

  AsyncLoader({ root: document.body }).start();
  document.querySelector("button").click();
  await delay(0);

  assert.match(seen.message, /Handler "missing" is not registered/);
});

test("boundary swap rescans inserted HTML and scanned handlers still work", async () => {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `
    <main>
      <button id="stream" on:click="stream">Stream</button>
      <section data-async-boundary="product"></section>
    </main>
  `;

  const signals = createSignalRegistry({
    title: signal("Keyboard"),
    selected: signal(false)
  });

  const loader = AsyncLoader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      stream() {
        this.loader.swap(
          "product",
          `<button id="select" on:click="select" data-async-class:selected="selected" data-async-text="title"></button>`
        );
      },
      select() {
        this.signals.set("selected", true);
      }
    })
  }).start();

  document.querySelector("#stream").click();
  await delay(0);

  const select = document.querySelector("#select");
  assert.equal(select.textContent, "Keyboard");
  select.click();
  await delay(0);
  assert.equal(select.classList.contains("selected"), true);

  loader.destroy();
});
