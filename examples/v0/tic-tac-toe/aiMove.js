import { getState, setState } from "./STATE.js";
import renderBoard from "./renderBoard.js";
import checkWinner from "./checkWinner.js";

export default function aiMove() {
  const { board, gameOver } = getState();

  if (gameOver) {
    return;
  }

  const availableMoves = board.reduce((acc, cell, index) => {
    if (cell === null) {
      acc.push(index);
    }
    return acc;
  }, []);

  if (availableMoves.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    const aiMoveIndex = availableMoves[randomIndex];

    const newBoard = [...board];
    newBoard[aiMoveIndex] = "O";

    setState({ board: newBoard, currentPlayer: "X" });
    renderBoard();

    const winner = checkWinner();
    if (winner) {
      setState({ gameOver: true, winner });
      renderBoard();
    } else if (!newBoard.includes(null)) {
      setState({ gameOver: true });
      renderBoard();
    }
  }
}
