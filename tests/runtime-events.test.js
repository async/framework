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

test("startEvents accepts an options bag with root and stops when its abort signal fires", async () => {
  const { window, document } = createDocument(`<button data-id="button" type="button">Add</button>`);
  const abort = new AbortController();
  let hits = 0;
  const handlers = {
    hit() {
      hits += 1;
    }
  };
  const controller = startEvents({
    root: document,
    plan: {
      events: [[0, "click", [["handler", "hit"]]]],
      handlers
    },
    elements: ["[data-id='button']"],
    signal: abort.signal
  });

  const button = document.querySelector("[data-id='button']");
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.equal(hits, 1);
  assert.equal(controller.stopped, false);

  abort.abort();
  assert.equal(controller.stopped, true);
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.equal(hits, 1);

  const aborted = new AbortController();
  aborted.abort();
  const stoppedController = startEvents({
    root: document,
    plan: {
      events: [[0, "click", [["handler", "hit"]]]],
      handlers
    },
    elements: ["[data-id='button']"],
    signal: aborted.signal
  });
  assert.equal(stoppedController.stopped, true);
  button.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.equal(hits, 1);
});

test("startEvents validates plan shape and version", () => {
  const { document } = createDocument(`<button data-id="button" type="button">Add</button>`);
  assert.throws(() => startEvents(document, null), /Event runtime plan must be an object/);
  assert.throws(() => startEvents(document, { version: 2, events: [] }), /Unsupported event runtime plan version: 2/);
  assert.throws(() => startEvents(document, {}), /requires an events array/);

  const controller = startEvents(document, { version: 1, events: [] });
  assert.equal(controller.stopped, false);
  controller.stop();
  assert.equal(controller.stopped, true);
});

test("startEvents validates event binding records and element targets", () => {
  const { document } = createDocument(`<button data-id="button" type="button">Add</button>`);
  const options = { elements: ["[data-id='button']"] };

  assert.throws(() => startEvents(document, { events: [[0, "click"]] }, options), /\[element, event, commands\]/);
  assert.throws(() => startEvents(document, { events: [["0", "click", []]] }, options), /non-negative integer/);
  assert.throws(() => startEvents(document, { events: [[-1, "click", []]] }, options), /non-negative integer/);
  assert.throws(() => startEvents(document, { events: [[0, "", []]] }, options), /non-empty string/);
  assert.throws(() => startEvents(document, { events: [[0, "click", "nope"]] }, options), /commands must be an array/);
  assert.throws(() => startEvents(document, { events: [[1, "click", []]] }, options), /Event binding target 1 was not resolved/);
});

test("startEvents removes already-registered listeners when startup fails midway", () => {
  const { document } = createDocument(`<button data-id="a">A</button><input data-id="b">`);
  const added = [];
  const removed = [];
  const root = {
    querySelector(selector) {
      return document.querySelector(selector);
    },
    addEventListener(type, listener) {
      if (added.length === 1) {
        throw new Error("listener registry full");
      }
      added.push([type, listener]);
    },
    removeEventListener(type, listener) {
      removed.push([type, listener]);
    }
  };

  assert.throws(
    () => startEvents(root, {
      events: [
        [0, "click", []],
        [1, "input", []]
      ]
    }, {
      elements: ["[data-id='a']", "[data-id='b']"]
    }),
    /listener registry full/
  );
  assert.equal(added.length, 1);
  assert.equal(added[0][0], "click");
  assert.deepEqual(removed, added);
});

test("planned events ignore events dispatched outside their bound elements", async () => {
  const { window, document } = createDocument(`
    <main>
      <button data-id="first" type="button">First</button>
      <button data-id="second" type="button">Second</button>
    </main>
  `);
  const hits = [];
  const controller = startEvents(document, {
    events: [[0, "click", [["handler", "record"]]]],
    handlers: {
      record({ element, event }) {
        hits.push([element.dataset.id, event.target.dataset.id]);
      }
    }
  }, {
    elements: ["[data-id='first']"]
  });

  document.querySelector("[data-id='second']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.deepEqual(hits, []);

  document.querySelector("[data-id='first']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.deepEqual(hits, [["first", "first"]]);
  controller.stop();
});

test("stopPropagation commands halt bubbling past the runtime root", async () => {
  const { window, document } = createDocument(`
    <main>
      <button data-id="quiet" type="button">Quiet</button>
      <button data-id="loud" type="button">Loud</button>
    </main>
  `);
  const windowClicks = [];
  window.addEventListener("click", (event) => windowClicks.push(event.target.dataset.id));
  let handled = 0;
  const controller = startEvents(document, {
    events: [[0, "click", [["stopPropagation"], ["handler", "record"]]]],
    handlers: {
      record() {
        handled += 1;
      }
    }
  }, {
    elements: ["[data-id='quiet']"]
  });

  document.querySelector("[data-id='loud']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.deepEqual(windowClicks, ["loud"]);
  assert.equal(handled, 0);

  document.querySelector("[data-id='quiet']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.deepEqual(windowClicks, ["loud"]);
  assert.equal(handled, 1);
  controller.stop();
});

test("stopImmediatePropagation commands halt later bindings and later root listeners", async () => {
  const { window, document } = createDocument(`
    <main>
      <button data-id="button" type="button">Add</button>
      <span data-id="other">Other</span>
    </main>
  `);
  const outer = [];
  const controller = startEvents(document, {
    events: [
      [0, "click", [["stopImmediatePropagation"]]],
      [1, "click", [["handler", "outer"]]]
    ],
    handlers: {
      outer({ event }) {
        outer.push(event.target.dataset.id);
      }
    }
  }, {
    elements: ["[data-id='button']", "main"]
  });
  const later = [];
  document.addEventListener("click", (event) => later.push(event.target.dataset.id));

  document.querySelector("[data-id='other']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.deepEqual(outer, ["other"]);
  assert.deepEqual(later, ["other"]);

  document.querySelector("[data-id='button']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.deepEqual(outer, ["other"]);
  assert.deepEqual(later, ["other"]);
  controller.stop();
});

test("setSignal commands read checked and constant event value sources", async () => {
  const { window, document } = createDocument(`
    <main>
      <input data-id="agree" type="checkbox">
      <button data-id="theme" type="button">Theme</button>
    </main>
  `);
  const signals = startSignals(document, {
    values: [["agreed", null], ["mode", "light"]]
  });
  const controller = startEvents(document, {
    events: [
      [0, "change", [["setSignal", "agreed", ["event.target.checked"]]]],
      [1, "click", [["setSignal", "mode", ["constant", "dark"]]]]
    ]
  }, {
    elements: ["[data-id='agree']", "[data-id='theme']"],
    signals
  });

  const checkbox = document.querySelector("[data-id='agree']");
  checkbox.checked = true;
  checkbox.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settleRuntimeEvents();
  assert.equal(signals.get("agreed"), true);

  checkbox.checked = false;
  checkbox.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settleRuntimeEvents();
  assert.equal(signals.get("agreed"), false);

  document.querySelector("[data-id='theme']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.equal(signals.get("mode"), "dark");

  controller.stop();
  signals.stop();
});

test("startEvents rejects malformed handler descriptors at startup", () => {
  const { document } = createDocument(`<button data-id="button" type="button">Add</button>`);
  const options = { elements: ["[data-id='button']"] };
  const events = [[0, "click", [["handler", "increment"]]]];

  assert.throws(
    () => startEvents(document, { events, handlers: { increment: 42 } }, options),
    /Handler "increment" must be a function or strict descriptor/
  );
  assert.throws(
    () => startEvents(document, { events, handlers: { increment: null } }, options),
    /Handler "increment" must be a function or strict descriptor/
  );
  assert.throws(
    () => startEvents(document, {
      events,
      handlers: { increment: { mode: "strict", exportName: "increment" } }
    }, options),
    /Handler "increment" requires browserImport/
  );
  assert.throws(
    () => startEvents(document, {
      events,
      handlers: { increment: { mode: "strict", browserImport: "./handlers.js" } }
    }, options),
    /Handler "increment" requires exportName/
  );
});

test("strict descriptors without versions resolve without a version query", async () => {
  const { window, document } = createDocument(`<button data-id="button" type="button">Add</button>`);
  let calls = 0;
  const controller = startEvents(document, {
    events: [[0, "click", [["handler", "notify"]]]],
    handlers: {
      notify: {
        mode: "strict",
        browserImport: "./notify.js",
        exportName: "notify"
      }
    }
  }, {
    elements: ["[data-id='button']"],
    importModule(specifier) {
      assert.equal(specifier, "./notify.js");
      return {
        notify() {
          calls += 1;
        }
      };
    }
  });

  document.querySelector("[data-id='button']").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await settleRuntimeEvents();
  assert.equal(calls, 1);
  controller.stop();
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

async function settleRuntimeEvents() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
