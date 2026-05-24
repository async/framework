export default function decrementCounter({ signals }) {
  const count = signals.get("count");
  count.value--;
}
