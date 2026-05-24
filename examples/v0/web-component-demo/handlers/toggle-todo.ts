export default function handler({ element }) {
  const todoList = element.closest("todo-list");
  const id = Number(element.dataset.id);

  todoList.todos.value = todoList.todos.value.map((todo) =>
    todo.id === id ? { ...todo, completed: element.checked } : todo
  );
  todoList.forceUpdate();
}
