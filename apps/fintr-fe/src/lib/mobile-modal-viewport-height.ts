/**
 * Pixel height for full-screen mobile modals (Android keyboard, rotation).
 * Prefers the Visual Viewport API so layout tracks the on-screen area when the
 * soft keyboard opens/closes and when the layout viewport changes after rotation.
 */
export function getMobileModalViewportHeight(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const vv = window.visualViewport;

  if (vv != null && Number.isFinite(vv.height) && vv.height > 0) {
    return Math.round(vv.height);
  }

  return window.innerHeight;
}
