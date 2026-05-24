import { showAlert } from "./show-alert.js";

export default function deleteResource({ event, signals }) {
  const code = event.target.dataset.code;
  const confirmModalSignal = signals.getOrCreate("confirmModalState", {
    isOpen: false,
    message: "",
    onConfirm: null,
  });

  confirmModalSignal.set({
    isOpen: true,
    message:
      "Are you sure you want to delete this resource? This action cannot be undone.",
    onConfirm: () => {
      // Get current resources
      const resourceSignal = signals.get("resources");
      const resources = resourceSignal.get();

      // Filter out the resource to delete
      const updatedResources = resources.filter((resource) =>
        resource.code !== code
      );

      // Update resources
      resourceSignal.set(updatedResources);

      // Show success alert
      showAlert("Resource deleted successfully");
    },
  });
}
