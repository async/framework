export default function incrementCounter({ signals }) {
  const count = signals.get("count");
  // console.log("incrementCounter: count", count.value);
  count.value++;
  console.log("incrementCounter: count", count.value);
}
