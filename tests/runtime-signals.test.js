import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { startSignals } from "../src/runtime/signals.js";

test("startSignals applies planned bindings and exact-path subscriptions", () => {
  const { document } = createDocument(`
    <main>
      <strong data-id="text"></strong>
      <input data-id="input">
      <button data-id="button"></button>
      <p data-id="status" class="static old"></p>
    </main>
  `);
  const controller = startSignals(document, {
    values: [
      ["count", 1],
      ["name", "Ada"],
      ["label", "Ready"],
      ["disabled", true],
      ["active", true],
      ["tokens", "new selected"]
    ],
    bindings: [
      [0, "text", "count"],
      [1, "value", "name"],
      [2, "attr", "aria-label", "label"],
      [2, "prop", "disabled", "disabled"],
      [3, "class", "active", "active"],
      [3, "classList", "tokens"]
    ]
  }, {
    elements: [
      "[data-id='text']",
      "[data-id='input']",
      "[data-id='button']",
      "[data-id='status']"
    ]
  });

  const text = document.querySelector("[data-id='text']");
  const input = document.querySelector("[data-id='input']");
  const button = document.querySelector("[data-id='button']");
  const status = document.querySelector("[data-id='status']");
  assert.equal(text.textContent, "1");
  assert.equal(input.value, "Ada");
  assert.equal(button.getAttribute("aria-label"), "Ready");
  assert.equal(button.disabled, true);
  assert.equal(status.classList.contains("static"), true);
  assert.equal(status.classList.contains("active"), true);
  assert.equal(status.classList.contains("new"), true);
  assert.equal(status.classList.contains("selected"), true);

  const observed = [];
  const unsubscribe = controller.subscribe("count", (value) => observed.push(value));
  controller.update("count", (value) => value + 1);
  controller.set("tokens", "newer");
  controller.set("label", null);
  controller.set("disabled", false);
  controller.set("active", false);

  assert.deepEqual(observed, [2]);
  assert.equal(text.textContent, "2");
  assert.equal(status.classList.contains("new"), false);
  assert.equal(status.classList.contains("selected"), false);
  assert.equal(status.classList.contains("newer"), true);
  assert.equal(button.hasAttribute("aria-label"), false);
  assert.equal(button.disabled, false);
  assert.equal(status.classList.contains("active"), false);
  assert.deepEqual(controller.snapshot(), {
    count: 2,
    name: "Ada",
    label: null,
    disabled: false,
    active: false,
    tokens: "newer"
  });

  unsubscribe();
  controller.set("count", 3);
  assert.deepEqual(observed, [2]);
  controller.stop();
  controller.stop();
  assert.equal(controller.stopped, true);
  assert.throws(() => controller.set("count", 4), /stopped/);
});

test("startSignals rolls back startup when a planned binding is invalid", () => {
  const { document } = createDocument(`<strong data-id="text"></strong>`);
  assert.throws(
    () => startSignals(document, {
      values: [["count", 1]],
      bindings: [[1, "text", "count"]]
    }, {
      elements: ["[data-id='text']"]
    }),
    /target 1/
  );
});

function createDocument(html) {
  const window = new Window();
  window.document.write(html);
  return { window, document: window.document };
}
