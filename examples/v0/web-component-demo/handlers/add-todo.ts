export default function handler(context) {
  const { event, element } = context;
  event.preventDefault();

  const todoList = element.closest("todo-list");
  const text = todoList.newTodoText.value.trim();

  if (text) {
    const currentTodos = todoList.todos.value;
    const newTodo = {
      id: todoList.nextId.value++,
      text,
      completed: false,
    };

    // Force a new array reference to trigger reactivity
    todoList.todos.value = [...currentTodos, newTodo];
    todoList.newTodoText.value = "";

    // Force an update of the component
    todoList.forceUpdate();
  }
}
