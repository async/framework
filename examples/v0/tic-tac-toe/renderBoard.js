import { getState } from "./STATE.js";

export default function renderBoard() {
  const { board, gameOver, winner } = getState();
  const gameBoard = document.getElementById("game-board");
  const gameStatus = document.getElementById("game-status");

  gameBoard.innerHTML = board.map((cell, index) => `
    <div class="h-24 bg-gray-200 flex items-center justify-center text-4xl font-bold cursor-pointer hover:bg-gray-300" data-index="${index}">
      ${cell || ""}
    </div>
  `).join("");

  if (gameOver) {
    gameStatus.textContent = winner ? `${winner} wins!` : "It's a draw!";
  } else {
    gameStatus.textContent = `Current player: ${getState().currentPlayer}`;
  }
}
