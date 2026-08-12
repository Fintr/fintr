export const CALCULATOR_KEYBOARD_HISTORY_KEY = "__fintrCalculatorKeyboard";

const calculatorHistoryRegistry = {
  openCount: 0,
  historyActive: false,
};

let pendingCalculatorHistoryBackTimer: ReturnType<typeof setTimeout> | null = null;
const calculatorPopStateSubscribers = new Set<() => void>();
let calculatorPopStateListenerAttached = false;

export function cancelPendingCalculatorHistoryBack() {
  if (pendingCalculatorHistoryBackTimer !== null) {
    clearTimeout(pendingCalculatorHistoryBackTimer);
    pendingCalculatorHistoryBackTimer = null;
  }
}

function handleCalculatorPopState(event: PopStateEvent) {
  if (event.state?.[CALCULATOR_KEYBOARD_HISTORY_KEY]) {
    return;
  }

  calculatorHistoryRegistry.historyActive = false;
  calculatorHistoryRegistry.openCount = 0;
  cancelPendingCalculatorHistoryBack();
  calculatorPopStateSubscribers.forEach((subscriber) => subscriber());
}

function ensureCalculatorPopStateListener() {
  if (calculatorPopStateListenerAttached) {
    return;
  }

  window.addEventListener("popstate", handleCalculatorPopState);
  calculatorPopStateListenerAttached = true;
}

export function acquireCalculatorHistoryEntry() {
  cancelPendingCalculatorHistoryBack();

  if (!calculatorHistoryRegistry.historyActive) {
    window.history.pushState({ [CALCULATOR_KEYBOARD_HISTORY_KEY]: true }, "");
    calculatorHistoryRegistry.historyActive = true;
  }

  calculatorHistoryRegistry.openCount += 1;
}

export function releaseCalculatorHistoryEntry() {
  calculatorHistoryRegistry.openCount = Math.max(
    0,
    calculatorHistoryRegistry.openCount - 1,
  );

  if (calculatorHistoryRegistry.openCount > 0) {
    cancelPendingCalculatorHistoryBack();
    return;
  }

  cancelPendingCalculatorHistoryBack();
  pendingCalculatorHistoryBackTimer = setTimeout(() => {
    pendingCalculatorHistoryBackTimer = null;

    if (calculatorHistoryRegistry.openCount > 0) {
      return;
    }

    if (!calculatorHistoryRegistry.historyActive) {
      return;
    }

    calculatorHistoryRegistry.historyActive = false;

    // Only pop when our entry is still on top. Another overlay (Rates, date,
    // currency, etc.) may have pushState'd during the same click; blindly
    // calling history.back() would dismiss that overlay and leave a stale
    // calculator state that closes the parent Add Transaction sheet.
    if (window.history.state?.[CALCULATOR_KEYBOARD_HISTORY_KEY]) {
      window.history.back();
    }
  }, 0);
}

/**
 * When opening a nested history-managed overlay while the calculator entry is
 * still on top, replace that entry instead of stacking. Leaves no orphaned
 * calculator state under the new overlay.
 */
export function claimHistoryOverCalculatorKeyboard(historyKey: string) {
  cancelPendingCalculatorHistoryBack();

  if (window.history.state?.[CALCULATOR_KEYBOARD_HISTORY_KEY]) {
    calculatorHistoryRegistry.historyActive = false;
    calculatorHistoryRegistry.openCount = 0;
    window.history.replaceState({ [historyKey]: true }, "");
    return;
  }

  window.history.pushState({ [historyKey]: true }, "");
}

export function subscribeCalculatorPopState(onClose: () => void) {
  ensureCalculatorPopStateListener();
  calculatorPopStateSubscribers.add(onClose);

  return () => {
    calculatorPopStateSubscribers.delete(onClose);

    if (calculatorPopStateSubscribers.size === 0 && calculatorPopStateListenerAttached) {
      window.removeEventListener("popstate", handleCalculatorPopState);
      calculatorPopStateListenerAttached = false;
    }
  };
}
