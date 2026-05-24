let count = 0;
export default function emitCustomEvent({ element, dispatch }) {
  count++;
  console.log("emitCustomEvent: emit custom event", element.tagName);
  dispatch("my-event", `Hello World ${count}`);
}
