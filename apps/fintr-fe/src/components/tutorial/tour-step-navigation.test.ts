import { describe, expect, it, vi } from "vitest";

import {
  activateTourTargetOnce,
  isTourTabStep,
  isTourTargetReady,
  isTourTargetVisible,
  planAdvanceToTabStep,
  resolveTourStepNavigation,
  shouldCommitTourNavigationImmediately,
  shouldForwardTooltipButtonTap,
  shouldHideTourOverlay,
  shouldRunTourAction,
  shouldRunTourActionOnPointerDown,
  tooltipButtonAtPoint,
  tourBlockingOverlayStyle,
  tourSpotlightHoleStyle,
  tourSpotlightPanels,
  tourTooltipCardStyle,
  tourTooltipPlacement,
  TOUR_TOOLTIP_Z_INDEX,
} from "./tour-step-navigation";

describe("tour action input", () => {
  it("waits for click for mouse, touch, and pen", () => {
    expect(shouldRunTourActionOnPointerDown("mouse")).toBe(false);
    expect(shouldRunTourActionOnPointerDown("touch")).toBe(false);
    expect(shouldRunTourActionOnPointerDown("pen")).toBe(false);
  });

  it("rejects the compatibility click after a touch advances the step", () => {
    expect(shouldRunTourAction(1_000, 1_300)).toBe(false);
    expect(shouldRunTourAction(1_000, 1_600)).toBe(true);
  });
});

describe("activateTourTargetOnce", () => {
  it("dispatches one click without extra pointer or mouse events", () => {
    const target = document.createElement("button");
    const click = vi.fn();
    const mouseDown = vi.fn();
    const pointerDown = vi.fn();

    target.addEventListener("click", click);
    target.addEventListener("mousedown", mouseDown);
    target.addEventListener("pointerdown", pointerDown);

    activateTourTargetOnce(target);

    expect(click).toHaveBeenCalledOnce();
    expect(mouseDown).not.toHaveBeenCalled();
    expect(pointerDown).not.toHaveBeenCalled();
  });

  it("activates a tab with one mousedown so the next tab is selected", () => {
    const target = document.createElement("button");
    target.setAttribute("role", "tab");
    const click = vi.fn();
    const mouseDown = vi.fn();

    target.addEventListener("click", click);
    target.addEventListener("mousedown", mouseDown);

    activateTourTargetOnce(target);

    expect(mouseDown).toHaveBeenCalledOnce();
    expect(mouseDown.mock.calls[0][0].button).toBe(0);
    expect(click).not.toHaveBeenCalled();
  });
});

describe("planAdvanceToTabStep", () => {
  it("opens the current control before a tab that is not on screen yet", () => {
    expect(
      planAdvanceToTabStep({
        currentAction: undefined,
        nextStepId: "expense-tab",
        nextTargetVisible: false,
      }),
    ).toBe("activate-current-target");
  });

  it("selects a tab that is already on screen", () => {
    expect(
      planAdvanceToTabStep({
        currentAction: "highlight-only",
        nextStepId: "income-tab",
        nextTargetVisible: true,
      }),
    ).toBe("select-next-tab");
  });

  it("leaves non-tab steps to the normal click path", () => {
    expect(
      planAdvanceToTabStep({
        currentAction: undefined,
        nextStepId: "income-form",
        nextTargetVisible: false,
      }),
    ).toBeNull();
  });
});

describe("isTourTargetReady", () => {
  it("waits until the income tab is the selected tab", () => {
    const expense = document.createElement("button");
    expense.setAttribute("role", "tab");
    expense.setAttribute("data-tutorial-target", "expense-tab");
    expense.setAttribute("aria-selected", "true");
    expense.getBoundingClientRect = () => ({
      width: 80,
      height: 32,
      top: 0,
      left: 0,
      bottom: 32,
      right: 80,
      x: 0,
      y: 0,
      toJSON() {},
    });

    const income = document.createElement("button");
    income.setAttribute("role", "tab");
    income.setAttribute("data-tutorial-target", "income-tab");
    income.setAttribute("aria-selected", "false");
    income.getBoundingClientRect = () => ({
      width: 80,
      height: 32,
      top: 0,
      left: 80,
      bottom: 32,
      right: 160,
      x: 80,
      y: 0,
      toJSON() {},
    });

    document.body.append(expense, income);

    expect(isTourTabStep("income-tab")).toBe(true);
    expect(isTourTargetReady('[data-tutorial-target="income-tab"]')).toBe(false);

    income.setAttribute("aria-selected", "true");

    expect(isTourTargetReady('[data-tutorial-target="income-tab"]')).toBe(true);

    expense.remove();
    income.remove();
  });
});

describe("resolveTourStepNavigation", () => {
  it("opens the menu screen before the loans tile step", () => {
    expect(
      resolveTourStepNavigation(
        "mobile-menu-button",
        '[data-tutorial-target="loan-menu-item"]',
      ),
    ).toEqual({
      href: "/dashboard/app_settings",
      tab: "menu",
      nextTargetSelector: '[data-tutorial-target="loan-menu-item"]',
    });
  });

  it("opens insights before the dashboard summary step", () => {
    expect(resolveTourStepNavigation("dashboard-tab")).toEqual({
      href: "/dashboard/insights",
      tab: "insights",
      nextTargetSelector: '[data-tutorial-target="dashboard-summary"]',
    });
  });

  it("returns null for steps that stay on the current screen", () => {
    expect(resolveTourStepNavigation("loan-menu-item")).toBeNull();
  });
});

describe("shouldCommitTourNavigationImmediately", () => {
  it("commits from a nested detail page because pending tabs are ignored there", () => {
    expect(
      shouldCommitTourNavigationImmediately("/dashboard/loans/detail"),
    ).toBe(true);
  });

  it("waits for the destination target when already on a cached tab", () => {
    expect(
      shouldCommitTourNavigationImmediately("/dashboard/loans"),
    ).toBe(false);
  });
});

describe("tourBlockingOverlayStyle", () => {
  it("does not let the dim layer eat taps on the fixed Menu button", () => {
    const style = tourBlockingOverlayStyle();

    expect(style.pointerEvents).toBe("none");
    expect(style.position).toBe("fixed");
    expect(style.height).toBe("100%");
    expect(style.backgroundColor).toBe("transparent");
    expect(style.mixBlendMode).toBe("normal");
  });
});

describe("tourSpotlightHoleStyle", () => {
  it("cuts a transparent hole around the target instead of painting a solid box", () => {
    const style = tourSpotlightHoleStyle({
      top: 700,
      left: 300,
      width: 64,
      height: 48,
    });

    expect(style.pointerEvents).toBe("none");
    expect(style.backgroundColor).toBe("transparent");
    expect(style.boxShadow).toContain("9999px");
    expect(style.top).toBe(692);
    expect(style.left).toBe(292);
    expect(style.width).toBe(80);
    expect(style.height).toBe(64);
  });
});

describe("tourSpotlightPanels", () => {
  it("leaves the Menu button uncovered and does not paint a solid hole", () => {
    const panels = tourSpotlightPanels({
      hole: { top: 740, left: 300, width: 72, height: 56 },
      viewport: { width: 390, height: 844 },
    });
    const menu = { top: 748, left: 310, right: 360, bottom: 788 };

    for (const panel of panels) {
      const overlaps =
        menu.left < panel.left + panel.width &&
        menu.right > panel.left &&
        menu.top < panel.top + panel.height &&
        menu.bottom > panel.top;
      expect(overlaps).toBe(false);
      expect(panel.backgroundColor).toBe("rgba(0, 0, 0, 0.55)");
      expect(panel.pointerEvents).toBe("none");
    }
  });
});

describe("tourTooltipCardStyle", () => {
  it("places the Menu card above the tab on its own tappable layer", () => {
    const style = tourTooltipCardStyle({
      placement: "top",
      cardHeight: 180,
      target: {
        top: 740,
        left: 300,
        width: 72,
        height: 56,
        bottom: 796,
      },
      viewport: { width: 390, height: 844 },
    });

    expect(style.position).toBe("fixed");
    expect(style.pointerEvents).toBe("auto");
    expect(style.touchAction).toBe("manipulation");
    expect(style.zIndex).toBe(TOUR_TOOLTIP_Z_INDEX);
    expect(style.zIndex).toBeGreaterThan(100000);
    expect(style.top).toBe(548);
    expect(style.top + 180).toBeLessThanOrEqual(844 - 16);
    expect(style.left).toBeGreaterThanOrEqual(16);
    expect(style.left + style.width).toBeLessThanOrEqual(390 - 16);
  });

  it("keeps the card on screen when the target sits under the status bar", () => {
    const cardHeight = 220;
    const style = tourTooltipCardStyle({
      placement: "top",
      cardHeight,
      insets: { top: 59, bottom: 34 },
      target: {
        top: 48,
        left: 16,
        width: 200,
        height: 40,
        bottom: 88,
      },
      viewport: { width: 390, height: 844 },
    });

    expect(style.top).toBeGreaterThanOrEqual(59);
    expect(style.top + cardHeight).toBeLessThanOrEqual(844 - 34);
    expect(style.left).toBeGreaterThanOrEqual(16);
    expect(style.left + style.width).toBeLessThanOrEqual(390 - 16);
  });
});

describe("tourTooltipPlacement", () => {
  it("points the Menu tip at the tab so the spotlight can highlight it", () => {
    expect(tourTooltipPlacement("mobile-menu-button", "top")).toBe("top");
    expect(tourTooltipPlacement("dashboard-tab", "top")).toBe("top");
    expect(tourTooltipPlacement("expense-tab", "bottom")).toBe("bottom");
  });
});

describe("shouldHideTourOverlay", () => {
  it("keeps the spotlight on so highlighted controls stay visible", () => {
    expect(shouldHideTourOverlay("mobile-menu-button")).toBe(false);
    expect(shouldHideTourOverlay("dashboard-tab")).toBe(false);
    expect(shouldHideTourOverlay("take-photo")).toBe(false);
  });
});

describe("isTourTargetVisible", () => {
  it("treats a painted target as visible even when offsetParent is null", () => {
    const element = document.createElement("a");
    element.setAttribute("data-tutorial-target", "loan-menu-item");
    document.body.appendChild(element);
    element.getBoundingClientRect = () =>
      ({
        width: 80,
        height: 80,
        top: 120,
        left: 40,
        right: 120,
        bottom: 200,
        x: 40,
        y: 120,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    expect(
      isTourTargetVisible('[data-tutorial-target="loan-menu-item"]'),
    ).toBe(true);

    element.remove();
  });

  it("treats a display-none target as hidden", () => {
    const element = document.createElement("a");
    element.setAttribute("data-tutorial-target", "loan-menu-item");
    element.style.display = "none";
    document.body.appendChild(element);

    expect(
      isTourTargetVisible('[data-tutorial-target="loan-menu-item"]'),
    ).toBe(false);

    element.remove();
  });
});

describe("tooltipButtonAtPoint", () => {
  it("finds Next when the tap lands on it even if another layer is the event target", () => {
    const tooltip = document.createElement("div");
    tooltip.setAttribute("data-testid", "tutorial-tooltip");
    const next = document.createElement("button");
    next.textContent = "Next";
    tooltip.appendChild(next);
    document.body.appendChild(tooltip);
    next.getBoundingClientRect = () =>
      ({
        left: 200,
        right: 280,
        top: 400,
        bottom: 444,
        width: 80,
        height: 44,
        x: 200,
        y: 400,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    const button = tooltipButtonAtPoint({ x: 220, y: 420 });
    const overlay = document.createElement("div");

    expect(button).toBe(next);
    expect(shouldForwardTooltipButtonTap(overlay, button)).toBe(true);
    expect(shouldForwardTooltipButtonTap(next, button)).toBe(false);

    tooltip.remove();
  });
});
