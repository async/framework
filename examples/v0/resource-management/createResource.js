import { showAlert } from "./show-alert.js";

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function createResource({ element, signals }) {
  const titleInput = element.querySelector("#title");
  const detailsInput = element.querySelector("#details");
  const dataInput = element.querySelector("#data");
  const resourcesSignal = signals.get("resources");

  let parsedData = {};
  try {
    parsedData = dataInput.value.trim() ? JSON.parse(dataInput.value) : {};
  } catch (error) {
    console.error(error);
    showAlert("Invalid JSON data format", "error");
    return;
  }

  const newResource = {
    code: generateUUID(),
    title: titleInput.value.trim(),
    details: detailsInput.value.trim(),
    data: parsedData,
    deactivated: false,
    valid: true,
  };

  const resources = resourcesSignal.get();
  resourcesSignal.set([newResource, ...resources]);

  // Reset form
  element.reset();
  showAlert("Resource created successfully");
}
