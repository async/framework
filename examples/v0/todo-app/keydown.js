import preventDefault from "./prevent-default.js";

export default function keydown({ event, element, dispatch }) {
  if (event.key === "Enter") {
    preventDefault({ event, element });
    // Trigger the form submission manually
    dispatch("submit");
  }
}
