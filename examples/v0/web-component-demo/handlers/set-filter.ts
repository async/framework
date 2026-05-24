export default function handler({ element }) {
  const todoList = element.closest("todo-list");
  todoList.filter.value = element.dataset.filter;
  todoList.forceUpdate();
}
