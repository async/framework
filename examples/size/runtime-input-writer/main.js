import { start } from "../../../dist/runtime.js";

start(document, {
  version: 1,
  elements: ["[data-async-id='name']", "[data-async-id='preview']"],
  signals: {
    values: [["name", ""]],
    bindings: [
      [0, "value", "name"],
      [1, "text", "name"]
    ]
  },
  events: {
    events: [[0, "input", [["setSignal", "name", ["event.target.value"]]]]]
  }
});
