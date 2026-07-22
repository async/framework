const errorCodeKeys = [
  "runtimeError",
  "handlerNotRegistered",
  "invalidHandlerCommand",
  "serverCommandUnavailable",
  "handlerFailed",
  "componentNotRegistered",
  "asyncComponentUnsupported",
  "partialNotRegistered",
  "boundaryNotFound",
  "routeNotMatched",
  "navigationFailed",
  "entrypointRequired",
  "invalidServerTransportResponse",
  "unsupportedServerJsonValue"
];
const errorHints = [
  "Inspect the error.",
  "Register via Async.use({ handler }).",
  "Use valid handler syntax.",
  "Provide a server registry or proxy.",
  "Fix the handler cause.",
  "Register via Async.use({ component }).",
  "Use an async signal or partial.",
  "Register the partial.",
  "Add the async:boundary.",
  "Register the route or use fallback.",
  "Fix the navigation cause.",
  "Import the required entrypoint.",
  "Return a Response-like value.",
  "Pass JSON-safe values."
];

export const asyncErrorCodes = Object.freeze(Object.fromEntries(
  errorCodeKeys.map((key) => [
    key,
    key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  ])
));

const errorCodes = Object.values(asyncErrorCodes);

export class AsyncError extends Error {
  constructor(options) {
    if (!isRecord(options)) {
      throw new TypeError("new AsyncError({ code, message, ... }) requires an options object.");
    }
    const index = codeIndex(options.code);
    if (typeof options.message !== "string" || options.message.length === 0) {
      throw new TypeError("AsyncError message must be a non-empty string.");
    }
    super(options.message, Object.hasOwn(options, "cause") ? { cause: options.cause } : undefined);
    this.name = "AsyncError";
    defineStable(this, "code", options.code);
    defineStable(this, "hint", validHint(options.hint ?? errorHints[index]));
    const context = safeContext(options.context);
    if (context !== undefined) {
      defineStable(this, "context", context);
    }
  }
}

export function isAsyncError(value) {
  return value instanceof AsyncError;
}

export function toAsyncDiagnostic(options) {
  if (!isRecord(options) || !Object.hasOwn(options, "error")) {
    throw new TypeError("toAsyncDiagnostic({ error, ... }) requires an error record.");
  }
  const known = isAsyncError(options.error) ? options.error : undefined;
  const code = known?.code ?? options.code ?? asyncErrorCodes.runtimeError;
  const index = codeIndex(code);
  const context = mergeContext(known?.context, options.context);
  const diagnostic = {
    severity: "error",
    code,
    message: typeof options.error?.message === "string" ? options.error.message : String(options.error),
    hint: validHint(known?.hint ?? options.hint ?? errorHints[index])
  };
  if (context !== undefined) {
    diagnostic.context = context;
  }
  return Object.freeze(diagnostic);
}

export function reportAsyncError({ target, error, onError, code, hint, context } = {}) {
  assertAsyncErrorHandler(onError, "onError");
  const report = { error, diagnostic: toAsyncDiagnostic({ error, code, hint, context }) };
  let handled = false;
  if (onError) {
    try {
      onError(report);
      handled = true;
    } catch (callbackError) {
      reportUnhandled(callbackError);
    }
  }
  const EventCtor = target?.ownerDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  if (typeof EventCtor === "function" && typeof target?.dispatchEvent === "function") {
    const event = new EventCtor("async:error", {
      bubbles: true,
      cancelable: true,
      detail: report
    });
    target.dispatchEvent(event);
    handled ||= event.defaultPrevented;
  }
  if (!handled) {
    reportUnhandled(error);
  }
  return report;
}

export function assertAsyncErrorHandler(value, owner = "onError") {
  if (value !== undefined && typeof value !== "function") {
    throw new TypeError(`${owner} must be a function.`);
  }
}

function codeIndex(code) {
  const index = errorCodes.indexOf(code);
  if (index === -1) {
    throw new TypeError(`Unknown Async error code "${String(code)}".`);
  }
  return index;
}

function validHint(hint) {
  if (typeof hint !== "string" || hint.length === 0) {
    throw new TypeError("Async error hint must be a non-empty string.");
  }
  return hint;
}

function mergeContext(base, extra) {
  return base === undefined && extra === undefined
    ? undefined
    : safeContext({ ...(base ?? {}), ...(extra ?? {}) });
}

function safeContext(context) {
  if (context == null) {
    return undefined;
  }
  if (!isRecord(context)) {
    throw new TypeError("Async error context must be a record.");
  }
  const safe = {};
  for (const [key, value] of Object.entries(context)) {
    if (
      !/^(cause|stack|request[_-]?body)$/i.test(key) &&
      (value === null || typeof value === "string" || typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value)))
    ) {
      safe[key] = value;
    }
  }
  return Object.freeze(safe);
}

function reportUnhandled(error) {
  if (typeof globalThis.reportError === "function") {
    globalThis.reportError(error);
  } else {
    (globalThis.queueMicrotask ?? globalThis.setTimeout)(() => {
      throw error;
    });
  }
}

function defineStable(owner, key, value) {
  Object.defineProperty(owner, key, { enumerable: true, value });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
