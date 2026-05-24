export default function handler({ element }) {
  console.log("update input", { element });
  const todoList = element.closest("todo-list");
  todoList.newTodoText.value = element.value;
}
