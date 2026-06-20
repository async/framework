import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TRACE_CATEGORIES = ["blink.user_timing", "devtools.timeline", "disabled-by-default-devtools.timeline"];
const JS_EVENT_NAMES = new Set([
  "EventDispatch",
  "EvaluateScript",
  "v8.evaluateModule",
  "FunctionCall",
  "TimerFire",
  "FireIdleCallback",
  "FireAnimationFrame",
  "RunMicrotasks",
  "V8.Execute",
]);
const PAINT_EVENT_NAMES = new Set(["UpdateLayoutTree", "Layout", "Commit", "Paint", "Layerize", "PrePaint"]);

function normalizeEvent(event, type) {
  return {
    type,
    name: event.name,
    ts: Number(event.ts ?? 0),
    dur: Number(event.dur ?? 0),
    end: Number(event.ts ?? 0) + Number(event.dur ?? 0),
    pid: event.pid,
  };
}

function getEventType(event, startLogicEventName) {
  if (event.name === "EventDispatch") {
    const eventType = event.args?.data?.type;
    if (eventType === startLogicEventName) return "startLogicEvent";
    if (eventType === "click") return "click";
    if (eventType === "mousedown") return "mousedown";
    if (eventType === "pointerup") return "pointerup";
    return null;
  }
  if (event.ph !== "X") return null;
  if (event.name === "Layout") return "layout";
  if (event.name === "FunctionCall") return "functioncall";
  if (event.name === "HitTest") return "hittest";
  if (event.name === "Commit") return "commit";
  if (event.name === "Paint") return "paint";
  if (event.name === "FireAnimationFrame") return "fireAnimationFrame";
  if (event.name === "TimerFire") return "timerFire";
  if (event.name === "RequestAnimationFrame") return "requestAnimationFrame";
  return null;
}

function compactIntervals(events) {
  const intervals = events
    .filter((event) => event.end > event.ts)
    .map((event) => ({ start: event.ts, end: event.end }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged = [];
  for (const interval of intervals) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
    } else {
      previous.end = Math.max(previous.end, interval.end);
    }
  }
  return merged.reduce((total, interval) => total + interval.end - interval.start, 0) / 1000;
}

async function parseTraceFile(tracePath) {
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  return Array.isArray(trace.traceEvents) ? trace.traceEvents : [];
}

export async function captureTrace(client, tracePath, action) {
  await mkdir(path.dirname(tracePath), { recursive: true });
  const traceEvents = [];
  let completeTracing;
  const completed = new Promise((resolve) => {
    completeTracing = resolve;
  });
  client.on("Tracing.dataCollected", (event) => {
    if (Array.isArray(event.value)) traceEvents.push(...event.value);
  });
  client.on("Tracing.tracingComplete", () => completeTracing());

  await client.send("Tracing.start", {
    categories: TRACE_CATEGORIES.join(","),
    options: "record-as-much-as-possible",
  });
  try {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 40));
  } finally {
    await client.send("Tracing.end");
    await completed;
  }
  await writeFile(tracePath, JSON.stringify({ traceEvents }), "utf8");
}

export async function computeTraceMetrics(tracePath, startLogicEventName = "click") {
  const rawEvents = await parseTraceFile(tracePath);
  const timingEvents = rawEvents
    .map((event) => {
      const type = getEventType(event, startLogicEventName);
      return type ? normalizeEvent(event, type) : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.end - right.end);

  const startEvents = timingEvents.filter((event) => event.type === "startLogicEvent");
  if (startEvents.length === 0) throw new Error(`Trace ${tracePath} did not contain a ${startLogicEventName} dispatch event`);
  const startEvent = startEvents.at(-1);
  const mainPid = startEvent.pid;
  const mainThreadEvents = timingEvents.filter((event) => event.pid === mainPid && (event.ts > startEvent.end || event.type === "click"));
  const startFrom = mainThreadEvents.filter((event) => ["click", "fireAnimationFrame", "timerFire", "layout", "functioncall"].includes(event.type)).at(-1) ?? startEvent;
  const commitsAfterStart = mainThreadEvents.filter((event) => event.type === "commit" && event.ts > startFrom.end);
  const allCommitsAfterClick = mainThreadEvents.filter((event) => event.type === "commit");
  const endEvent =
    commitsAfterStart[0] ??
    allCommitsAfterClick.at(-1) ??
    mainThreadEvents.filter((event) => ["paint", "layout", "functioncall"].includes(event.type)).at(-1);
  if (!endEvent) throw new Error(`Trace ${tracePath} did not contain a measurable commit, paint, layout, or function event`);

  const windowStart = startEvent.ts;
  const windowEnd = endEvent.end;
  const duration = (windowEnd - windowStart) / 1000;
  const windowedRawEvents = rawEvents.filter((event) => Number(event.ts ?? 0) >= windowStart && Number(event.ts ?? 0) <= windowEnd);
  const scriptEvents = windowedRawEvents
    .filter((event) => (event.name === "EventDispatch" && event.args?.data?.type === "click") || (event.ph === "X" && JS_EVENT_NAMES.has(event.name)))
    .map((event) => normalizeEvent(event, event.name));
  const paintEvents = windowedRawEvents
    .filter((event) => event.ph === "X" && PAINT_EVENT_NAMES.has(event.name))
    .map((event) => normalizeEvent(event, event.name));

  return {
    total: duration,
    script: compactIntervals(scriptEvents),
    paint: compactIntervals(paintEvents),
    traceWindow: {
      start: windowStart,
      end: windowEnd,
      commitCount: allCommitsAfterClick.length,
      layoutCount: mainThreadEvents.filter((event) => event.type === "layout").length,
    },
  };
}
