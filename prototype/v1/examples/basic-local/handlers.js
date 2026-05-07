import { count } from "./signals.js";

export function onClick({ value }) {
  const next = Number(value ?? count.value) + 1;
  count.value = next;
  return next;
}

export function logAfter({ value }) {
  console.log("counter after click", value);
}
