export function onMyEvent({ value, element }) {
  console.log("onMyEvent: on custom event triggered", element.tagName);
  console.log("onMyEvent: event detail", value);
  element.innerHTML = value;
}
