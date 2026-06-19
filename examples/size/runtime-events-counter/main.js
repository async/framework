import { start } from "../../../dist/runtime.js";

start(document, {
  version: 1,
  elements: ["[data-async-id='add']", "[data-async-id='count']"],
  signals: {
    values: [["count", 0]],
    bindings: [[1, "text", "count"]]
  },
  events: {
    events: [[0, "click", [["handler", "increment"]]]],
    handlers: {
      increment({ signals }) {
        signals.update("count", (value) => value + 1);
      }
    }
  }
});
