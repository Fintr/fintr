import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import InsightsTab from "./insights-tab";

const proAccess = vi.hoisted(() => ({
  pro: false,
  source: "none" as "trial" | "none" | "subscription",
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: proAccess.pro,
      source: proAccess.source,
      trialDaysRemaining: proAccess.source === "trial" ? 4 : 0,
    },
    isPending: false,
    isPaused: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/insights",
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  default: () => ({ api: {}, isAuthenticated: true }),
  useAuthApi: () => ({ api: {}, isAuthenticated: true }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({
    currentSpace: { currency: "PHP", isOrganization: false },
  }),
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: [],
    incomeCategoryOptions: [],
  }),
}));

vi.mock("@/hooks/async/useTransactionTags", () => ({
  useTransactionTags: () => ({ tags: [] }),
}));

vi.mock("@/hooks/async/useEntities", () => ({
  useEntities: () => ({ entities: [] }),
}));

vi.mock("@/hooks/usePresetDateRangeOptions", () => ({
  usePresetDateRangeOptions: () => ({
    earliestTransactionDate: null,
    spaceCreatedAt: null,
    isAllTimeAnchorReady: true,
  }),
}));

vi.mock("@/lib/insights/warm-insight-profile-images", () => ({
  warmInsightProfileImages: vi.fn(),
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {},
}));

vi.mock("@gsap/react", () => ({
  useGSAP: vi.fn(),
}));

vi.mock("@/hooks/async/useInsightsQueries", () => ({
  useInsightsQueries: () => ({
    summary: {
      totalIncome: 10000,
      totalExpenses: 4000,
      netSavings: 6000,
    },
    narratives: {
      headline: { text: "A steady month", sentiment: "neutral" },
      metrics: [
        {
          key: "savings_rate",
          label: "Savings rate",
          value: "20%",
          benchmark: "20%",
          trend: "savings",
        },
      ],
      insights: [
        {
          type: "savings",
          severity: "positive",
          title: "Strong Saver",
          body: "You kept a healthy share of income.",
          actionLabel: "View transactions",
          actionHref: "/dashboard",
        },
      ],
      dataQuality: {
        transactionCount: 4,
        categorizedPercent: "100%",
        completenessTier: "complete",
      },
    },
    healthScores: {
      score: 82,
      rating: "Good",
      description: "You're on track",
      savingsPercentage: { percentage: "20%", score: 8 },
      budgetUsage: { percentage: "40%", score: 7 },
      debtToIncomeRatio: { percentage: "10%", score: 9, monthlyDebt: "0" },
    },
    expenseBreakdown: [
      { name: "Food", value: 4000, percentage: "100%" },
    ],
    merchantBreakdown: [],
    subcategoryBreakdown: [],
    monthlySpending: [
      { month: "Sep", income: 10000, expenses: -4000, savings: 6000 },
    ],
    weeklySpending: [{ day: "Mon", amount: 500 }],
    isLoading: false,
    isNarrativesLoading: false,
    isError: false,
    isChartsLoading: false,
    refetch: vi.fn(),
  }),
}));

describe("InsightsTab pro access", () => {
  beforeEach(() => {
    proAccess.pro = false;
    proAccess.source = "none";
    class MockObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", MockObserver);
    vi.stubGlobal("ResizeObserver", MockObserver);
  });

  it("keeps income, key metrics, and financial trends available without Pro", () => {
    render(<InsightsTab />);

    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expense")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key metrics" })).toBeInTheDocument();
    expect(screen.getByText("Savings rate")).toBeInTheDocument();
    expect(screen.getByText("Financial Trends")).toBeInTheDocument();
    expect(
      screen.queryByText("Fintr Pro is required for Dashboard Insights"),
    ).not.toBeInTheDocument();
  });

  it("locks Insights, Financial Health Score, Expense Breakdown, and Weekly Spending", () => {
    render(<InsightsTab />);

    expect(screen.getByText("Fintr Pro is required for Insights")).toBeInTheDocument();
    expect(
      screen.getByText("Fintr Pro is required for Financial Health Score"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fintr Pro is required for Expense Breakdown"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Fintr Pro is required for Weekly Spending"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Strong Saver")).not.toBeInTheDocument();
    expect(screen.queryByText("You're on track")).not.toBeInTheDocument();
  });

  it("badges the pro sections during a trial and still shows them", () => {
    proAccess.pro = true;
    proAccess.source = "trial";

    render(<InsightsTab />);

    expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText("Strong Saver")).toBeInTheDocument();
    expect(screen.getByText("You're on track")).toBeInTheDocument();
    expect(screen.getByText("Savings rate")).toBeInTheDocument();
    expect(
      screen.queryByText("Fintr Pro is required for Insights"),
    ).not.toBeInTheDocument();
  });
});
