export default function preventDefault({ event }) {
  console.log("Prevent default event:", event.target.tagName);
  event.preventDefault();
  event.stopPropagation();
}
