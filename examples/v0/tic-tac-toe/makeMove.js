import { getState, setState } from "./STATE.js";
import renderBoard from "./renderBoard.js";
import checkWinner from "./checkWinner.js";
import aiMove from "./aiMove.js";

export default function makeMove({ event }) {
  const { board, currentPlayer, gameOver } = getState();
  const cellIndex = event.target.dataset.index;

  if (gameOver || !cellIndex || board[cellIndex] !== null) {
    return;
  }

  const newBoard = [...board];
  newBoard[cellIndex] = currentPlayer;

  setState({ board: newBoard });
  renderBoard();

  const winner = checkWinner();
  if (winner) {
    setState({ gameOver: true, winner });
    renderBoard();
  } else if (!newBoard.includes(null)) {
    setState({ gameOver: true });
    renderBoard();
  } else {
    setState({ currentPlayer: "O" });
    renderBoard();
    setTimeout(aiMove, 500);
  }
}
