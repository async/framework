// clickHandler2.js
let count = 0;

export default function clickHandler2({ element }) {
  count++;
  element.textContent = `Clicked Me! ${count}`;
  return count;
}
