export default function handler({ element }) {
  const todoList = element.closest("todo-list");
  todoList.todos.value = todoList.todos.value.filter((todo) => !todo.completed);
  todoList.forceUpdate();
}
