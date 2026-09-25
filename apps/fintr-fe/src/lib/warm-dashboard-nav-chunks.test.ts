import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const warmSource = readFileSync(
  path.resolve(__dirname, "./warm-dashboard-nav-chunks.ts"),
  "utf8",
);

const dashboardLayoutSource = readFileSync(
  path.resolve(
    __dirname,
    "../app/(private)/dashboard/layout.tsx",
  ),
  "utf8",
);

describe("dashboard layout tab switching", () => {
  it("keeps the existing push slide on cached Recurring and Loans tabs", () => {
    const cachedScreensSource = readFileSync(
      path.resolve(
        __dirname,
        "../components/dashboard/cached-bottom-nav-screens.tsx",
      ),
      "utf8",
    );

    expect(cachedScreensSource).toContain("DetailPushPanel");
    expect(cachedScreensSource).toContain("dashboardTabShouldSlide");
  });

  it("keeps bottom-nav screens mounted instead of waiting on route children", () => {
    expect(dashboardLayoutSource).toContain("CachedBottomNavScreens");
    expect(dashboardLayoutSource).toContain("resolveDashboardShellPresentation");
    expect(dashboardLayoutSource).toContain("showRouteChildren");
  });

  it("does not put cached tab screens inside the searchParams Suspense", () => {
    expect(dashboardLayoutSource).not.toMatch(
      /<Suspense fallback=\{null\}>[\s\S]*<CachedBottomNavScreens/,
    );
  });

  it("switches the cached Settings screen on pointer down like Dashboard", () => {
    expect(dashboardLayoutSource).toContain('href="/dashboard/space_settings"');
    expect(dashboardLayoutSource).toContain(
      'onPointerDown={() => setPendingTab("space_settings")}',
    );
  });

  it("prefetches Recurring series from IndexedDB while the dashboard is open", () => {
    expect(dashboardLayoutSource).toContain("prefetchRecurringSeries");
  });

  it("intercepts tab clicks so the browser cannot full-reload the app", () => {
    expect(dashboardLayoutSource).toContain("interceptDashboardTabClick");
    expect(dashboardLayoutSource).toContain("commitDashboardClientNavigation");
    expect(dashboardLayoutSource).not.toContain("router.push");
  });

  it("captures every in-app dashboard link click, not only the tab bar", () => {
    expect(dashboardLayoutSource).toContain("resolveDashboardClientNavigation");
    expect(dashboardLayoutSource).toContain("resolveDashboardShellExitHref");
    expect(dashboardLayoutSource).toContain("window.location.assign");
    expect(dashboardLayoutSource).toContain('addEventListener("click"');
    expect(dashboardLayoutSource).toContain("DashboardClientRoute");
  });

  it("switches cached Recurring, Budgets, and Loans on pointer down", () => {
    expect(dashboardLayoutSource).toContain(
      'onPointerDown={() => setPendingTab("recurring")}',
    );
    expect(dashboardLayoutSource).toContain(
      'onPointerDown={() => setPendingTab("budgets")}',
    );
    expect(dashboardLayoutSource).toContain(
      'onPointerDown={() => setPendingTab("loans")}',
    );
  });
});

describe("warmDashboardNavTabChunks", () => {
  it("warms chunks one at a time so opening the dashboard does not import every page at once", () => {
    expect(warmSource).not.toContain("Promise.allSettled");
    expect(warmSource).toContain("requestIdleCallback");
  });

  it("warms Menu page modules including entities", () => {
    expect(warmSource).toContain("space_settings/page");
    expect(warmSource).toContain("space_settings/entities/page");
    expect(warmSource).toContain("space_settings/accounts/page");
    expect(warmSource).toContain("dashboard/budgets/page");
    expect(warmSource).toContain("dashboard/loans/page");
    expect(warmSource).toContain("dashboard/recurring/page");
    expect(warmSource).toContain("dashboard/loans/detail/page");
    expect(warmSource).toContain("dashboard/transactions/detail/page");
  });

  it("statically imports dashboard chrome so opening offline does not fetch extra chunks", () => {
    expect(dashboardLayoutSource).not.toMatch(
      /dynamic\(\s*\(\) => import\("@\/components\/dashboard\/mobile-sticky-header"/,
    );
    expect(dashboardLayoutSource).not.toMatch(
      /dynamic\(\s*\(\) => import\("@\/components\/dashboard\/bottom-navigation"/,
    );
    expect(dashboardLayoutSource).toContain(
      'import MobileStickyHeader from "@/components/dashboard/mobile-sticky-header"',
    );
    expect(dashboardLayoutSource).toContain(
      'import BottomNavigation from "@/components/dashboard/bottom-navigation"',
    );
  });
});
