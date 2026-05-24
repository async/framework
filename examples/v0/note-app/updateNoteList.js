export default function updateNoteList({ event, element }) {
  const notes = event.detail;
  console.log("Update note list event:", notes.length);

  element.innerHTML = /*html*/ `
    <ul class="divide-y divide-gray-200">
      ${
    notes.length === 0
      ? /*html*/ `
          <li class="py-4 text-center text-gray-500 italic">No notes found</li>
        `
      : notes.map((note) => /*html*/ `
          <li class="py-4">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="text-lg font-semibold text-gray-800">${note.title}</h3>
                <p class="text-gray-600">${note.content}</p>
                <p class="text-sm text-gray-400">${
        new Date(note.createdAt).toLocaleString()
      }</p>
              </div>
              <div>
                <button
                  class="text-blue-600 hover:text-blue-800 focus:outline-none mr-2"
                  on:click="editNote.js"
                  data-id="${note.id}"
                >
                  Edit
                </button>
                <button
                  class="text-red-600 hover:text-red-800 focus:outline-none"
                  on:click="deleteNote.js"
                  data-id="${note.id}"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        `).join("")
  }
    </ul>
  `;

  // Ensure the note list container is visible
  element.style.display = "block";
}
