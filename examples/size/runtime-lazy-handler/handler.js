export function increment({ signals }) {
  signals.update("count", (value) => value + 1);
}
