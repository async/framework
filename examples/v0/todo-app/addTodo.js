import { createId, getState, setState } from "./STATE.js";

export default function addTodo({ element, dispatch }) {
  console.log("addTodo: event triggered");
  const input = element.querySelector("input");
  const todoText = input.value.trim();

  if (todoText) {
    console.log("addTodo: adding todo", todoText);
    const todos = getState("todos");
    const newTodos = [...todos, {
      id: createId(todoText),
      text: todoText,
      completed: false,
    }];
    setState("todos", newTodos);
    input.value = "";
    dispatch("update-todo-list", newTodos);
  } else {
    console.warn("addTodo: no todo text found");
    input.focus();
  }
}
