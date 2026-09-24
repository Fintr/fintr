import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const proAccess = vi.hoisted(() => ({
  source: "trial" as "trial" | "none" | "revenuecat",
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: proAccess.source !== "none",
      source: proAccess.source,
      trialDaysRemaining: proAccess.source === "trial" ? 5 : 0,
    },
    isPending: false,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/",
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: vi.fn(),
    user: { name: "Ada" },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ spaces: [] }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/components/dashboard/add-transaction-dialog", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/add-receipt-dialog", () => ({
  default: () => null,
}));

vi.mock("@/components/ai-chat/enhanced-ai-chat-modal", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/nav-drawer", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/notifications-popup", () => ({
  default: () => null,
}));

describe("DashboardNavigation — trial Pro badges", () => {
  beforeEach(() => {
    proAccess.source = "trial";
  });

  it("badges AI Chat and Add Receipt during a trial", async () => {
    const DashboardNavigation = (await import("./dashboard-navigation")).default;
    render(<DashboardNavigation />);

    expect(
      within(screen.getByRole("button", { name: /AI Chat/ })).getByText("Pro"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /Add Receipt/ })).getByText(
        "Pro",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("button", { name: /Add Transaction/ }),
      ).queryByText("Pro"),
    ).not.toBeInTheDocument();
  });

  it("hides those badges for a paid Pro subscription", async () => {
    proAccess.source = "revenuecat";
    const DashboardNavigation = (await import("./dashboard-navigation")).default;
    render(<DashboardNavigation />);

    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });
});
