export default function cancelEdit() {
  const form = document.getElementById("note-form");
  form.querySelector("#note-id").value = "";
  form.querySelector("#note-title").value = "";
  form.querySelector("#note-content").value = "";
  form.querySelector('button[type="submit"]').textContent = "Add Note";

  // Show the note list
  document.getElementById("note-list-container").style.display = "block";
}
