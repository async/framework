// logger.js

export default function logger({ element, event, value, stringify }) {
  console.log(
    "logger:",
    stringify({
      element: element.tagName,
      event: event.type,
      value,
    }),
  );
}
