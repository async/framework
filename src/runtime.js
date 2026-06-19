import { startEvents } from "./runtime/events.js";
import { startSignals } from "./runtime/signals.js";
import { createRuntimeController, normalizeRuntimeStartArgs } from "./runtime/shared.js";

export function start(rootOrOptions, planArg, optionsArg) {
  const { root, plan, options } = normalizeRuntimeStartArgs(rootOrOptions, planArg, optionsArg);
  assertRuntimePlan(plan);
  const children = [];
  let stopped = false;

  try {
    let signals;
    if (plan.signals) {
      signals = startSignals(root, plan.signals, {
        elements: plan.elements,
        signal: options.signal,
        onDiagnostic: options.onDiagnostic
      });
      children.push(signals);
    }

    if (plan.events) {
      children.push(startEvents(root, plan.events, {
        elements: plan.elements,
        signal: options.signal,
        signals,
        importModule: options.importModule,
        onDiagnostic: options.onDiagnostic
      }));
    }
  } catch (error) {
    stopChildren(children);
    throw error;
  }

  return createRuntimeController({
    get stopped() {
      return stopped;
    },
    stop() {
      if (stopped) {
        return;
      }
      stopped = true;
      stopChildren(children);
    }
  }, options.signal);
}

function stopChildren(children) {
  for (const child of [...children].reverse()) {
    child.stop();
  }
}

function assertRuntimePlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new TypeError("Runtime plan must be an object.");
  }
  if (plan.version !== 1) {
    throw new Error(`Unsupported runtime plan version: ${String(plan.version)}.`);
  }
}
