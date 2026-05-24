import { generateRandomTodo } from "./generateRandomTodo.js";
import { createId, getState, setState } from "./STATE.js";

export default function addRandomTodo({ dispatch }) {
  const todos = getState("todos") || [];
  const todoText = generateRandomTodo();
  const newTodo = {
    id: createId(todoText),
    text: todoText,
    completed: false,
  };
  const newTodos = [...todos, newTodo];
  setState("todos", newTodos);

  dispatch("update-todo-list", newTodos);
}
