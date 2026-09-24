import {
  getDashboardBottomTab,
  type DashboardBottomTab,
} from "@/lib/dashboard-nav-routes";

export const TUTORIAL_Z_INDEX = 10050;

/**
 * Joyride's overlay defaults to the full document height and captures every
 * tap. On iOS that layer sits over the fixed Menu tab, so Next and the tab
 * itself never receive the touch. Keep the dim visual, and let taps through.
 */
export function tourBlockingOverlayStyle(): {
  position: "fixed";
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  height: "100%";
  overflow: "visible";
  pointerEvents: "none";
  backgroundColor: "transparent";
  mixBlendMode: "normal";
  zIndex: number;
} {
  return {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    height: "100%",
    overflow: "visible",
    pointerEvents: "none",
    backgroundColor: "transparent",
    mixBlendMode: "normal",
    zIndex: TUTORIAL_Z_INDEX,
  };
}

const SPOTLIGHT_PADDING = 8;

export function tourSpotlightHoleStyle(rect: {
  top: number;
  left: number;
  width: number;
  height: number;
}): {
  position: "fixed";
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
  backgroundColor: "transparent";
  boxShadow: string;
  pointerEvents: "none";
} {
  return {
    position: "fixed",
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
    borderRadius: 12,
    backgroundColor: "transparent",
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
    pointerEvents: "none",
  };
}

export function tourSpotlightPanels(input: {
  hole: { top: number; left: number; width: number; height: number };
  viewport: { width: number; height: number };
}): Array<{
  position: "fixed";
  top: number;
  left: number;
  width: number;
  height: number;
  backgroundColor: string;
  pointerEvents: "none";
}> {
  const padding = 8;
  const holeTop = input.hole.top - padding;
  const holeLeft = input.hole.left - padding;
  const holeWidth = input.hole.width + padding * 2;
  const holeHeight = input.hole.height + padding * 2;
  const holeRight = holeLeft + holeWidth;
  const holeBottom = holeTop + holeHeight;
  const { width, height } = input.viewport;
  const panels = [
    { top: 0, left: 0, width, height: holeTop },
    { top: holeBottom, left: 0, width, height: height - holeBottom },
    { top: holeTop, left: 0, width: holeLeft, height: holeHeight },
    { top: holeTop, left: holeRight, width: width - holeRight, height: holeHeight },
  ];

  return panels
    .filter((panel) => panel.width > 0 && panel.height > 0)
    .map((panel) => ({
      position: "fixed",
      top: panel.top,
      left: panel.left,
      width: panel.width,
      height: panel.height,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      pointerEvents: "none",
    }));
}

export function shouldHideTourOverlay(_stepId: string | undefined): boolean {
  return false;
}

export function tourTooltipPlacement(
  _stepId: string,
  position: "top" | "bottom" | "left" | "right" | "center" | undefined,
): "top" | "bottom" | "left" | "right" | "center" | "auto" {
  return position ?? "bottom";
}

export const TOUR_TOOLTIP_Z_INDEX = 1000001;
export const TOUR_ACTION_LOCK_MS = 600;

export function shouldRunTourAction(
  lastActionAt: number,
  now: number,
): boolean {
  return now - lastActionAt >= TOUR_ACTION_LOCK_MS;
}

export function shouldRunTourActionOnPointerDown(
  _pointerType: string,
): boolean {
  return false;
}

const TOUR_TAB_STEP_IDS = new Set([
  "expense-tab",
  "income-tab",
  "transfer-tab",
  "loan-tab",
]);

export function isTourTabStep(stepId: string | undefined): boolean {
  return Boolean(stepId && TOUR_TAB_STEP_IDS.has(stepId));
}

/**
 * Tab steps live inside dialogs. If the next tab is not painted yet, Next
 * has to open the current control first. Selecting a missing tab leaves the
 * tour on the opener forever.
 */
export function planAdvanceToTabStep(input: {
  currentAction?: string;
  nextStepId?: string;
  nextTargetVisible: boolean;
}): "activate-current-target" | "select-next-tab" | null {
  if (!isTourTabStep(input.nextStepId)) {
    return null;
  }

  const opensDialog =
    (input.currentAction == null || input.currentAction === "click") &&
    !input.nextTargetVisible;

  if (opensDialog) {
    return "activate-current-target";
  }

  return "select-next-tab";
}

export function activateTourTargetOnce(target: HTMLElement): void {
  if (target.getAttribute("role") === "tab") {
    target.dispatchEvent(
      new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );
    return;
  }

  target.click();
}

export function isTourTargetReady(selector: string): boolean {
  if (!isTourTargetVisible(selector)) {
    return false;
  }

  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.getAttribute("role") === "tab") {
    return element.getAttribute("aria-selected") === "true";
  }

  return true;
}

const TOUR_TOOLTIP_GAP = 12;
const DEFAULT_CARD_HEIGHT = 200;

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function tourTooltipCardStyle(input: {
  placement: string | undefined;
  target: {
    top: number;
    left: number;
    width: number;
    height: number;
    bottom: number;
  } | null;
  viewport: { width: number; height: number };
  cardHeight?: number;
  insets?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  zIndex?: number;
}): {
  position: "fixed";
  width: number;
  maxHeight: number;
  overflow: "visible";
  boxSizing: "border-box";
  zIndex: number;
  pointerEvents: "auto";
  touchAction: "manipulation";
  left: number;
  top: number;
} {
  const insets = {
    top: input.insets?.top ?? 16,
    right: input.insets?.right ?? 16,
    bottom: input.insets?.bottom ?? 16,
    left: input.insets?.left ?? 16,
  };
  const cardHeight = input.cardHeight ?? DEFAULT_CARD_HEIGHT;
  const width = Math.min(
    320,
    Math.max(0, input.viewport.width - insets.left - insets.right),
  );
  const maxHeight = Math.max(
    0,
    input.viewport.height - insets.top - insets.bottom,
  );
  const usedHeight = Math.min(cardHeight, maxHeight);
  const placement = input.placement ?? "bottom";
  const target = input.target;
  const preferredLeft = target
    ? target.left + target.width / 2 - width / 2
    : (input.viewport.width - width) / 2;
  const left = clamp(
    preferredLeft,
    insets.left,
    input.viewport.width - insets.right - width,
  );
  const fits = (top: number) =>
    top >= insets.top &&
    top + usedHeight <= input.viewport.height - insets.bottom;

  let top = insets.top + Math.max(0, (maxHeight - usedHeight) / 2);

  if (target && placement !== "center") {
    const above = target.top - TOUR_TOOLTIP_GAP - usedHeight;
    const below = target.bottom + TOUR_TOOLTIP_GAP;

    if (placement.startsWith("bottom")) {
      top = fits(below) ? below : fits(above) ? above : insets.top;
    } else {
      top = fits(above) ? above : fits(below) ? below : insets.top;
    }
  }

  top = clamp(
    top,
    insets.top,
    Math.max(insets.top, input.viewport.height - insets.bottom - usedHeight),
  );

  return {
    position: "fixed",
    width,
    maxHeight,
    overflow: "visible",
    boxSizing: "border-box",
    zIndex: input.zIndex ?? TOUR_TOOLTIP_Z_INDEX,
    pointerEvents: "auto",
    touchAction: "manipulation",
    left,
    top,
  };
}

export type TourStepNavigation = {
  href: string;
  tab: DashboardBottomTab;
  nextTargetSelector: string;
};

const MOBILE_FIXED_TOUR_STEP_IDS = new Set([
  "mobile-add-button",
  "mobile-add-receipt-button",
  "mobile-menu-button",
  "dashboard-tab",
]);

export function isFixedMobileTourStep(
  stepId: string,
  platform: "desktop" | "mobile" | null,
): boolean {
  return platform === "mobile" && MOBILE_FIXED_TOUR_STEP_IDS.has(stepId);
}

/**
 * Bottom-nav steps that leave the current screen. Next must commit that
 * route itself — a synthetic click on the link does not reliably run the
 * dashboard tab interceptor, so the tour waits forever for the next tile.
 */
export function resolveTourStepNavigation(
  stepId: string,
  nextTargetSelector?: string,
): TourStepNavigation | null {
  if (stepId === "mobile-menu-button") {
    return {
      href: "/dashboard/app_settings",
      tab: "menu",
      nextTargetSelector:
        nextTargetSelector || '[data-tutorial-target="loan-menu-item"]',
    };
  }

  if (stepId === "dashboard-tab") {
    return {
      href: "/dashboard/insights",
      tab: "insights",
      nextTargetSelector:
        nextTargetSelector || '[data-tutorial-target="dashboard-summary"]',
    };
  }

  return null;
}

export function shouldCommitTourNavigationImmediately(
  pathname: string,
): boolean {
  return (
    pathname.startsWith("/dashboard") &&
    getDashboardBottomTab(pathname) === null
  );
}

export function isTourTargetVisible(selector: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    Number.parseFloat(style.opacity) === 0
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

const TOOLTIP_SELECTOR = '[data-testid="tutorial-tooltip"]';

export function tooltipButtonAtPoint(
  point: { x: number; y: number },
  root: ParentNode = document,
): HTMLButtonElement | null {
  const tooltip = root.querySelector(TOOLTIP_SELECTOR);
  if (!tooltip) {
    return null;
  }

  const buttons = tooltip.querySelectorAll("button");
  for (const button of buttons) {
    const rect = button.getBoundingClientRect();
    const inside =
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom;
    if (inside) {
      return button;
    }
  }

  return null;
}

export function shouldForwardTooltipButtonTap(
  eventTarget: EventTarget | null,
  button: HTMLButtonElement | null,
): button is HTMLButtonElement {
  if (!button) {
    return false;
  }

  const tooltip = button.closest(TOOLTIP_SELECTOR);
  if (eventTarget instanceof Node && tooltip?.contains(eventTarget)) {
    return false;
  }

  return true;
}
