// Manage alerts state
const alertState = {
  container: null,
  queue: [],
  stacks: new Map(), // Track stacks by type-message key
};

// Create or get alert container
function getAlertContainer() {
  if (!alertState.container) {
    alertState.container = document.createElement("div");
    alertState.container.id = "alertContainer";
    alertState.container.className =
      "fixed top-4 right-4 z-50 flex flex-col gap-2";
    document.body.appendChild(alertState.container);
  }
  return alertState.container;
}

// Create alert element with styles
function createAlert(message, type) {
  const alert = document.createElement("div");
  alert.className = `
    px-6 py-4 rounded-lg shadow-lg 
    transform transition-all duration-200 
    border-l-4 flex justify-between items-center
    min-w-[320px] max-w-[400px]
    ${
    type === "success" ? "bg-white border-green-500" : "bg-white border-red-500"
  }
    translate-x-full opacity-0
  `;

  const messageDiv = document.createElement("div");
  messageDiv.className = `${
    type === "success" ? "text-green-700" : "text-red-700"
  } flex-grow pr-4 text-sm font-medium`;
  messageDiv.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.innerHTML = "×";
  closeButton.className =
    "text-gray-400 hover:text-gray-600 font-bold text-xl leading-none focus:outline-none";

  alert.appendChild(messageDiv);
  alert.appendChild(closeButton);

  return { alert, closeButton };
}

// Handle alert removal
async function removeAlert(alert, stackContainer, stackKey) {
  await animateOut(alert);
  if (!alert.isConnected) return;

  const alertHeight = alert.offsetHeight;
  const alerts = Array.from(stackContainer.children);
  const index = alerts.indexOf(alert);

  // Remove the alert
  alert.remove();

  // Reposition remaining alerts
  alerts.slice(index + 1).forEach((remainingAlert) => {
    const currentTop = parseInt(remainingAlert.style.top);
    remainingAlert.style.top = `${currentTop - alertHeight}px`;
  });

  // Update stack container height
  stackContainer.style.height = `${(alerts.length - 1) * alertHeight}px`;

  const stack = alertState.stacks.get(stackKey);
  if (stack) {
    alertState.stacks.set(stackKey, stack - 1);
    if (stack <= 1) alertState.stacks.delete(stackKey);
  }

  if (stackContainer.childElementCount === 0) {
    stackContainer.remove();
    if (alertState.container.childElementCount === 0) {
      alertState.container.remove();
      alertState.container = null;
    }
  }
}

// Animation helpers
async function animateIn(alert) {
  await new Promise((resolve) => setTimeout(resolve, 100));
  alert.style.transform = "translateX(0)";
  alert.style.opacity = "1";
}

async function animateOut(alert) {
  alert.style.transform = "translateX(100%)";
  alert.style.opacity = "0";
  await new Promise((resolve) => setTimeout(resolve, 200));
}

// Process single alert
async function processAlert({ message, type }) {
  const container = getAlertContainer();
  const stackKey = `${type}-${message}`;

  // Create or get stack container
  let stackContainer = container.querySelector(
    `[data-stack-key="${stackKey}"]`,
  );
  if (!stackContainer) {
    stackContainer = document.createElement("div");
    stackContainer.className = "relative mb-2";
    stackContainer.dataset.stackKey = stackKey;
    stackContainer.style.width = "400px";
    container.appendChild(stackContainer);
  }

  // Create and setup alert
  const { alert, closeButton } = createAlert(message, type);
  stackContainer.appendChild(alert);

  // Get alert height for proper spacing
  const alertHeight = alert.offsetHeight;
  stackContainer.style.height = `${alertHeight}px`;

  // Configure alert position
  alert.style.position = "absolute";
  alert.style.width = "100%";

  // Calculate vertical position based on existing alerts
  const existingAlerts = stackContainer.children;
  const verticalOffset = (existingAlerts.length - 1) * alertHeight;
  alert.style.top = `${verticalOffset}px`;
  alert.style.right = "0";

  // Update stack container height to accommodate all alerts
  stackContainer.style.height = `${existingAlerts.length * alertHeight}px`;

  // Update stack tracking
  alertState.stacks.set(stackKey, (alertState.stacks.get(stackKey) || 0) + 1);

  // Setup event handlers
  closeButton.onclick = () => removeAlert(alert, stackContainer, stackKey);

  // Animate and auto-remove
  await animateIn(alert);
  setTimeout(() => removeAlert(alert, stackContainer, stackKey), 5000);
}

// Process queue
function processQueue() {
  if (alertState.queue.length === 0) return;
  const alert = alertState.queue.shift();
  processAlert(alert).then(() => {
    if (alertState.queue.length > 0) {
      requestAnimationFrame(processQueue);
    }
  });
}

// Public API
export function showAlert(message, type = "success") {
  alertState.queue.push({ message, type });
  requestAnimationFrame(processQueue);
}
