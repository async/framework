export default function preventStopDefault({ event }) {
  event.preventDefault();
  event.stopPropagation();
}
