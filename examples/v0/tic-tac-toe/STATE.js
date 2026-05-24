const state = {
  board: Array(9).fill(null),
  currentPlayer: "X",
  gameOver: false,
  winner: null,
};

export function getState() {
  return state;
}

export function setState(newState) {
  Object.assign(state, newState);
}

export function initializeState() {
  setState({
    board: Array(9).fill(null),
    currentPlayer: "X",
    gameOver: false,
    winner: null,
  });
}
