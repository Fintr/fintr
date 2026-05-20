export const isWithinDialogCompanionLayer = (target: EventTarget | null): boolean => {
  if (!(target instanceof Node)) {
    return false;
  }

  const companions = document.querySelectorAll(
    "[data-grid-picker-modal], [data-calculator-keyboard]",
  );

  return Array.from(companions).some((layer) => layer.contains(target));
};
