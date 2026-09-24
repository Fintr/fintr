import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

const proAccess = vi.hoisted(() => ({
  source: "trial" as "trial" | "revenuecat",
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: true,
      source: proAccess.source,
      trialDaysRemaining: proAccess.source === "trial" ? 6 : 0,
    },
    isPending: false,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Ada" } }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("@/hooks/usePlatformDetection", () => ({
  usePlatformDetection: () => ({
    isAndroidNative: false,
    isIOSNative: false,
    safeAreaInsetBottom: 0,
    hasAndroid3ButtonNav: false,
  }),
}));

vi.mock("@/hooks/async/useAccounts", () => ({
  useAccounts: () => ({
    accounts: [],
    balanceTotals: { total: 1200, currency: "PHP" },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/async/useTransactionTags", () => ({
  useTransactionTags: () => ({ defaultTag: null }),
}));

vi.mock("@/hooks/usePrefetchAccountDetailRoutes", () => ({
  usePrefetchAccountDetailRoutes: () => undefined,
}));

vi.mock("@/lib/document-screen-class", () => ({
  syncDocumentScreenClass: () => () => undefined,
}));

vi.mock("@/components/dashboard/add-transaction-dialog", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/add-receipt-dialog", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/tabs/home/home-recent-transactions", () => ({
  HomeRecentTransactions: () => null,
}));

vi.mock("@/components/dashboard/tabs/home/home-loans-section", () => ({
  HomeLoansSection: () => null,
}));

vi.mock("@/components/dashboard/tabs/home/home-exchange-rates-section", () => ({
  HomeExchangeRatesSection: () => null,
}));

vi.mock("@/components/dashboard/tags-travel-hint-pill", () => ({
  TagsTravelHintPill: () => null,
}));

describe("HomeTab — trial Pro badges", () => {
  beforeEach(() => {
    proAccess.source = "trial";
  });

  it("badges Scan Receipt and leaves the Dashboard link free during a trial", async () => {
    const HomeTab = (await import("./index")).default;
    render(<HomeTab />);

    expect(
      within(screen.getByRole("link", { name: /on Dashboard/ })).queryByText(
        "Pro",
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /Scan Receipt/ })).getByText(
        "Pro",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: "Transfer" })).queryByText(
        "Pro",
      ),
    ).not.toBeInTheDocument();
  });

  it("hides those badges for a paid Pro subscription", async () => {
    proAccess.source = "revenuecat";
    const HomeTab = (await import("./index")).default;
    render(<HomeTab />);

    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });
});
