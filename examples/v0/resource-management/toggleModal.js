// Format JSON with syntax highlighting
function formatJSON(json) {
  if (!json) return "";
  let obj;
  try {
    obj = typeof json === "string" ? JSON.parse(json) : json;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return "";
  }
  return JSON.stringify(obj, null, 2)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        let cls = "text-purple-600"; // number
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "text-gray-700 font-semibold"; // key
          } else {
            cls = "text-green-600"; // string
          }
        } else if (/true|false/.test(match)) {
          cls = "text-blue-600"; // boolean
        } else if (/null/.test(match)) {
          cls = "text-red-600"; // null
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
}

export default function toggleModal({ event, signals }) {
  const button = event.target;
  const jsonData = button.dataset.json;

  // Get or initialize the modal state signal
  const modalSignal = signals.getOrCreate("modalState", {
    isOpen: false,
    content: "",
  });
  const signal = modalSignal.get();

  // Toggle modal and set content
  if (!signal.isOpen) {
    const content = formatJSON(jsonData);
    console.log("toggleModal: opening modal");
    modalSignal.set({
      isOpen: true,
      content,
    });
  } else {
    console.log("toggleModal: closing modal");
    modalSignal.set({
      isOpen: false,
      content: "",
    });
  }
}
