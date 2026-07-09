// Scheduler frame-timing gotchas.
//
// Real browsers run boundary commits on animation frames; node commits
// synchronously. Every regression in this suite forces frame timing
// explicitly so the browser-only failure modes stay covered:
//   - hidden tabs suspend requestAnimationFrame entirely;
//   - automatic flushes are suppressed while scheduler.batch(...) is open;
//   - commit completion promises settle only when a flush reaches the commit
//     phase.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createScheduler, delay } from "../../src/index.js";

const NEVER = () => {}; // suspended rAF: hidden/backgrounded tab
const frame = (ms = 4) => (cb) => setTimeout(() => cb(Date.now()), ms);

const withTimeout = (promise, label, ms = 2000) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms))
  ]);

test("frame-timed commits fall back to a timeout when animation frames are suspended", async () => {
  const scheduler = createScheduler({
    requestAnimationFrame: NEVER,
    frameFallbackMs: 10
  });
  assert.equal(scheduler.timing.commit, "frame");

  let committed = false;
  await withTimeout(scheduler.commit(() => {
    committed = true;
  }), "commit under suspended rAF");

  assert.equal(committed, true);
  scheduler.destroy();
});

test("suspended-rAF commits complete with the default frame fallback", async () => {
  const scheduler = createScheduler({ requestAnimationFrame: NEVER });

  let committed = false;
  await withTimeout(scheduler.commit(() => {
    committed = true;
  }), "commit under default fallback");

  assert.equal(committed, true);
  scheduler.destroy();
});

test("commits run exactly once when the animation frame beats the fallback", async () => {
  const scheduler = createScheduler({
    requestAnimationFrame: frame(2),
    frameFallbackMs: 50
  });

  let runs = 0;
  await withTimeout(scheduler.commit(() => {
    runs += 1;
  }), "frame-first commit");
  // Give the fallback timer room to (incorrectly) double-run the phase wait.
  await delay(80);

  assert.equal(runs, 1);
  scheduler.destroy();
});

test("commits run exactly once when the fallback beats a late animation frame", async () => {
  const scheduler = createScheduler({
    requestAnimationFrame: frame(60),
    frameFallbackMs: 5
  });

  let runs = 0;
  await withTimeout(scheduler.commit(() => {
    runs += 1;
  }), "fallback-first commit");
  await delay(100); // late frame fires afterwards; must not re-run

  assert.equal(runs, 1);
  scheduler.destroy();
});

test("commit promises resolve without a manual flush call", async () => {
  // Automatic microtask flush + frame wait must be enough; requiring callers
  // to flush() by hand is exactly how navigation stalls slip in.
  const scheduler = createScheduler({ requestAnimationFrame: frame(), frameFallbackMs: 50 });

  let committed = false;
  await withTimeout(scheduler.commit(() => {
    committed = true;
  }), "auto-flushed commit");

  assert.equal(committed, true);
  scheduler.destroy();
});

test("commits scheduled inside an open batch land after the batch settles", async () => {
  // requestFlush() is a no-op while batchDepth > 0. A fire-and-forget commit
  // inside a batch must still land once the batch ends — the safe composition
  // (awaiting the commit INSIDE the batch is the documented deadlock).
  const scheduler = createScheduler({ requestAnimationFrame: frame(), frameFallbackMs: 25 });

  let committed = false;
  let commitPromise;
  await scheduler.batch(async () => {
    commitPromise = scheduler.commit(() => {
      committed = true;
    });
    await delay(10);
    assert.equal(committed, false, "commit must not run while the batch is open");
  });

  await withTimeout(commitPromise, "batch-end commit");
  assert.equal(committed, true);
  scheduler.destroy();
});

test("frame-timed commits stay first-in first-out", async () => {
  const scheduler = createScheduler({ requestAnimationFrame: frame(), frameFallbackMs: 25 });

  const order = [];
  const commits = [
    scheduler.commit(() => order.push("a")),
    scheduler.commit(() => order.push("b")),
    scheduler.commit(() => order.push("c"))
  ];
  await withTimeout(Promise.all(commits), "ordered commits");

  assert.deepEqual(order, ["a", "b", "c"]);
  scheduler.destroy();
});

test("flush() drains frame-timed commits while frames are suspended", async () => {
  const scheduler = createScheduler({ requestAnimationFrame: NEVER, frameFallbackMs: 10 });

  let committed = false;
  const commit = scheduler.commit(() => {
    committed = true;
  });
  await withTimeout(scheduler.flush(), "explicit flush under suspended rAF");
  await withTimeout(commit, "commit settle");

  assert.equal(committed, true);
  scheduler.destroy();
});
