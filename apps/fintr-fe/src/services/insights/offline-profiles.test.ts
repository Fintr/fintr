import { describe, expect, it } from "vitest";
import {
  buildOfflineProfileCards,
  profileHeadline,
} from "./offline-profiles";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

describe("buildOfflineProfileCards", () => {
  it("returns no profiles when completeness is sparse", () => {
    const cards = buildOfflineProfileCards({
      income: 10_000,
      expenses: 7_000,
      net: 3_000,
      priorIncome: 5_000,
      savingsRate: 30,
      monthlyDebt: 0,
      periodDays: 31,
      totalBudget: 0,
      budgetUsagePercent: null,
      transactions: [],
      investmentAccountNames: new Set(),
      currency: "PHP",
      isBusiness: false,
      completenessTier: "sparse",
    });

    expect(cards).toEqual([]);
  });

  it("returns Strong Saver and Avid Spender when both qualify", () => {
    const cards = buildOfflineProfileCards({
      income: 10_000,
      expenses: 7_000,
      net: 3_000,
      priorIncome: 10_000,
      savingsRate: 30,
      monthlyDebt: 0,
      periodDays: 31,
      totalBudget: 0,
      budgetUsagePercent: null,
      transactions: [],
      investmentAccountNames: new Set(),
      currency: "PHP",
      isBusiness: false,
      completenessTier: "complete",
    });

    expect(cards.map((card) => card.profileKey)).toEqual([
      "strong_saver",
      "avid_spender",
    ]);
    expect(cards[0].imageKey).toBe("strong_saver");
  });

  it("returns Steady Investor for investment category expenses", () => {
    const cards = buildOfflineProfileCards({
      income: 10_000,
      expenses: 2_000,
      net: 8_000,
      priorIncome: 10_000,
      savingsRate: 80,
      monthlyDebt: 0,
      periodDays: 31,
      totalBudget: 0,
      budgetUsagePercent: null,
      transactions: [
        {
          id: "1",
          date: "2024-01-10",
          description: "ETF buy",
          amount: 2000,
          categoryName: "Stocks & ETF",
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
        },
      ],
      investmentAccountNames: new Set(),
      currency: "PHP",
      isBusiness: false,
      completenessTier: "complete",
    });

    expect(cards.map((card) => card.profileKey)).toContain("steady_investor");
  });
});

describe("profileHeadline", () => {
  it("celebrates the strongest profile title", () => {
    expect(
      profileHeadline({
        title: "Strong Saver",
        net: 3000,
        income: 10_000,
        currency: "PHP",
        isBusiness: false,
      }),
    ).toContain("Strong Saver");
  });
});
