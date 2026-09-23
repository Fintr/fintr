import { describe, it, expect } from "vitest";
import {
  hasEmbeddedHeroHeader,
  isDashboardDataLightRoute,
  isDashboardShellRoute,
  resolveDashboardShellPresentation,
} from "./dashboard-shell-route";

describe("isDashboardShellRoute", () => {
  it("returns true for dashboard home and nested dashboard routes", () => {
    expect(isDashboardShellRoute("/dashboard")).toBe(true);
    expect(isDashboardShellRoute("/dashboard/")).toBe(true);
    expect(isDashboardShellRoute("/dashboard/budgets")).toBe(true);
    expect(isDashboardShellRoute("/dashboard/insights")).toBe(true);
  });

  it("returns false for standalone subscription create (no dashboard shell)", () => {
    expect(isDashboardShellRoute("/dashboard/subscriptions/create")).toBe(false);
    expect(isDashboardShellRoute("/dashboard/subscriptions/create/step")).toBe(false);
  });

  it("returns false for non-dashboard private routes", () => {
    expect(isDashboardShellRoute("/crm/requests")).toBe(false);
    expect(isDashboardShellRoute("/crm/requests/ticket")).toBe(false);
    expect(isDashboardShellRoute("/admin/users")).toBe(false);
    expect(isDashboardShellRoute("/onboarding")).toBe(false);
  });
});

describe("hasEmbeddedHeroHeader", () => {
  it("returns true for home and insights dashboard routes", () => {
    expect(hasEmbeddedHeroHeader("/dashboard/home")).toBe(true);
    expect(hasEmbeddedHeroHeader("/dashboard/insights")).toBe(true);
  });

  it("returns false for other dashboard routes", () => {
    expect(hasEmbeddedHeroHeader("/dashboard")).toBe(false);
    expect(hasEmbeddedHeroHeader("/dashboard/budgets")).toBe(false);
    expect(hasEmbeddedHeroHeader("/dashboard/loans")).toBe(false);
  });
});

describe("isDashboardDataLightRoute", () => {
  it("returns true for insights and settings routes", () => {
    expect(isDashboardDataLightRoute("/dashboard/insights")).toBe(true);
    expect(isDashboardDataLightRoute("/dashboard/space_settings")).toBe(true);
    expect(isDashboardDataLightRoute("/dashboard/app_settings")).toBe(true);
  });

  it("returns false for transactions and budgets", () => {
    expect(isDashboardDataLightRoute("/dashboard")).toBe(false);
    expect(isDashboardDataLightRoute("/dashboard/budgets")).toBe(false);
    expect(isDashboardDataLightRoute("/dashboard/loans")).toBe(false);
  });
});

describe("resolveDashboardShellPresentation", () => {
  it("keeps the tapped bottom tab visible before the pathname updates", () => {
    const presentation = resolveDashboardShellPresentation({
      pathname: "/dashboard/home",
      pendingTab: "insights",
    });

    expect(presentation.visibleTab).toBe("insights");
    expect(presentation.showRouteChildren).toBe(false);
    expect(presentation.usesEmbeddedHeroHeader).toBe(true);
    expect(presentation.isLightDashboardRoute).toBe(true);
  });

  it("renders route children for nested dashboard pages", () => {
    const presentation = resolveDashboardShellPresentation({
      pathname: "/dashboard/space_settings/accounts",
      pendingTab: null,
    });

    expect(presentation.visibleTab).toBeNull();
    expect(presentation.showRouteChildren).toBe(true);
    expect(presentation.usesEmbeddedHeroHeader).toBe(false);
  });

  it("does not keep a pending bottom tab over nested detail pages", () => {
    const presentation = resolveDashboardShellPresentation({
      pathname: "/dashboard/recurring/detail",
      pendingTab: "transactions",
    });

    expect(presentation.visibleTab).toBeNull();
    expect(presentation.showRouteChildren).toBe(true);
  });

  it("shows the cached Settings screen from Home before the route updates", () => {
    const presentation = resolveDashboardShellPresentation({
      pathname: "/dashboard/home",
      pendingTab: "space_settings",
    });

    expect(presentation.visibleTab).toBe("space_settings");
    expect(presentation.showRouteChildren).toBe(false);
    expect(presentation.usesEmbeddedHeroHeader).toBe(false);
    expect(presentation.isLightDashboardRoute).toBe(true);
  });

  it("shows cached Recurring from Home before the route updates", () => {
    const presentation = resolveDashboardShellPresentation({
      pathname: "/dashboard/home",
      pendingTab: "recurring",
    });

    expect(presentation.visibleTab).toBe("recurring");
    expect(presentation.showRouteChildren).toBe(false);
    expect(presentation.usesEmbeddedHeroHeader).toBe(false);
  });
});
