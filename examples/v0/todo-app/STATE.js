export const state = {
  todos: [],
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
  return JSON.parse(localStorage.getItem(key) || "[]");
}

export const initialState = {
  todos: [],
};

function generateId(label) {
  // Normalize the label:
  // 1. Convert to lowercase
  // 2. Replace all whitespace with single dash
  // 3. Remove any non-alphanumeric characters except dashes
  const normalizedLabel = label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  // Ensure we have a valid label part, default to 'task' if empty
  const labelPart = normalizedLabel || "task";
  const randomPart = Math.random().toString(36).substr(2, 6);

  // Create a unique ID combining timestamp, normalized label, and random string
  return `${Date.now()}-${labelPart}-${randomPart}`;
}

export function createId(label = "") {
  return generateId(label);
}

export function clearState(context) {
  localStorage.clear();
  const todos = [];
  state.todos = todos;
  if (context?.dispatch) {
    context.dispatch("update-todo-list", todos);
  }
}
