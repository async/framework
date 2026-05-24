import { getState, initialState, saveState } from "./STATE.js";

export default function clearState({ dispatch }) {
  const todos = getState("todos");
  Object.keys(initialState).forEach((key) => {
    todos[key].length = 0;
  });
  saveState("todo-list", todos);
  dispatch("update-todo-list", todos);
}
