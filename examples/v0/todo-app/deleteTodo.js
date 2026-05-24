import { getState, setState } from "./STATE.js";

export default function deleteTodo({ element, dispatch }) {
  const el = element.closest("[data-id]");
  const todoId = el.dataset.id;

  console.log("deleteTodo: todoId", todoId);
  const todos = getState("todos");

  const updatedTodos = todos.filter((todo) => `${todo.id}` !== `${todoId}`);

  setState("todos", updatedTodos);
  dispatch("update-todo-list", updatedTodos);
}
