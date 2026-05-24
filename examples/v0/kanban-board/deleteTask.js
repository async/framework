import { getState, setState } from "./STATE.js";

export default function deleteTask({ element, dispatch }) {
  const el = element.closest("[data-id]");
  const taskId = parseInt(el.dataset.id);
  const board = getState("board");

  const updatedBoard = Object.keys(board).reduce((acc, column) => {
    acc[column] = board[column].filter((task) => task.id !== taskId);
    return acc;
  }, {});

  setState("board", updatedBoard);
  dispatch("update-board", updatedBoard);
}
