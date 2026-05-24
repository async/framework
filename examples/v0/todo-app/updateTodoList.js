export default function updateTodoList({ event, element }) {
  const todos = event.detail;
  console.log("Update todo list event:", todos.length);
  // console.log("Update todo list event:", todos.length, JSON.stringify(todos, null, 2));

  // requestAnimationFrame(() => {
  element.innerHTML = /*html*/ `
    <ul class="divide-y divide-gray-200">
    ${
    todos.length === 0
      ? `<li class="py-4 text-center text-gray-500 italic">No todos found</li>`
      : todos.map((todo) => `
        <li 
          class="py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
        todo.completed ? "bg-gray-100" : ""
      }"
          data-id="${todo.id}"
        >
          <div class="flex items-center flex-1">
            <input
              type="checkbox"
              class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
              ${todo.completed ? "checked" : ""}
              data-action="toggle"
              on:change="prevent-default.js, toggleTodo.js"
            >
            <label 
              class="ml-3 block text-gray-900 flex-grow cursor-pointer select-none ${
        todo.completed ? "line-through text-gray-500" : ""
      }"
              data-action="toggle"
              on:click="prevent-default.js, toggleTodo.js"
            >
              ${todo.text}
            </label>
          </div>
          <button
            class="ml-2 px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors focus:outline-none"
            on:click="prevent-default.js, deleteTodo.js"
          >
            [X]
          </button>
        </li>
      `).join("")
  }
    </ul>
  `;
  // });
}
