/**
 * Portal root for overlays opened from inside modals/sheets (category picker,
 * calculator, etc.). Must sit above tutorial-adjusted modal content (z 10040)
 * and the tutorial spotlight (z 10050).
 */
export const NESTED_OVERLAY_LAYER_Z_INDEX = 10100;

const NESTED_OVERLAY_ROOT_ID = "fintr-nested-overlay-root";

export function getNestedOverlayPortalRoot(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }

  let root = document.getElementById(NESTED_OVERLAY_ROOT_ID);

  if (!(root instanceof HTMLElement)) {
    root = document.createElement("div");
    root.id = NESTED_OVERLAY_ROOT_ID;
    root.setAttribute("data-fintr-nested-overlay-root", "");
  }

  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.zIndex = String(NESTED_OVERLAY_LAYER_Z_INDEX);
  root.style.pointerEvents = "none";
  root.style.isolation = "isolate";

  // Append once — re-appending an existing body child moves it to the end of
  // `document.body`, which can restart CSS enter animations on nested sheets.
  if (!root.parentElement) {
    document.body.appendChild(root);
  }

  return root;
}

export function hasNestedOverlayContent(): boolean {
  const root = document.getElementById(NESTED_OVERLAY_ROOT_ID);

  return root instanceof HTMLElement && root.childElementCount > 0;
}

export function isVisibleModalContentOpen(): boolean {
  const modals = document.querySelectorAll("[data-modal-content]");

  for (const modal of modals) {
    if (!(modal instanceof HTMLElement)) {
      continue;
    }

    const style = window.getComputedStyle(modal);
    if (
      style.display === "none"
      || style.visibility === "hidden"
      || Number.parseFloat(style.opacity) === 0
    ) {
      continue;
    }

    const rect = modal.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return true;
    }
  }

  return false;
}
