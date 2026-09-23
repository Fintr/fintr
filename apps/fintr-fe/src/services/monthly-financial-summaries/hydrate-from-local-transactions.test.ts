import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import * as transactionLocalCache from "@/services/transactions/local-cache";

import { resetLocalDbForTests } from "@/lib/local-db/db";
import { putSpaceTransactions } from "@/lib/local-db/transactions";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  cacheMonthlyFinancialSummaries,
  resolveMonthlySummariesForInsights,
} from "./local-cache";
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
    vi.restoreAllMocks();
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

  it("detects stale non-empty buckets that disagree with local transactions", async () => {
    const tx: IndexTransaction = {
      id: "tx-aug-expense",
      date: "2026-08-12",
      description: "Food",
      amount: 1_630_920.05,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    expect(
      await summariesNeedLocalHydration(
        "space-a",
        [
          bucket({
            year: 2026,
            month: 8,
            totalIncome: 1_641_483.57,
            totalExpenses: 2_189_334.81,
            netSavings: -547_851.24,
            monthStartDate: "2026-08-01",
            monthEndDate: "2026-08-31",
          }),
        ],
        [
          {
            ...tx,
            id: "tx-aug-income",
            description: "Salary",
            amount: 1_641_483.57,
            type: CombinedTransactionTypeEnum.INCOME,
            fromAccountName: "",
            toAccountName: "Cash",
          },
          tx,
        ],
      ),
    ).toBe(true);
  });

  it("overwrites stale backend buckets with indexed transaction totals", async () => {
    await putSpaceTransactions("fintr", [
      {
        id: "tx-in",
        date: "2026-08-05",
        description: "Salary",
        amount: 1_641_483.57,
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "tx-out",
        date: "2026-08-12",
        description: "Food",
        amount: 1_630_920.05,
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
        existingSummaries: [
          bucket({
            year: 2026,
            month: 8,
            totalIncome: 1_641_483.57,
            totalExpenses: 2_189_334.81,
            netSavings: -547_851.24,
            monthStartDate: "2026-08-01",
            monthEndDate: "2026-08-31",
          }),
        ],
      },
    );

    const august = hydrated.find((row) => row.year === 2026 && row.month === 8);
    expect(august).toMatchObject({
      totalIncome: 1_641_483.57,
      totalExpenses: 1_630_920.05,
      netSavings: 10_563.52,
    });
  });

  it("resolves insights buckets from IndexedDB transactions instead of stale cache", async () => {
    await putSpaceTransactions("fintr", [
      {
        id: "tx-in",
        date: "2026-08-05",
        description: "Salary",
        amount: 1_641_483.57,
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "tx-out",
        date: "2026-08-12",
        description: "Food",
        amount: 1_630_920.05,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    ]);
    await cacheMonthlyFinancialSummaries("fintr", [
      bucket({
        year: 2026,
        month: 8,
        totalIncome: 1_641_483.57,
        totalExpenses: 2_189_334.81,
        netSavings: -547_851.24,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      }),
    ]);

    const resolved = await resolveMonthlySummariesForInsights("fintr");
    const august = resolved.summaries.find(
      (row) => row.year === 2026 && row.month === 8,
    );

    expect(august).toMatchObject({
      totalIncome: 1_641_483.57,
      totalExpenses: 1_630_920.05,
      netSavings: 10_563.52,
    });
  });

  it("returns cached buckets without scanning transactions when hydration is deferred", async () => {
    await cacheMonthlyFinancialSummaries("fintr", [
      bucket({
        year: 2026,
        month: 8,
        totalIncome: 1_641_483.57,
        totalExpenses: 1_630_920.05,
        netSavings: 10_563.52,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      }),
    ]);

    vi.spyOn(
      transactionLocalCache,
      "loadAllTransactionsFromLocalIndex",
    ).mockImplementation(() => new Promise(() => {}));

    await expect(
      resolveMonthlySummariesForInsights("fintr", {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        skipTransactionHydration: true,
      }),
    ).resolves.toMatchObject({
      summaries: [
        expect.objectContaining({
          year: 2026,
          month: 8,
          totalIncome: 1_641_483.57,
        }),
      ],
    });
  });

  it("skips transaction hydration when selected buckets already have signal", async () => {
    await putSpaceTransactions("fintr", [
      {
        id: "tx-out",
        date: "2026-08-12",
        description: "Food",
        amount: 9_999_999,
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
    ]);
    await cacheMonthlyFinancialSummaries("fintr", [
      bucket({
        year: 2026,
        month: 8,
        totalIncome: 1_641_483.57,
        totalExpenses: 1_630_920.05,
        netSavings: 10_563.52,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      }),
    ]);

    const resolved = await resolveMonthlySummariesForInsights("fintr", {
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      skipHydrationWhenBucketsHaveSignal: true,
    });
    const august = resolved.summaries.find(
      (row) => row.year === 2026 && row.month === 8,
    );

    expect(august).toMatchObject({
      totalIncome: 1_641_483.57,
      totalExpenses: 1_630_920.05,
      netSavings: 10_563.52,
    });
  });

  it("keeps IndexedDB PHP list amounts in buckets when booked FX cannot convert", async () => {
    await putSpaceTransactions("fintr", [
      {
        id: "tx-in",
        date: "2026-08-05",
        description: "Salary",
        amount: 1_641_483.57,
        amountCurrency: "PHP",
        categoryName: "Salary",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.INCOME,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "tx-php-expense",
        date: "2026-08-12",
        description: "Food",
        amount: 1_625_949.65,
        amountCurrency: "PHP",
        categoryName: "Food",
        fromAccountName: "Cash",
        toAccountName: "",
        type: CombinedTransactionTypeEnum.EXPENSE,
        inSeries: false,
        hasImage: false,
      },
      {
        id: "tx-fx-expense",
        date: "2026-08-12",
        description: "Travel",
        amount: 4_970.4,
        amountCurrency: "PHP",
        bookedAmount: 88,
        bookedAmountCurrency: "USD",
        categoryName: "Travel",
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
        existingSummaries: [
          bucket({
            year: 2026,
            month: 8,
            totalIncome: 1_641_483.57,
            totalExpenses: 1_625_949.65,
            netSavings: 15_533.92,
            monthStartDate: "2026-08-01",
            monthEndDate: "2026-08-31",
          }),
        ],
      },
    );

    const august = hydrated.find((row) => row.year === 2026 && row.month === 8);
    expect(august).toMatchObject({
      totalIncome: 1_641_483.57,
      totalExpenses: 1_630_920.05,
      netSavings: 10_563.52,
    });
  });

  it("does not show another space's insight totals when this space has no summaries", async () => {
    await cacheMonthlyFinancialSummaries("miko-shared-space", [
      bucket({
        year: 2026,
        month: 9,
        totalExpenses: 692_823,
        netSavings: -692_823,
        monthStartDate: "2026-09-01",
        monthEndDate: "2026-09-30",
      }),
    ]);

    await expect(
      resolveMonthlySummariesForInsights("miguel-personal-space"),
    ).resolves.toEqual({
      spaceCode: "miguel-personal-space",
      summaries: [],
    });
  });
});
