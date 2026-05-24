export default function updateTemperature({ signals, element }) {
  const celsius = signals.get("celsius");
  const fahrenheit = signals.get("fahrenheit");
  const value = parseFloat(element.value) || 0;
  console.log("updateTemperature", value);

  celsius.set(value);
  fahrenheit.set(((celsius.value * 9) / 5 + 32).toFixed(2));
}
