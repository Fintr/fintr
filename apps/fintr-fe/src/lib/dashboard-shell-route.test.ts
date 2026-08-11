import { describe, it, expect } from "vitest";
import {
  hasEmbeddedHeroHeader,
  isDashboardShellRoute,
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
