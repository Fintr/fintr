import { describe, expect, it } from "vitest";

import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { upsertLiveCurrentMonthSummary } from "./live-current-month-summary";
import type { MonthlyFinancialSummary } from "./types";

const bucket = (
  overrides: Partial<MonthlyFinancialSummary>,
): MonthlyFinancialSummary => ({
  id: "1",
  year: 2026,
  month: 7,
  currency: "PHP",
  fxBased: true,
  calculatedAt: "2026-07-31T00:00:00.000Z",
  totalIncome: 100,
  totalExpenses: 40,
  netSavings: 60,
  savingsPercentage: 60,
  monthStartDate: "2026-07-01",
  monthEndDate: "2026-07-31",
  ...overrides,
});

const tx = (
  overrides: Partial<IndexTransaction>,
): IndexTransaction => ({
  id: "1",
  date: "2026-08-05",
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

describe("upsertLiveCurrentMonthSummary", () => {
  it("synthesizes the current month bucket from calculated transactions", () => {
    const summaries = [
      bucket({ month: 7 }),
      bucket({
        id: "aug-stale",
        month: 8,
        totalIncome: 1,
        totalExpenses: 1,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      }),
    ];

    const next = upsertLiveCurrentMonthSummary({
      summaries,
      transactions: [
        tx({
          id: "in-1",
          amount: 500,
          type: CombinedTransactionTypeEnum.INCOME,
        }),
        tx({ id: "out-1", amount: 120 }),
      ],
      currency: "PHP",
      today: "2026-08-12",
    });

    const august = next.find((row) => row.month === 8);
    expect(august).toMatchObject({
      year: 2026,
      month: 8,
      fxBased: true,
      totalIncome: 500,
      totalExpenses: 120,
      netSavings: 380,
    });
    expect(next.find((row) => row.month === 7)?.totalIncome).toBe(100);
  });

  it("keeps a non-empty current-month bucket when live transactions are empty", () => {
    const summaries = [
      bucket({
        id: "aug-stale",
        month: 8,
        totalIncome: 900,
        totalExpenses: 400,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      }),
    ];

    const next = upsertLiveCurrentMonthSummary({
      summaries,
      transactions: [],
      currency: "PHP",
      today: "2026-08-12",
    });

    expect(next).toEqual(summaries);
  });
});
