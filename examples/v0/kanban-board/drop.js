import { getState, setState } from "./STATE.js";

export default function onDrop({ event, dispatch }) {
  const idStr = event.dataTransfer.getData("text");
  const taskId = parseInt(idStr);
  if (!taskId) {
    throw new Error("no id for task");
  }
  const targetColumn = event.target.closest("[id]").id;

  const board = getState("board");
  let movedTask;

  const updatedBoard = Object.keys(board).reduce((acc, column) => {
    if (column === targetColumn) {
      acc[column] = [...board[column]];
    } else {
      const [task] = board[column].filter((t) => t.id === taskId);
      if (task) {
        movedTask = task;
        acc[column] = board[column].filter((t) => t.id !== taskId);
      } else {
        acc[column] = board[column];
      }
    }
    return acc;
  }, {});

  if (movedTask) {
    updatedBoard[targetColumn].push(movedTask);
  }

  setState("board", updatedBoard);
  dispatch("update-board", updatedBoard);
}
