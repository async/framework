export function cancelConfirmModal({ signals }) {
  const confirmModalSignal = signals.get("confirmModalState");
  confirmModalSignal.set({
    isOpen: false,
    message: "",
    onConfirm: null,
  });
}

export function confirmAction({ signals }) {
  const confirmModalSignal = signals.get("confirmModalState");
  const { onConfirm } = confirmModalSignal.get();

  // Execute the stored callback
  if (typeof onConfirm === "function") {
    onConfirm();
  }

  // Close the modal
  cancelConfirmModal({ signals });
}
