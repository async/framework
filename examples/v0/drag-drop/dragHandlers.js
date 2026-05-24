import { getState, setState } from "./STATE.js";
//
import { showAlert } from "./show-alert.js";

// Helper function to clear drop styles from all notes
function clearAllDropStyles() {
  document.querySelectorAll(".note").forEach((note) => {
    note.classList.remove("drag-over");
    note.dataset.dropPosition = "";
  });
  setState("dropPosition", null);
}

export function onDragstart({ event, element }) {
  element.classList.add("dragging");
  setState("draggedId", element.dataset.id);
  event.dataTransfer.setData("text/plain", element.dataset.id);
  event.dataTransfer.effectAllowed = "move";
}

export function onDragend({ element }) {
  element.classList.remove("dragging");
  setState("draggedId", null);
  clearAllDropStyles();
}

export function onDragover({ event, element }) {
  event.dataTransfer.dropEffect = "move";

  const draggedId = getState("draggedId");
  if (!draggedId || draggedId === element.dataset.id) {
    return;
  }

  const draggedElement = document.querySelector(`[data-id="${draggedId}"]`);
  if (!draggedElement) return;

  // Don't allow dropping between two adjacent items that are being reordered
  if (
    (element.previousElementSibling === draggedElement &&
      event.clientY <
        element.getBoundingClientRect().top + element.offsetHeight / 2) ||
    (element.nextElementSibling === draggedElement &&
      event.clientY >
        element.getBoundingClientRect().top + element.offsetHeight / 2)
  ) {
    clearAllDropStyles();
    return;
  }

  // Clear any existing drop styles first
  clearAllDropStyles();

  const rect = element.getBoundingClientRect();
  const mouseY = event.clientY;
  const threshold = rect.top + (rect.height * 0.5);
  const isTop = mouseY < threshold;

  setState("dropPosition", isTop ? "top" : "bottom");
  element.dataset.dropPosition = isTop ? "top" : "bottom";
  element.classList.add("drag-over");
}

export function onDragleave({ element }) {
  element.classList.remove("drag-over");
  element.dataset.dropPosition = "";
}

export function onDrop({ element }) {
  try {
    const draggedId = getState("draggedId");
    const dropPosition = getState("dropPosition");

    if (!draggedId || draggedId === element.dataset.id) {
      return;
    }

    const draggedElement = document.querySelector(`[data-id="${draggedId}"]`);
    if (!draggedElement) return;

    // Simple insertion logic based on drop position
    if (dropPosition === "top") {
      // Don't do anything if trying to drop between the same elements
      if (draggedElement === element.previousElementSibling) {
        return;
      }
      // Insert before the target element
      element.parentNode.insertBefore(draggedElement, element);
    } else {
      // Don't do anything if trying to drop between the same elements
      if (draggedElement === element.nextElementSibling) {
        return;
      }
      // Insert after the target element
      element.parentNode.insertBefore(
        draggedElement,
        element.nextElementSibling,
      );
    }

    showAlert("Note moved successfully!", "success");
  } catch (error) {
    console.error("Drop error:", error);
    showAlert("Failed to move note", "error");
  } finally {
    clearAllDropStyles();
    setState("draggedId", null);
  }
}
