export default function handler({ element }) {
  const todoList = element.closest("todo-list");
  const id = Number(element.dataset.id);

  todoList.todos.value = todoList.todos.value.filter((todo) => todo.id !== id);
  todoList.forceUpdate();
}
