import { getState, setState } from "./STATE.js";

export default function addNote({ element, dispatch }) {
  console.log("addNote: event triggered");
  const titleInput = element.querySelector("#note-title");
  const contentInput = element.querySelector("#note-content");
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (title && content) {
    console.log("addNote: adding note", title);
    const notes = getState("notes");
    const newNotes = [...notes, {
      id: Date.now(),
      title,
      content,
      createdAt: new Date().toISOString(),
    }];
    setState("notes", newNotes);
    titleInput.value = "";
    contentInput.value = "";
    dispatch("update-note-list", newNotes);
  }
}
