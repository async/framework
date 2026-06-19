import { startSignals } from "../../../dist/runtime/signals.js";

startSignals(document, {
  values: [["count", 1]],
  bindings: [[0, "text", "count"]]
}, {
  elements: ["[data-async-id='count']"]
});
