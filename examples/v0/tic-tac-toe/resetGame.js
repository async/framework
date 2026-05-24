import { initializeState } from "./STATE.js";
import renderBoard from "./renderBoard.js";

export default function resetGame() {
  initializeState();
  renderBoard();
}
