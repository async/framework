import { getState, saveState } from "./STATE.js";

export default function clearState({ dispatch }) {
  const board = getState("board");
  Object.keys(board).forEach((key) => {
    // Clear array contents
    board[key].length = 0;
  });
  saveState("board", board);
  dispatch("update-board", board);
}
