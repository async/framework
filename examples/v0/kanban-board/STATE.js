export const state = {
  board: {
    todo: [],
    inprogress: [],
    done: [],
  },
};

export function setState(key, value) {
  state[key] = value;
}

export function getState(key) {
  return state[key];
}

export function saveState(key) {
  localStorage.setItem(key, JSON.stringify(state[key]));
}

export function loadState(key) {
  return JSON.parse(localStorage.getItem(key) || "null");
}

export const initialState = {
  todo: [],
  inprogress: [],
  done: [],
};
