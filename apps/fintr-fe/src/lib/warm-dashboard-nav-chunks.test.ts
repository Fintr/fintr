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

describe("warmDashboardNavTabChunks", () => {
  it("warms Menu page modules including entities", () => {
    expect(warmSource).toContain("space_settings/entities/page");
    expect(warmSource).toContain("space_settings/accounts/page");
    expect(warmSource).toContain("dashboard/budgets/page");
    expect(warmSource).toContain("dashboard/loans/page");
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
