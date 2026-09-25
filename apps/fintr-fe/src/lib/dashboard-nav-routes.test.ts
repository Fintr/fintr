import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DASHBOARD_BOTTOM_NAV_ROUTES,
  DASHBOARD_OFFLINE_PREFETCH_ROUTES,
  commitDashboardClientNavigation,
  dashboardTabShouldSlide,
  getDashboardBottomTab,
  interceptDashboardTabClick,
  resetDashboardCommittedPathname,
  resolveDashboardClientNavigation,
  resolveDashboardClientRouteKey,
  resolveDashboardShellExitHref,
  resolveInternalDashboardHref,
  resolveVisibleDashboardBottomTab,
  toMobileBottomNavTab,
} from "./dashboard-nav-routes";

afterEach(() => {
  resetDashboardCommittedPathname();
});

describe("DASHBOARD_OFFLINE_PREFETCH_ROUTES", () => {
  it("includes bottom-nav tabs", () => {
    for (const route of DASHBOARD_BOTTOM_NAV_ROUTES) {
      expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(route);
    }
  });

  it("includes Menu destinations so they work after going offline from Home", () => {
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings/entities",
    );
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain("/dashboard/budgets");
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain("/dashboard/loans");
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings/categories",
    );
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings/accounts",
    );
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings/tags",
    );
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings",
    );
  });

  it("includes detail pages opened from lists while offline", () => {
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain("/dashboard/loans/detail");
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/transactions/detail",
    );
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings/accounts/detail",
    );
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings/entities/detail",
    );
    expect(DASHBOARD_OFFLINE_PREFETCH_ROUTES).toContain(
      "/dashboard/space_settings/categories/detail",
    );
  });
});

describe("getDashboardBottomTab", () => {
  it("maps the four bottom-nav destinations", () => {
    expect(getDashboardBottomTab("/dashboard/home")).toBe("home");
    expect(getDashboardBottomTab("/dashboard/")).toBe("transactions");
    expect(getDashboardBottomTab("/dashboard")).toBe("transactions");
    expect(getDashboardBottomTab("/dashboard/insights")).toBe("insights");
    expect(getDashboardBottomTab("/dashboard/app_settings")).toBe("menu");
  });

  it("does not treat nested dashboard routes as bottom-nav tabs", () => {
    expect(getDashboardBottomTab("/dashboard/transactions/detail")).toBeNull();
    expect(getDashboardBottomTab("/dashboard/recurring/detail")).toBeNull();
    expect(getDashboardBottomTab("/dashboard/space_settings/accounts")).toBeNull();
    expect(getDashboardBottomTab("/crm/requests")).toBeNull();
  });

  it("treats desktop index tabs as cached shell tabs", () => {
    expect(getDashboardBottomTab("/dashboard/space_settings")).toBe(
      "space_settings",
    );
    expect(getDashboardBottomTab("/dashboard/space_settings/")).toBe(
      "space_settings",
    );
    expect(getDashboardBottomTab("/dashboard/recurring")).toBe("recurring");
    expect(getDashboardBottomTab("/dashboard/recurring/")).toBe("recurring");
    expect(getDashboardBottomTab("/dashboard/budgets")).toBe("budgets");
    expect(getDashboardBottomTab("/dashboard/loans")).toBe("loans");
  });
});

describe("resolveVisibleDashboardBottomTab", () => {
  it("shows the pending tab immediately, before the route catches up", () => {
    expect(
      resolveVisibleDashboardBottomTab({
        pathname: "/dashboard/home",
        pendingTab: "insights",
      }),
    ).toBe("insights");
  });

  it("falls back to the route when nothing is pending", () => {
    expect(
      resolveVisibleDashboardBottomTab({
        pathname: "/dashboard/app_settings",
        pendingTab: null,
      }),
    ).toBe("menu");
  });

  it("ignores a leftover pending tab once the URL is a nested dashboard page", () => {
    expect(
      resolveVisibleDashboardBottomTab({
        pathname: "/dashboard/recurring/detail",
        pendingTab: "transactions",
      }),
    ).toBeNull();
  });

  it("shows Settings immediately from Home before the route updates", () => {
    expect(
      resolveVisibleDashboardBottomTab({
        pathname: "/dashboard/home",
        pendingTab: "space_settings",
      }),
    ).toBe("space_settings");
  });

  it("shows Recurring, Budgets, and Loans immediately from Home", () => {
    expect(
      resolveVisibleDashboardBottomTab({
        pathname: "/dashboard/home",
        pendingTab: "recurring",
      }),
    ).toBe("recurring");
    expect(
      resolveVisibleDashboardBottomTab({
        pathname: "/dashboard/home",
        pendingTab: "budgets",
      }),
    ).toBe("budgets");
    expect(
      resolveVisibleDashboardBottomTab({
        pathname: "/dashboard/home",
        pendingTab: "loans",
      }),
    ).toBe("loans");
  });
});

describe("interceptDashboardTabClick", () => {
  it("prevents a plain left click so the browser cannot full-reload", () => {
    const event = {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };

    expect(interceptDashboardTabClick(event)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
  });

  it("still handles a click after Next.js already preventDefaulted", () => {
    const event = {
      button: 0,
      defaultPrevented: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };

    expect(interceptDashboardTabClick(event)).toBe(true);
    expect(event.stopPropagation).toHaveBeenCalled();
  });

  it("leaves modified clicks to the browser", () => {
    const event = {
      button: 0,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
      preventDefault: vi.fn(),
    };

    expect(interceptDashboardTabClick(event)).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("resolveInternalDashboardHref", () => {
  const origin = "http://localhost:5173";

  it("keeps in-app dashboard paths including query strings", () => {
    expect(
      resolveInternalDashboardHref(
        "/dashboard/loans/detail?loanId=abc",
        origin,
      ),
    ).toBe("/dashboard/loans/detail?loanId=abc");
  });

  it("rejects external and non-dashboard links", () => {
    expect(
      resolveInternalDashboardHref("https://example.com/dashboard", origin),
    ).toBeNull();
    expect(resolveInternalDashboardHref("/auth", origin)).toBeNull();
    expect(resolveInternalDashboardHref("#section", origin)).toBeNull();
  });
});

describe("resolveDashboardShellExitHref", () => {
  const origin = "http://localhost:5173";

  it("takes Admin and Support out of the dashboard shell", () => {
    const adminEvent = {
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    const supportEvent = {
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    expect(
      resolveDashboardShellExitHref({
        href: "/admin",
        origin,
        event: adminEvent,
      }),
    ).toBe("/admin");
    expect(
      resolveDashboardShellExitHref({
        href: "/crm/requests",
        origin,
        event: supportEvent,
      }),
    ).toBe("/crm/requests");
    expect(adminEvent.preventDefault).toHaveBeenCalled();
    expect(supportEvent.preventDefault).toHaveBeenCalled();
  });

  it("leaves dashboard links to the client navigator", () => {
    const event = {
      button: 0,
      preventDefault: vi.fn(),
    };

    expect(
      resolveDashboardShellExitHref({
        href: "/dashboard/app_settings",
        origin,
        event,
      }),
    ).toBeNull();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("resolveDashboardClientNavigation", () => {
  const origin = "http://localhost:5173";

  it("intercepts a Home card click and maps it to the cached tab", () => {
    const event = {
      button: 0,
      preventDefault: vi.fn(),
    };

    expect(
      resolveDashboardClientNavigation({
        href: "/dashboard/loans",
        origin,
        event,
      }),
    ).toEqual({
      href: "/dashboard/loans",
      tab: "loans",
    });
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("opens checkout on the first click without waiting for the App Router", () => {
    const event = {
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };

    expect(
      resolveDashboardClientNavigation({
        href: "/dashboard/subscriptions/create",
        origin,
        event,
      }),
    ).toEqual({
      href: "/dashboard/subscriptions/create",
      tab: null,
    });
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("does not intercept new-tab or download clicks", () => {
    const event = {
      button: 0,
      preventDefault: vi.fn(),
    };

    expect(
      resolveDashboardClientNavigation({
        href: "/dashboard/loans",
        origin,
        target: "_blank",
        event,
      }),
    ).toBeNull();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

describe("dashboardTabShouldSlide", () => {
  it("keeps the existing push slide on Recurring and Loans tabs", () => {
    expect(dashboardTabShouldSlide("recurring")).toBe(true);
    expect(dashboardTabShouldSlide("loans")).toBe(true);
  });

  it("does not slide Home, Transactions, Dashboard, or Budgets", () => {
    expect(dashboardTabShouldSlide("home")).toBe(false);
    expect(dashboardTabShouldSlide("transactions")).toBe(false);
    expect(dashboardTabShouldSlide("insights")).toBe(false);
    expect(dashboardTabShouldSlide("budgets")).toBe(false);
    expect(dashboardTabShouldSlide("space_settings")).toBe(false);
    expect(dashboardTabShouldSlide("menu")).toBe(false);
  });
});

describe("toMobileBottomNavTab", () => {
  it("maps desktop cached tabs to the mobile Menu item", () => {
    expect(toMobileBottomNavTab("recurring")).toBe("menu");
    expect(toMobileBottomNavTab("budgets")).toBe("menu");
    expect(toMobileBottomNavTab("loans")).toBe("menu");
    expect(toMobileBottomNavTab("space_settings")).toBe("menu");
    expect(toMobileBottomNavTab("insights")).toBe("insights");
  });
});

describe("dashboard in-app navigation sources", () => {
  it("does not use router.push for dashboard destinations that the shell already renders", () => {
    const sources = [
      "src/components/dashboard/tabs/loans/loan-profiles-section.tsx",
      "src/components/dashboard/tabs/insights-tab.tsx",
      "src/components/dashboard/loan-detail-content.tsx",
      "src/components/dashboard/add-transaction-dialog.tsx",
      "src/components/dashboard/tabs/space-settings-tab.tsx",
      "src/components/dashboard/recurring/recurring-series-detail-content.tsx",
      "src/components/dashboard/category-detail-content.tsx",
      "src/components/dashboard/account-detail-content.tsx",
      "src/components/dashboard/transactions/tag-destination-dialog.tsx",
    ];

    for (const relativePath of sources) {
      const source = readFileSync(
        path.resolve(__dirname, "../", relativePath.replace("src/", "")),
        "utf8",
      );
      expect(source, relativePath).not.toMatch(/router\.push\(/);
    }
  });
});

describe("commitDashboardClientNavigation", () => {
  it("updates the URL with history.pushState so Next.js does not wait on RSC", () => {
    const pushState = vi.spyOn(window.history, "pushState");

    commitDashboardClientNavigation("/dashboard/budgets");

    expect(pushState).toHaveBeenCalledWith({}, "", "/dashboard/budgets");
    pushState.mockRestore();
  });

  it("is a no-op when the URL is already the destination", () => {
    window.history.replaceState({}, "", "/dashboard/budgets");
    const pushState = vi.spyOn(window.history, "pushState");

    commitDashboardClientNavigation("/dashboard/budgets");

    expect(pushState).not.toHaveBeenCalled();
    pushState.mockRestore();
  });
});

describe("resolveDashboardClientRouteKey", () => {
  it("maps nested dashboard pages that are not cached bottom tabs", () => {
    expect(resolveDashboardClientRouteKey("/dashboard/loans/detail")).toBe(
      "loan_detail",
    );
    expect(
      resolveDashboardClientRouteKey("/dashboard/transactions/detail"),
    ).toBe("transaction_detail");
    expect(resolveDashboardClientRouteKey("/dashboard/recurring/detail")).toBe(
      "recurring_detail",
    );
    expect(
      resolveDashboardClientRouteKey("/dashboard/space_settings/accounts"),
    ).toBe("accounts");
    expect(
      resolveDashboardClientRouteKey("/dashboard/space_settings/tags"),
    ).toBe("tags");
    expect(resolveDashboardClientRouteKey("/dashboard/settings")).toBe(
      "settings",
    );
  });

  it("does not map cached bottom-tab indexes", () => {
    expect(resolveDashboardClientRouteKey("/dashboard/budgets")).toBeNull();
    expect(resolveDashboardClientRouteKey("/dashboard/insights")).toBeNull();
    expect(resolveDashboardClientRouteKey("/dashboard")).toBeNull();
  });
});
