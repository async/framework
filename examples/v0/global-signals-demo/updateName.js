export default function updateName({ signals, element }) {
  const firstName = signals.get("firstName");
  const lastName = signals.get("lastName");
  const fullName = signals.get("fullName");
  console.log("updateName", element.id);

  if (element.id === "firstName") {
    firstName.set(element.value);
    fullName.set(`${firstName.get()} ${lastName.get()}`.trim());
  } else if (element.id === "lastName") {
    lastName.set(element.value);
    fullName.set(`${firstName.get()} ${lastName.get()}`.trim());
  }
}
