export default function preventDefault({ event }) {
  event.preventDefault();
  event.stopPropagation();
}
