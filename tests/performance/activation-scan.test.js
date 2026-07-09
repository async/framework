// @hot-paths: src/loader.js, src/attributes.js
//
// Performance contracts for DOM activation scans. These are deterministic
// operation-count assertions, not wall-clock benchmarks: they pin the
// algorithmic shape of the hot path so a regression (extra tree traversals,
// re-normalizing attribute config per read) fails loudly and portably.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { Loader, createHandlerRegistry, createSignalRegistry, signal } from "../../src/index.js";

const ROWS = 200;

function rowsHtml(count) {
  let html = "";
  for (let index = 0; index < count; index += 1) {
    html += `<button id="row-${index}" on:click="select" signal:class:selected="selected">Row ${index}</button>`;
  }
  return html;
}

// Wraps document.createTreeWalker to count traversals and record their roots.
function instrumentTreeWalker(document) {
  const original = document.createTreeWalker.bind(document);
  const calls = [];
  document.createTreeWalker = (root, ...rest) => {
    calls.push({ root });
    return original(root, ...rest);
  };
  return calls;
}

test("activation scans a scope with a single tree traversal", () => {
  const window = new Window({ url: "http://perf.test/" });
  const { document } = window;
  document.body.innerHTML = `<main>${rowsHtml(ROWS)}</main>`;

  const calls = instrumentTreeWalker(document);
  const loader = Loader({
    root: document.body,
    signals: createSignalRegistry({ selected: signal(false) }),
    handlers: createHandlerRegistry({ select() {} })
  });
  loader.start();

  // Activation is exactly ONE traversal of the scope, independent of how
  // many binding kinds exist: a single shared element collection powers the
  // revive/signal/class/event/boundary/component passes AND pseudo-event
  // dispatch (attach/visible/intersect). Component-attached children are
  // covered by the nested api.scan(host) inside attach. Growth here means a
  // pass regained its own tree walk.
  assert.equal(calls.length, 1, `expected 1 tree traversal for the activation scan, saw ${calls.length}`);
  for (const call of calls) {
    assert.equal(call.root, document.body, "every activation walk stays rooted at the scan scope");
  }
});

test("attribute config is normalized once per identity, not per attribute read", () => {
  const window = new Window({ url: "http://perf.test/" });
  const { document } = window;
  document.body.innerHTML = `<main>${rowsHtml(ROWS)}</main>`;

  // Every property read on the raw config means a fresh normalization pass.
  let configReads = 0;
  const attributes = new Proxy({}, {
    get(target, property, receiver) {
      if (typeof property === "string") {
        configReads += 1;
      }
      return Reflect.get(target, property, receiver);
    }
  });

  const loader = Loader({
    root: document.body,
    signals: createSignalRegistry({ selected: signal(false) }),
    handlers: createHandlerRegistry({ select() {} }),
    attributes
  });
  loader.start();

  // The config object is consulted a constant number of times (one
  // normalization: five prefix groups plus probe reads), regardless of how
  // many elements or attributes the scan visits. If this scales with ROWS,
  // the WeakMap memoization by config identity broke.
  assert.ok(
    configReads <= 16,
    `attribute config was read ${configReads} times for ${ROWS} rows — normalization is no longer memoized`
  );
});
