// @hot-paths: src/loader.js
//
// Performance contracts for boundary swaps: after the first (cold) boundary
// lookup, swap cost must be proportional to the swapped content — never to
// the surrounding document. This is what keeps master-detail views (History
// rail + diff pane) cheap: the rail is not paid for again on every selection.
//
// Legitimate swap traversals are (a) activation of the incoming content,
// rooted inside the boundary, and (b) unbind cleanup of the outgoing
// content, rooted in the now-detached old fragment. A traversal rooted at a
// connected ancestor of the boundary (body, root) is a regression — that was
// the shape of the per-swap full-document boundary lookup this suite caught.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import { Loader, createHandlerRegistry, createSignalRegistry, signal } from "../../src/index.js";

function bigRail(count) {
  let html = "";
  for (let index = 0; index < count; index += 1) {
    html += `<a id="r-${index}" on:click="noop">row ${index}</a>`;
  }
  return html;
}

async function setup({ railRows = 150 } = {}) {
  const window = new Window({ url: "http://perf.test/" });
  const { document } = window;
  document.body.innerHTML = `
    <div id="rail">${bigRail(railRows)}</div>
    <section async:boundary="detail"><p>old</p></section>
  `;
  const loader = Loader({
    root: document.body,
    signals: createSignalRegistry({ selected: signal(false) }),
    handlers: createHandlerRegistry({ noop() {} })
  });
  loader.start();
  // Warm the boundary lookup: the first swap may resolve the boundary with
  // one document walk; every later swap must reuse it.
  await loader._whenCommitted(loader.swap("detail", `<p>warm</p>`));

  const boundary = [...document.querySelectorAll("*")].find(
    (element) => element.getAttribute?.("async:boundary") === "detail"
  );
  const original = document.createTreeWalker.bind(document);
  const calls = [];
  document.createTreeWalker = (root, ...rest) => {
    calls.push({ root });
    return original(root, ...rest);
  };
  return { window, document, loader, boundary, calls };
}

function assertScopedToSwap(calls, boundary, document) {
  for (const call of calls) {
    const inBoundary = call.root === boundary || boundary.contains(call.root);
    const detachedOutgoing = !call.root.isConnected;
    assert.ok(
      inBoundary || detachedOutgoing,
      `swap traversal escaped the boundary: walked connected <${call.root.tagName?.toLowerCase()}>`
    );
    assert.notEqual(call.root, document.body, "swap must not walk the whole document");
  }
}

test("a warm boundary swap traverses only swapped content", async () => {
  const { document, loader, boundary, calls } = await setup();

  const swapped = loader.swap("detail", `<p id="fresh">new</p>`);
  await loader._whenCommitted(swapped);

  assert.equal(document.querySelector("#fresh").textContent, "new");
  assert.ok(calls.length > 0, "swap activation should traverse the incoming content");
  assertScopedToSwap(calls, boundary, document);
});

test("swap traversal count does not scale with content outside the boundary", async () => {
  const counts = [];
  for (const railRows of [1, 150]) {
    const { loader, calls } = await setup({ railRows });
    await loader._whenCommitted(loader.swap("detail", `<p>new</p>`));
    counts.push(calls.length);
  }

  assert.equal(counts[0], counts[1], `swap traversals grew with unrelated DOM size: ${counts[0]} vs ${counts[1]}`);
});

test('swap with scan: "none" only pays outgoing-content cleanup', async () => {
  const { document, loader, boundary, calls } = await setup();

  const swapped = loader.swap("detail", `<p id="fresh">plain</p>`, { scan: "none" });
  await loader._whenCommitted(swapped);

  assert.equal(document.querySelector("#fresh").textContent, "plain");
  // No activation scan: every traversal must be unbind cleanup of the
  // detached outgoing fragment. Anything connected — boundary or document —
  // is a regression.
  for (const call of calls) {
    assert.equal(
      call.root.isConnected,
      false,
      `scan: "none" swap walked connected <${call.root.tagName?.toLowerCase()}>`
    );
  }
  assertScopedToSwap(calls, boundary, document);
});

test("repeated swaps to the same boundary never re-resolve it through the document", async () => {
  const { document, loader, calls } = await setup();

  for (let index = 0; index < 5; index += 1) {
    await loader._whenCommitted(loader.swap("detail", `<p>swap ${index}</p>`));
  }

  const bodyWalks = calls.filter((call) => call.root === document.body).length;
  assert.equal(bodyWalks, 0, `boundary lookup fell back to ${bodyWalks} full-document walks`);
});
