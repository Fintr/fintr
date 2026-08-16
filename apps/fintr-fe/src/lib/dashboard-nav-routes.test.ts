import { describe, expect, it } from "vitest";

import {
  DASHBOARD_BOTTOM_NAV_ROUTES,
  DASHBOARD_OFFLINE_PREFETCH_ROUTES,
} from "./dashboard-nav-routes";

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
