import { getState, setState } from "./STATE.js";

export default function toggleTodo({ element, dispatch }) {
  // Find the closest li element that contains the todo item
  const todoItem = element.closest("[data-id]");
  if (!todoItem) {
    console.error("toggleTodo: no todo item found");
    return;
  }

  const todoId = todoItem.dataset.id;
  console.log("Toggle todo event:", element.tagName, todoId);
  if (!todoId) {
    console.error("toggleTodo: no todo id found");
    return;
  }
  const todos = getState("todos");

  // Find and toggle the todo
  const updatedTodos = todos.map((todo) => {
    if (`${todo.id}` === `${todoId}`) {
      return { ...todo, completed: !todo.completed };
    }
    return todo;
  });

  // Update state and trigger re-render
  setState("todos", updatedTodos);

  dispatch("update-todo-list", updatedTodos);
}
