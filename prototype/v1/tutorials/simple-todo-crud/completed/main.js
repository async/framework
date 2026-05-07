import { createAsyncFramework, effect, signal } from "../../../index.ts";
import { createTodoHandlers } from "./handlers.js";

const root = document.querySelector("#app");
const framework = createAsyncFramework({ root });

const signals = {
  todos: signal([
    { id: "1", title: "Read architecture docs", done: false },
    { id: "2", title: "Ship todo tutorial", done: true },
  ]),
  editingId: signal(null),
  editDraft: signal(""),
};

function todoItem(todo) {
  if (signals.editingId.value === todo.id) {
    return `
      <li>
        <form on:submit="todo/save-edit">
          <input id="edit-input" value="${escapeHtml(signals.editDraft.value)}" on:input="todo/update-draft" />
          <button type="submit">Save</button>
        </form>
      </li>
    `;
  }

  return `
    <li>
      <button data-id="${todo.id}" on:click="todo/toggle">${todo.done ? "✅" : "⬜"}</button>
      <span>${escapeHtml(todo.title)}</span>
      <button data-id="${todo.id}" on:click="todo/start-edit">Edit</button>
      <button data-id="${todo.id}" on:click="todo/remove">Delete</button>
    </li>
  `;
}

const handlers = createTodoHandlers(signals);
framework.handlers.registerHandlers({
  "todo/add": handlers.addTodo,
  "todo/toggle": handlers.toggleTodo,
  "todo/remove": handlers.removeTodo,
  "todo/start-edit": handlers.startEdit,
  "todo/update-draft": handlers.updateDraft,
  "todo/save-edit": handlers.saveEdit,
});

framework.start();

effect(() => {
  const todos = signals.todos.value;
  const complete = todos.filter((todo) => todo.done).length;

  root.innerHTML = `
    <section>
      <h1>Todo CRUD</h1>
      <p>${complete}/${todos.length} complete</p>

      <form on:submit="todo/add">
        <input id="todo-input" placeholder="Add a todo" />
        <button type="submit">Add</button>
      </form>

      <ul>
        ${todos.map(todoItem).join("")}
      </ul>
    </section>
  `;

  const editInput = document.querySelector("#edit-input");
  if (editInput) editInput.value = signals.editDraft.value;
});

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
