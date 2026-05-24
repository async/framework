import { remoteCount } from "./signals.js";

export function onClick() {
  remoteCount.value = remoteCount.value + 1;
  return remoteCount.value;
}

export function onMouseenter({ element }) {
  element.style.outline = "2px solid #4f46e5";
}

export function onMouseleave({ element }) {
  element.style.outline = "none";
}
