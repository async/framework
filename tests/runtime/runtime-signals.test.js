import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { startSignals } from "../../src/runtime/signals.js";

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

test("startSignals accepts an options bag with root and prefers top-level options", () => {
  const { document } = createDocument(`<strong data-id="text"></strong>`);
  const controller = startSignals({
    root: document,
    plan: {
      values: [["count", 7]],
      bindings: [[0, "text", "count"]]
    },
    options: { elements: ["#does-not-exist"] },
    elements: ["[data-id='text']"]
  });

  assert.equal(document.querySelector("[data-id='text']").textContent, "7");
  assert.equal(controller.get("count"), 7);
  controller.stop();
});

test("startSignals validates the runtime root", () => {
  assert.throws(
    () => startSignals(null, { values: [] }),
    /Runtime root must be a Document, Element, or DocumentFragment with querySelector/
  );
  assert.throws(
    () => startSignals({ querySelector() { return null; } }, { values: [] }),
    /Runtime root must support addEventListener/
  );
  assert.throws(
    () => startSignals({ root: null, plan: { values: [] } }),
    /querySelector/
  );
});

test("startSignals validates plan shape and version", () => {
  const { document } = createDocument(`<strong data-id="text"></strong>`);
  assert.throws(() => startSignals(document, null), /Signal runtime plan must be an object/);
  assert.throws(() => startSignals(document, { version: 2 }), /Unsupported signal runtime plan version: 2/);

  const controller = startSignals(document, { version: 1, values: [["count", 1]] });
  assert.equal(controller.get("count"), 1);
  controller.stop();
});

test("startSignals validates element locators and reports missing optional ones", () => {
  const { document } = createDocument(`<strong data-id="text"></strong>`);
  const plan = { values: [["count", 1]] };

  assert.throws(() => startSignals(document, plan, { elements: "nope" }), /locators must be an array/);
  assert.throws(() => startSignals(document, plan, { elements: ["#missing"] }), /Runtime locator 0 did not match: #missing/);
  assert.throws(
    () => startSignals(document, plan, { elements: [42] }),
    /locator must be a selector string or selector record/
  );

  const diagnostics = [];
  const controller = startSignals(document, {
    values: [["count", 3]],
    bindings: [[0, "text", "count"]]
  }, {
    elements: [
      { selector: "[data-id='text']" },
      { selector: "#missing", optional: true }
    ],
    onDiagnostic(diagnostic) {
      diagnostics.push(diagnostic);
    }
  });

  assert.equal(document.querySelector("[data-id='text']").textContent, "3");
  assert.deepEqual(diagnostics, [{
    type: "missing-optional-locator",
    index: 1,
    selector: "#missing"
  }]);
  controller.stop();
});

test("startSignals validates binding records before touching elements", () => {
  const { document } = createDocument(`<strong data-id="text"></strong>`);
  const options = { elements: ["[data-id='text']"] };
  const values = [["count", 1]];

  assert.throws(() => startSignals(document, { values, bindings: ["nope"] }, options), /tuple arrays/);
  assert.throws(() => startSignals(document, { values, bindings: [[0, "text"]] }, options), /tuple arrays/);
  assert.throws(() => startSignals(document, { values, bindings: [[-1, "text", "count"]] }, options), /non-negative integer/);
  assert.throws(() => startSignals(document, { values, bindings: [["0", "text", "count"]] }, options), /non-negative integer/);
  assert.throws(() => startSignals(document, { values, bindings: [[0, "blink", "count"]] }, options), /Unsupported signal binding kind: blink/);
});

test("startSignals rolls back applied bindings when a later binding fails", () => {
  const { document } = createDocument(`<strong data-id="first"></strong>`);
  assert.throws(
    () => startSignals(document, {
      values: [["count", 5]],
      bindings: [
        [0, "text", "count"],
        [1, "text", "count"]
      ]
    }, {
      elements: ["[data-id='first']"]
    }),
    /target 1/
  );
  assert.equal(document.querySelector("[data-id='first']").textContent, "5");
});

test("signal controller validates paths and functions and skips identical values", () => {
  const { document } = createDocument(`<strong data-id="text"></strong>`);
  const controller = startSignals(document, { values: [["count", 1]] });
  const observed = [];
  controller.subscribe("count", (value) => observed.push(value));

  controller.set("count", 1);
  assert.deepEqual(observed, []);
  controller.set("count", 2);
  assert.deepEqual(observed, [2]);

  assert.throws(() => controller.get(""), /Signal path must be a non-empty string/);
  assert.throws(() => controller.set(42, "x"), /Signal path must be a non-empty string/);
  assert.throws(() => controller.update("count", null), /update\(path, fn\) requires a function/);
  assert.throws(() => controller.subscribe("count", "nope"), /subscribe\(path, fn\) requires a function/);
  assert.throws(() => startSignals(document, { values: [[42, "x"]] }), /Signal path must be a non-empty string/);
  controller.stop();
});

test("value bindings fall back to attributes and attr bindings toggle booleans", () => {
  const { document } = createDocument(`
    <div data-id="plain"></div>
    <input data-id="input">
    <span data-id="flagged"></span>
  `);
  const controller = startSignals(document, {
    values: [
      ["title", "hello"],
      ["name", null],
      ["flag", true]
    ],
    bindings: [
      [0, "value", "title"],
      [1, "value", "name"],
      [2, "attr", "data-on", "flag"]
    ]
  }, {
    elements: ["[data-id='plain']", "[data-id='input']", "[data-id='flagged']"]
  });

  const plain = document.querySelector("[data-id='plain']");
  const input = document.querySelector("[data-id='input']");
  const flagged = document.querySelector("[data-id='flagged']");

  assert.equal(plain.getAttribute("value"), "hello");
  assert.equal(input.value, "");
  assert.equal(flagged.getAttribute("data-on"), "");

  controller.set("title", null);
  assert.equal(plain.hasAttribute("value"), false);
  controller.set("title", 7);
  assert.equal(plain.getAttribute("value"), "7");

  controller.set("flag", false);
  assert.equal(flagged.hasAttribute("data-on"), false);
  controller.set("flag", "busy");
  assert.equal(flagged.getAttribute("data-on"), "busy");

  controller.stop();

  assert.throws(
    () => startSignals(document, {
      values: [["flag", true]],
      bindings: [[0, "attr", "", "flag"]]
    }, {
      elements: ["[data-id='flagged']"]
    }),
    /Attribute signal binding requires an attribute name/
  );
});

test("startSignals stops through abort signals, including already-aborted ones", () => {
  const { document } = createDocument(`<strong data-id="text"></strong>`);
  const abort = new AbortController();
  const controller = startSignals(document, {
    values: [["count", 0]],
    bindings: [[0, "text", "count"]]
  }, {
    elements: ["[data-id='text']"],
    signal: abort.signal
  });

  controller.set("count", 1);
  assert.equal(document.querySelector("[data-id='text']").textContent, "1");
  assert.equal(controller.stopped, false);

  abort.abort();
  assert.equal(controller.stopped, true);
  assert.throws(() => controller.set("count", 2), /stopped/);
  assert.equal(document.querySelector("[data-id='text']").textContent, "1");

  const aborted = new AbortController();
  aborted.abort();
  const stoppedController = startSignals(document, { values: [["count", 0]] }, { signal: aborted.signal });
  assert.equal(stoppedController.stopped, true);
});

function createDocument(html) {
  const window = new Window();
  window.document.write(html);
  return { window, document: window.document };
}
