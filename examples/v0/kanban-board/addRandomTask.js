import { generateRandomTask } from "./generateRandomTask.js";
import { getState, setState } from "./STATE.js";

export default function addRandomTask({ dispatch }) {
  const board = getState("board");
  const newTask = {
    id: Date.now(),
    text: generateRandomTask(),
  };

  const newBoard = {
    ...board,
    todo: [newTask, ...board.todo],
  };
  setState("board", newBoard);
  dispatch("update-board", newBoard);
}
