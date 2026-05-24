import { showAlert } from "./show-alert.js";

export default function toggleStatus({ element, signals }) {
  const code = element.dataset.code;
  const resourcesSignal = signals.get("resources");
  const resources = resourcesSignal.get();

  const updatedResources = resources.map((resource) => {
    if (resource.code === code) {
      return { ...resource, deactivated: !resource.deactivated };
    }
    return resource;
  });

  resourcesSignal.set(updatedResources);
  showAlert("Resource status updated successfully");
}
