export default function onDragstart({ event, element }) {
  const id = element.dataset.id || element.closest("[data-id]").dataset.id;
  console.log("dragstart", id);
  event.dataTransfer.setData("text", id);
  return id;
}
