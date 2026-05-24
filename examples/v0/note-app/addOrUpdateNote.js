import { getState, setState } from "./STATE.js";

export default function addOrUpdateNote({ element, dispatch }) {
  console.log("addOrUpdateNote: event triggered");
  const idInput = element.querySelector("#note-id");
  const titleInput = element.querySelector("#note-title");
  const contentInput = element.querySelector("#note-content");
  const submitButton = element.querySelector('button[type="submit"]');
  const id = idInput.value ? parseInt(idInput.value) : null;
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (title && content) {
    console.log("addOrUpdateNote: adding/updating note", title);
    const notes = getState("notes");
    let newNotes;

    if (id) {
      // Update existing note
      newNotes = notes.map((note) =>
        note.id === id ? { ...note, title, content } : note
      );
    } else {
      // Add new note
      newNotes = [...notes, {
        id: Date.now(),
        title,
        content,
        createdAt: new Date().toISOString(),
      }];
    }

    setState("notes", newNotes);

    // reset form and default button text after adding/updating note
    idInput.value = "";
    titleInput.value = "";
    contentInput.value = "";
    submitButton.textContent = "Add Note";

    // Show the note list
    document.getElementById("note-list-container").style.display = "block";

    dispatch("update-note-list", newNotes);
  }
}
