import { getState, setState } from "./STATE.js";

export default function addTask({ element, dispatch }) {
  const input = element.querySelector("#new-task");
  const taskText = input.value.trim();

  if (taskText) {
    const board = getState("board");
    const newTask = {
      id: Date.now(),
      text: taskText,
    };
    const updatedBoard = {
      ...board,
      todo: [...board.todo, newTask],
    };
    setState("board", updatedBoard);
    input.value = "";
    dispatch("update-board", updatedBoard);
  }
}
