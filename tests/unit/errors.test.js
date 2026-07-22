import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AsyncError,
  asyncErrorCodes,
  isAsyncError,
  reportAsyncError,
  toAsyncDiagnostic
} from "../../src/errors.js";

test("asyncErrorCodes exposes the stable initial catalog", () => {
  assert.deepEqual(Object.values(asyncErrorCodes), [
    "runtime-error",
    "handler-not-registered",
    "invalid-handler-command",
    "server-command-unavailable",
    "handler-failed",
    "component-not-registered",
    "async-component-unsupported",
    "partial-not-registered",
    "boundary-not-found",
    "route-not-matched",
    "navigation-failed",
    "entrypoint-required",
    "invalid-server-transport-response",
    "unsupported-server-json-value"
  ]);
  assert.equal(Object.isFrozen(asyncErrorCodes), true);
});

test("AsyncError keeps stable fields and scalar-only frozen context", () => {
  const cause = new Error("database unavailable");
  const error = new AsyncError({
    code: asyncErrorCodes.handlerNotRegistered,
    message: 'Handler "save" is not registered.',
    hint: "Register the handler before starting the app.",
    context: {
      handler: "save",
      attempt: 2,
      active: false,
      route: null,
      ignoredObject: { secret: true },
      ignoredArray: ["private"],
      ignoredUndefined: undefined,
      ignoredNan: Number.NaN,
      ignoredInfinity: Number.POSITIVE_INFINITY,
      stack: "private stack",
      cause: "private cause",
      requestBody: "private body",
      request_body: "private body"
    },
    cause
  });

  assert.equal(error.name, "AsyncError");
  assert.equal(error.code, "handler-not-registered");
  assert.equal(error.hint, "Register the handler before starting the app.");
  assert.equal(error.cause, cause);
  assert.deepEqual(error.context, {
    handler: "save",
    attempt: 2,
    active: false,
    route: null
  });
  assert.equal(Object.isFrozen(error.context), true);
  assert.equal(isAsyncError(error), true);
  assert.equal(isAsyncError(cause), false);
  assert.throws(() => {
    error.code = "runtime-error";
  }, TypeError);
});

test("toAsyncDiagnostic normalizes AsyncError and merges safe call-site context", () => {
  const error = new AsyncError({
    code: asyncErrorCodes.boundaryNotFound,
    message: 'Boundary "details" was not found.',
    hint: "Add the boundary to the active root.",
    context: { boundary: "details", source: "loader" }
  });

  const diagnostic = toAsyncDiagnostic({
    error,
    code: asyncErrorCodes.runtimeError,
    hint: "ignored fallback",
    context: { source: "event", event: "click", ignored: documentLike() }
  });

  assert.deepEqual(diagnostic, {
    severity: "error",
    code: "boundary-not-found",
    message: 'Boundary "details" was not found.',
    hint: "Add the boundary to the active root.",
    context: {
      boundary: "details",
      source: "event",
      event: "click"
    }
  });
  assert.equal(Object.isFrozen(diagnostic), true);
  assert.equal(Object.isFrozen(diagnostic.context), true);
});

test("toAsyncDiagnostic gives unknown failures an explicit fallback contract", () => {
  const diagnostic = toAsyncDiagnostic({
    error: "offline",
    code: asyncErrorCodes.navigationFailed,
    hint: "Retry or inspect the transport.",
    context: { mode: "spa" }
  });

  assert.deepEqual(diagnostic, {
    severity: "error",
    code: "navigation-failed",
    message: "offline",
    hint: "Retry or inspect the transport.",
    context: { mode: "spa" }
  });
});

test("error helpers reject undocumented codes and malformed public options", () => {
  assert.throws(() => new AsyncError(), /requires an options object/);
  assert.throws(() => new AsyncError({ code: "unknown", message: "bad" }), /Unknown Async error code/);
  assert.throws(() => new AsyncError({ code: asyncErrorCodes.runtimeError, message: "" }), /non-empty string/);
  assert.throws(() => new AsyncError({ code: asyncErrorCodes.runtimeError, message: "bad", hint: 1 }), /hint/);
  assert.throws(() => new AsyncError({ code: asyncErrorCodes.runtimeError, message: "bad", context: [] }), /context/);
  assert.throws(() => reportAsyncError({ error: new Error("bad"), onError: null }), /must be a function/);
  assert.throws(() => toAsyncDiagnostic(), /requires an error record/);
  assert.throws(
    () => toAsyncDiagnostic({ error: new Error("bad"), code: "unknown" }),
    /Unknown Async error code/
  );
});

test("reportAsyncError still uses the callback when CustomEvent is unavailable", () => {
  const originalCustomEvent = globalThis.CustomEvent;
  const originalReportError = globalThis.reportError;
  const seen = [];
  globalThis.CustomEvent = undefined;
  globalThis.reportError = (error) => seen.push(["reported", error]);
  try {
    const error = new Error("offline");
    reportAsyncError({
      target: { dispatchEvent: () => assert.fail("event dispatch should be skipped") },
      error,
      onError(report) {
        seen.push(["callback", report.diagnostic.code]);
      }
    });
    assert.deepEqual(seen, [["callback", "runtime-error"]]);
  } finally {
    if (originalCustomEvent === undefined) {
      delete globalThis.CustomEvent;
    } else {
      globalThis.CustomEvent = originalCustomEvent;
    }
    if (originalReportError === undefined) {
      delete globalThis.reportError;
    } else {
      globalThis.reportError = originalReportError;
    }
  }
});

test("reportAsyncError reaches reportError when no callback or event constructor handles it", () => {
  const originalCustomEvent = globalThis.CustomEvent;
  const originalReportError = globalThis.reportError;
  const reported = [];
  globalThis.CustomEvent = undefined;
  globalThis.reportError = (error) => reported.push(error);
  try {
    const error = new Error("offline");
    reportAsyncError({ target: {}, error });
    assert.deepEqual(reported, [error]);
  } finally {
    restoreGlobal("CustomEvent", originalCustomEvent);
    restoreGlobal("reportError", originalReportError);
  }
});

test("reportAsyncError queues the original throw when reportError is unavailable", () => {
  const originalCustomEvent = globalThis.CustomEvent;
  const originalReportError = globalThis.reportError;
  const originalQueueMicrotask = globalThis.queueMicrotask;
  let queued;
  globalThis.CustomEvent = undefined;
  globalThis.reportError = undefined;
  globalThis.queueMicrotask = (callback) => {
    queued = callback;
  };
  try {
    const error = new Error("offline");
    reportAsyncError({ target: {}, error });
    assert.equal(typeof queued, "function");
    assert.throws(
      () => queued(),
      (thrown) => thrown === error
    );
  } finally {
    restoreGlobal("CustomEvent", originalCustomEvent);
    restoreGlobal("reportError", originalReportError);
    restoreGlobal("queueMicrotask", originalQueueMicrotask);
  }
});

function documentLike() {
  return { nodeType: 9, private: true };
}

function restoreGlobal(name, value) {
  if (value === undefined) {
    delete globalThis[name];
  } else {
    globalThis[name] = value;
  }
}
