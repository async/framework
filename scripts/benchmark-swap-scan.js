#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { Window } from "happy-dom";
import {
  Loader,
  createHandlerRegistry,
  createSignalRegistry,
  signal
} from "../src/index.js";

const rowCount = Number(process.env.ROWS ?? 2000);
const iterations = Number(process.env.ITERATIONS ?? 5);
const scenarios = [
  { label: "replace/auto", strategy: "replace", scan: "auto" },
  { label: "replace/full", strategy: "replace", scan: "full" },
  { label: "replace/none", strategy: "replace", scan: "none" },
  { label: "morph/auto", strategy: "morph", scan: "auto" },
  { label: "morph/full", strategy: "morph", scan: "full" },
  { label: "morph/none", strategy: "morph", scan: "none" }
];

function rowsHtml(count, variant) {
  let output = "";
  for (let index = 0; index < count; index += 1) {
    output += `<button id="row-${index}" async:key="row-${index}" data-row="${index}" on:click="select" signal:class:selected="selected">Row ${index} ${variant}</button>`;
  }
  return output;
}

function run({ strategy, scan }) {
  const window = new Window();
  const { document } = window;
  document.body.innerHTML = `<section async:boundary="rows"></section>`;

  const signals = createSignalRegistry({
    selected: signal(false)
  });
  const loader = Loader({
    root: document.body,
    signals,
    handlers: createHandlerRegistry({
      select() {
        this.signals.set("selected", true);
      }
    })
  }).start();

  loader.swap("rows", rowsHtml(rowCount, "initial"), { scan: "auto" });
  const start = performance.now();
  loader.swap("rows", rowsHtml(rowCount, "updated"), { strategy, scan });
  const duration = performance.now() - start;
  loader.destroy();
  return duration;
}

function summarize(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    avg: total / values.length,
    max: sorted.at(-1)
  };
}

console.log(`swap+scan benchmark (${rowCount} stable nodes, ${iterations} iterations)`);
for (const scenario of scenarios) {
  const values = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    values.push(run(scenario));
  }
  const stats = summarize(values);
  console.log(
    `${scenario.label.padEnd(12)} min=${stats.min.toFixed(2)}ms median=${stats.median.toFixed(2)}ms avg=${stats.avg.toFixed(2)}ms max=${stats.max.toFixed(2)}ms`
  );
}
