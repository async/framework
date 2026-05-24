import { getState, setState } from "./STATE.js";

export default function deleteNote({ event, dispatch }) {
  const noteId = parseInt(event.target.dataset.id);
  console.log("deleteNote: noteId", noteId);
  const notes = getState("notes");

  const updatedNotes = notes.filter((note) => note.id !== noteId);

  setState("notes", updatedNotes);
  dispatch("update-note-list", updatedNotes);
}
