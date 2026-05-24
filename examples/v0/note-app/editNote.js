import { getState } from "./STATE.js";

export default function editNote({ event }) {
  const noteId = parseInt(event.target.dataset.id);
  console.log("editNote: noteId", noteId);
  const notes = getState("notes");

  const noteToEdit = notes.find((note) => note.id === noteId);
  if (noteToEdit) {
    // set the form values to the note to edit
    const form = document.getElementById("note-form");
    form.querySelector("#note-id").value = noteToEdit.id;
    form.querySelector("#note-title").value = noteToEdit.title;
    form.querySelector("#note-content").value = noteToEdit.content;
    form.querySelector("#note-title").focus();

    // change the button text to update
    form.querySelector('button[type="submit"]').textContent = "Update Note";

    // Hide the note list
    document.getElementById("note-list-container").style.display = "none";
  }
}
