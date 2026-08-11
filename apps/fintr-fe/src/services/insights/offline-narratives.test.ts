import { beforeEach, describe, expect, it, vi } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

vi.mock("@/services/transactions/local-cache", () => ({
  loadCachedTransactionsInRange: vi.fn(),
}));

vi.mock("@/services/monthly-financial-summaries/local-cache", () => ({
  loadCachedMonthlyFinancialSummaries: vi.fn(),
}));

vi.mock("@/services/transactions/accounts/local-cache", () => ({
  loadCachedAccountsResponse: vi.fn(),
}));

vi.mock("@/services/loans/local-cache", () => ({
  loadCachedLoansInfiniteData: vi.fn(),
}));

vi.mock("@/services/insights/offline-calculations", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/insights/offline-calculations")
  >("@/services/insights/offline-calculations");
  return {
    ...actual,
    loadLocalBudgetsForRange: vi.fn(),
  };
});

import { loadCachedAccountsResponse } from "@/services/transactions/accounts/local-cache";
import { loadLocalBudgetsForRange } from "@/services/insights/offline-calculations";
import { loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import { loadCachedMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";

import { buildOfflineNarratives } from "./offline-narratives";

const tx = (
  overrides: Partial<IndexTransaction>,
): IndexTransaction => ({
  id: "1",
  date: "2026-08-01",
  description: "",
  amount: 100,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("buildOfflineNarratives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCachedMonthlyFinancialSummaries).mockResolvedValue([]);
    vi.mocked(loadLocalBudgetsForRange).mockResolvedValue([]);
    vi.mocked(loadCachedLoansInfiniteData).mockResolvedValue({
      pages: [{ loans: [] }],
      pageParams: [],
    } as never);
    vi.mocked(loadCachedAccountsResponse).mockResolvedValue({
      data: {
        balanceTotals: {
          cashTotal: 3000,
        },
      },
    });
  });

  it("builds a headline, savings metric, and savings insight card", async () => {
    vi.mocked(loadCachedTransactionsInRange).mockImplementation(
      async (_space, start, end) => {
        if (start === "2026-08-01" && end === "2026-08-31") {
          return [
            tx({
              id: "i1",
              type: CombinedTransactionTypeEnum.INCOME,
              amount: 1000,
              categoryName: "Salary",
            }),
            tx({
              id: "e1",
              type: CombinedTransactionTypeEnum.EXPENSE,
              amount: 600,
              categoryName: "Food",
            }),
          ];
        }
        // Prior period expenses match current so no category spike card wins sorting.
        // Lookback still needs expenses for emergency-fund math.
        return [
          tx({
            id: "lookback",
            type: CombinedTransactionTypeEnum.EXPENSE,
            amount: 600,
            date: start,
            categoryName: "Food",
          }),
        ];
      },
    );

    const narratives = await buildOfflineNarratives({
      spaceCode: "space-1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      summary: {
        totalIncome: 1000,
        totalExpenses: 600,
        netSavings: 400,
      },
      currency: "PHP",
      isBusiness: false,
    });

    expect(narratives.headline.text).toContain("400.00");
    expect(narratives.headline.sentiment).toBe("positive");
    expect(narratives.metrics.some((metric) => metric.key === "savings_rate")).toBe(
      true,
    );
    expect(
      narratives.metrics.find((metric) => metric.key === "savings_rate")?.value,
    ).toBe("40.00%");
    expect(narratives.insights.length).toBeGreaterThan(0);
    expect(narratives.insights[0]?.type).toBe("savings");
    expect(narratives.dataQuality.transactionCount).toBe(2);
  });
});
