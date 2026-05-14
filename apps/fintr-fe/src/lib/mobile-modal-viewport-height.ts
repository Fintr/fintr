import { getCapacitorKeyboardInsetPx } from "@/lib/capacitor-keyboard-inset";

const VISUAL_VS_LAYOUT_STUCK_THRESHOLD_PX = 48;
const MIN_MODAL_VIEWPORT_HEIGHT_PX = 200;

/**
 * Pixel height for full-screen mobile modals (native keyboard, rotation).
 * Uses the Visual Viewport API when it tracks the visible area; when Capacitor
 * reports a keyboard height and `visualViewport` still matches the layout height
 * (common on iOS WKWebView with an overlay keyboard), uses `innerHeight - keyboardHeight`.
 */
export function getMobileModalViewportHeight(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const layoutHeight = window.innerHeight;
  const vv = window.visualViewport;
  const vvHeight =
    vv != null && Number.isFinite(vv.height) && vv.height > 0
      ? vv.height
      : layoutHeight;

  const kb = getCapacitorKeyboardInsetPx();

  if (kb > 0) {
    const visualLooksStuckNearFullLayout =
      vvHeight >= layoutHeight - VISUAL_VS_LAYOUT_STUCK_THRESHOLD_PX;

    if (visualLooksStuckNearFullLayout) {
      return Math.max(
        MIN_MODAL_VIEWPORT_HEIGHT_PX,
        Math.round(layoutHeight - kb)
      );
    }
  }

  if (vv != null && Number.isFinite(vv.height) && vv.height > 0) {
    return Math.round(vv.height);
  }

  return Math.round(layoutHeight);
}
