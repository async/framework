import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { start } from "../src/runtime.js";
import { startEvents } from "../src/runtime/events.js";
import { startSignals } from "../src/runtime/signals.js";

test("startEvents delegates planned commands, writes signals, and stops cleanly", async () => {
  const { document } = createDocument(`
    <main>
      <button data-id="button" type="button">Add</button>
      <input data-id="input" type="text">
      <strong data-id="count"></strong>
    </main>
  `);
  const signals = startSignals(document, {
    values: [["count", 0], ["name", ""]],
    bindings: [
      [2, "text", "count"],
      [1, "value", "name"]
    ]
  }, {
    elements: ["[data-id='button']", "[data-id='input']", "[data-id='count']"]
  });
  let handled = 0;
  const events = startEvents(document, {
    events: [
      [0, "click", [["preventDefault"], ["handler", "increment"]]],
      [1, "input", [["setSignal", "name", ["event.target.value"]]]]
    ],
    handlers: {
      increment({ signals }) {
        handled += 1;
        signals.update("count", (value) => value + 1);
      }
    }
  }, {
    elements: ["[data-id='button']", "[data-id='input']"],
    signals
  });

  const button = document.querySelector("[data-id='button']");
  const input = document.querySelector("[data-id='input']");
  assert.equal(document.querySelector("[data-id='count']").textContent, "0");

  button.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  input.value = "Ada";
  input.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  await flushRuntimeEvents();

  assert.equal(handled, 1);
  assert.equal(signals.get("count"), 1);
  assert.equal(signals.get("name"), "Ada");
  assert.equal(document.querySelector("[data-id='count']").textContent, "1");

  events.stop();
  button.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
  await flushRuntimeEvents();
  assert.equal(handled, 1);
  assert.equal(events.stopped, true);
  events.stop();
  signals.stop();
});

test("strict lazy handler descriptors validate exact versioned imports and cache modules", async () => {
  const { document } = createDocument(`<button data-id="button" type="button">Add</button>`);
  const signals = startSignals(document, { values: [["count", 0]] });
  let imports = 0;
  const events = startEvents(document, {
    events: [
      [0, "click", [["handler", "increment"]]]
    ],
    handlers: {
      increment: {
        mode: "strict",
        module: "handlers.js",
        browserImport: "./handlers.js?v=abc123",
        exportName: "increment",
        version: "abc123"
      }
    }
  }, {
    elements: ["[data-id='button']"],
    signals,
    async importModule(specifier) {
      imports += 1;
      assert.equal(specifier, "./handlers.js?v=abc123");
      return {
        increment({ signals }) {
          signals.update("count", (value) => value + 1);
        }
      };
    }
  });

  const button = document.querySelector("[data-id='button']");
  button.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
  await flushRuntimeEvents();
  button.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
  await flushRuntimeEvents();

  assert.equal(imports, 1);
  assert.equal(signals.get("count"), 2);
  events.stop();
  signals.stop();
});

test("startEvents rejects dynamic descriptors and mismatched descriptor versions", () => {
  const { document } = createDocument(`<button data-id="button" type="button">Add</button>`);
  const plan = {
    events: [[0, "click", [["handler", "increment"]]]]
  };

  assert.throws(
    () => startEvents(document, {
      ...plan,
      handlers: {
        increment: { mode: "dynamic", url: "./handlers.js" }
      }
    }, {
      elements: ["[data-id='button']"]
    }),
    /strict descriptor/
  );
  assert.throws(
    () => startEvents(document, {
      ...plan,
      handlers: {
        increment: {
          mode: "strict",
          browserImport: "./handlers.js?v=old",
          exportName: "increment",
          version: "new"
        }
      }
    }, {
      elements: ["[data-id='button']"]
    }),
    /version query/
  );
});

test("composed start starts slices in order and stops them in reverse order", async () => {
  const { document } = createDocument(`
    <main>
      <button data-id="button" type="button">Add</button>
      <strong data-id="count"></strong>
    </main>
  `);
  let calls = 0;
  const controller = start(document, {
    version: 1,
    elements: ["[data-id='button']", "[data-id='count']"],
    signals: {
      values: [["count", 0]],
      bindings: [[1, "text", "count"]]
    },
    events: {
      events: [[0, "click", [["handler", "increment"]]]],
      handlers: {
        increment({ signals }) {
          calls += 1;
          signals.update("count", (value) => value + 1);
        }
      }
    }
  });

  const button = document.querySelector("[data-id='button']");
  button.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
  await flushRuntimeEvents();
  assert.equal(calls, 1);
  assert.equal(document.querySelector("[data-id='count']").textContent, "1");
  controller.stop();
  controller.stop();
  button.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true }));
  await flushRuntimeEvents();
  assert.equal(calls, 1);
  assert.equal(controller.stopped, true);
});

function createDocument(html) {
  const window = new Window();
  window.document.write(html);
  return { window, document: window.document };
}

async function flushRuntimeEvents() {
  await Promise.resolve();
  await Promise.resolve();
}
