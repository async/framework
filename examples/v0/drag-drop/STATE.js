const STATE = {
  draggedId: null,
  dropPosition: null,
};

export function getState(key) {
  return STATE[key];
}

export function setState(key, value) {
  STATE[key] = value;
}
