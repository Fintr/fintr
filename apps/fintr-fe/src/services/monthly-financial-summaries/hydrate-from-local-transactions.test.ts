import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db/db";
import { putSpaceTransactions } from "@/lib/local-db/transactions";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  hydrateMonthlyFinancialSummariesFromLocalTransactions,
  isMonthlySummaryTotalsEmpty,
  summariesNeedLocalHydration,
} from "./hydrate-from-local-transactions";
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
  totalIncome: 0,
  totalExpenses: 0,
  netSavings: 0,
  savingsPercentage: 0,
  monthStartDate: "2026-07-01",
  monthEndDate: "2026-07-31",
  ...overrides,
});

describe("hydrate-from-local-transactions", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("detects missing month buckets when transactions exist locally", async () => {
    const tx: IndexTransaction = {
      id: "tx-dec",
      date: "2025-12-15",
      description: "Food",
      amount: 250,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    expect(
      await summariesNeedLocalHydration("space-a", [], [tx]),
    ).toBe(true);
  });

  it("detects empty buckets that need hydration when txs exist locally", async () => {
    const tx: IndexTransaction = {
      id: "tx-1",
      date: "2026-07-15",
      description: "Food",
      amount: 250,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    await putSpaceTransactions("fintr", [tx]);

    expect(
      await summariesNeedLocalHydration("fintr", [bucket()]),
    ).toBe(true);
    expect(isMonthlySummaryTotalsEmpty(bucket())).toBe(true);
  });

  it("hydrates zero buckets from indexed transactions", async () => {
    await putSpaceTransactions("fintr", [
      {
        id: "tx-in",
        date: "2026-07-10",
        description: "Salary",
        amount: 1000,
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "tx-out",
        date: "2026-07-20",
        description: "Food",
        amount: 200,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    ]);

    const hydrated = await hydrateMonthlyFinancialSummariesFromLocalTransactions(
      "fintr",
      {
        currency: "PHP",
        existingSummaries: [bucket()],
      },
    );

    const july = hydrated.find((row) => row.month === 7);
    expect(july).toMatchObject({
      totalIncome: 1000,
      totalExpenses: 200,
      netSavings: 800,
      fxBased: true,
    });
  });
});
