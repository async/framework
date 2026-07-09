// @hot-paths: src/scheduler.js, src/signals.js
//
// Performance contracts for the scheduler and signal write path: work that
// arrives together must be paid for once. These pin coalescing behavior with
// operation counts — job runs, animation-frame waits, DOM mutations — so a
// regression to per-write flushing or per-commit frame waits fails loudly.
import assert from "node:assert/strict";
import { test } from "node:test";
import { Window } from "happy-dom";
import {
  Loader,
  createScheduler,
  createSignalRegistry,
  delay,
  signal
} from "../../src/index.js";

test("keyed jobs enqueued repeatedly in one tick run once", async () => {
  const scheduler = createScheduler();
  let runs = 0;
  for (let index = 0; index < 25; index += 1) {
    scheduler.enqueue("binding", () => {
      runs += 1;
    }, { key: "same-binding" });
  }
  await scheduler.flush();

  assert.equal(runs, 1, `keyed job ran ${runs} times for 25 enqueues`);
  scheduler.destroy();
});

test("commits scheduled in the same tick share one animation-frame wait", async () => {
  let frames = 0;
  const scheduler = createScheduler({
    requestAnimationFrame: (cb) => {
      frames += 1;
      setTimeout(() => cb(Date.now()), 0);
    },
    frameFallbackMs: 250
  });

  const order = [];
  await Promise.all([
    scheduler.commit(() => order.push("a")),
    scheduler.commit(() => order.push("b")),
    scheduler.commit(() => order.push("c"))
  ]);

  assert.deepEqual(order, ["a", "b", "c"]);
  assert.equal(frames, 1, `3 same-tick commits waited on ${frames} animation frames`);
  scheduler.destroy();
});

test("many same-tick signal writes cost the same DOM work as one write", async () => {
  const window = new Window({ url: "http://perf.test/" });
  const { document } = window;
  document.body.innerHTML = `<output signal:text="status">start</output>`;
  const signals = createSignalRegistry({ status: signal("start") });
  const loader = Loader({ root: document.body, signals });
  loader.start();
  await delay(10); // let activation work settle before counting

  const output = document.querySelector("output");
  let records = 0;
  const observer = new window.MutationObserver((batch) => {
    records += batch.length;
  });
  observer.observe(output, { childList: true, characterData: true, subtree: true });

  // Self-calibrate: how many mutation records does ONE committed write cost
  // in this DOM implementation?
  signals.set("status", "baseline");
  await delay(30);
  const perUpdate = records;
  assert.ok(perUpdate > 0, "expected the baseline write to mutate the DOM");

  records = 0;
  for (let index = 0; index < 20; index += 1) {
    signals.set("status", `value-${index}`);
  }
  await delay(30); // one microtask flush + mutation delivery

  assert.equal(output.textContent, "value-19");
  assert.equal(
    records,
    perUpdate,
    `20 same-tick writes cost ${records} mutation records; a single write costs ${perUpdate}`
  );
  observer.disconnect();
});
