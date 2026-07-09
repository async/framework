import assert from "node:assert/strict";
import { test } from "node:test";
import { delay } from "../../src/index.js";

test("delay resolves without a signal", async () => {
  await delay(1);
  assert.ok(true);
});

test("delay rejects immediately for an already aborted signal", async () => {
  const controller = new AbortController();
  const reason = new Error("already cancelled");
  controller.abort(reason);

  await assert.rejects(delay(20, controller.signal), /already cancelled/);
});

test("delay clears the timer when aborted during the wait", async () => {
  const controller = new AbortController();
  const waiting = delay(30, controller.signal);

  controller.abort(new Error("cancelled during wait"));

  await assert.rejects(waiting, /cancelled during wait/);
});
