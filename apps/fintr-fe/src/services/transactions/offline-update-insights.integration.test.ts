import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { resetLocalDbForTests } from "@/lib/local-db";
import { buildOfflineInsightsBundle } from "@/services/insights/offline-calculations";
import {
  buildDashboardDataFromBuckets,
  cacheMonthlyFinancialSummaries,
  loadCachedMonthlyFinancialSummaries,
  type DashboardShell,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

vi.mock("./mutation", () => ({
  updateTransaction: vi.fn(),
}));

import { updateTransaction } from "./mutation";
import { updateTransactionLocalFirst } from "./update-local-first";

const SPACE = "space-offline";
const TAG_JAPAN = "tag-japan-2026";
const CATEGORY_DINE = {
  id: "cat-dine-out",
  name: "Dine Out & Entertainment",
};

const shell: DashboardShell = {
  id: "dash-1",
  categoryOptions: [],
  accountOptions: [],
  expenseCategoryOptions: [
    {
      id: CATEGORY_DINE.id,
      name: CATEGORY_DINE.name,
      categoryType: "expense",
      parentId: null,
      icon: null,
      color: null,
      children: [],
    },
  ],
  incomeCategoryOptions: [],
  goalDescription: "",
};

const seedIncome = async (amount: number): Promise<IndexTransaction> => {
  const row: IndexTransaction = {
    id: "tx-income-1",
    date: "2026-08-11",
    description: "Loan repayment Cash",
    amount,
    amountCurrency: "PHP",
    categoryName: "Freelance",
    fromAccountName: "",
    toAccountName: "Cash",
    type: CombinedTransactionTypeEnum.INCOME,
    inSeries: false,
    hasImage: false,
    tagIds: [TAG_JAPAN],
    tags: [{ id: TAG_JAPAN, name: "Japan 2026", color: "#f472b6" }],
  };
  await upsertLocalIndexTransaction(SPACE, row);
  return row;
};

const seedDineExpense = async (): Promise<IndexTransaction> => {
  const row: IndexTransaction = {
    id: "tx-dine-1",
    date: "2026-08-11",
    description: "Coffee",
    amount: 41037.1,
    amountCurrency: "PHP",
    categoryName: CATEGORY_DINE.name,
    categoryId: CATEGORY_DINE.id,
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: false,
    hasImage: false,
    tagIds: [TAG_JAPAN],
    tags: [{ id: TAG_JAPAN, name: "Japan 2026", color: "#f472b6" }],
  };
  await upsertLocalIndexTransaction(SPACE, row);
  return row;
};

describe("offline transaction update + insights calculations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("offline amount edit updates IDB, monthly buckets, and dashboard card inputs", async () => {
    const previous = await seedIncome(10_000_000);
    // Mirror API rows: bookedAmount stays set after create; edits must refresh it
    // or hybrid dashboard cards keep totaling the stale booked value.
    const previousWithBooked = {
      ...previous,
      bookedAmount: 10_000_000,
      bookedAmountCurrency: "PHP",
      currencyConversion: {
        originalAmount: 10_000_000,
        originalCurrency: "PHP",
        convertedAmount: 10_000_000,
        convertedCurrency: "PHP",
        exchangeRate: 1,
        source: "manual",
      },
    } as IndexTransaction & {
      currencyConversion: {
        originalAmount: number;
        originalCurrency: string;
        convertedAmount: number;
        convertedCurrency: string;
        exchangeRate: number;
        source: string;
      };
    };
    await upsertLocalIndexTransaction(SPACE, previousWithBooked);
    await seedDineExpense();
    await cacheMonthlyFinancialSummaries(SPACE, [
      {
        id: "sum-2026-08",
        year: 2026,
        month: 8,
        currency: "PHP",
        fxBased: false,
        calculatedAt: new Date().toISOString(),
        totalIncome: 11_666_188,
        totalExpenses: 1_589_535,
        netSavings: 10_076_653,
        savingsPercentage: 86,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      },
    ]);

    vi.mocked(updateTransaction).mockRejectedValue(
      new Error("Failed to create transaction"),
    );

    const queryClient = new QueryClient();
    const dashboardKey = [
      "dashboard",
      "transactions",
      SPACE,
      "2026-08-01",
      "2026-08-31",
    ] as const;

    queryClient.setQueryData(dashboardKey, {
      transactions: [previousWithBooked],
    });

    const listKey = [
      "transactions",
      SPACE,
      "[]",
      "2026-08-01",
      "2026-08-31",
      "",
      "",
      "",
      "[]",
      "[]",
    ] as const;
    queryClient.setQueryData(listKey, {
      pages: [
        {
          transactions: [previousWithBooked],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 10_000_000, expense: 0, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    const result = await updateTransactionLocalFirst(
      {} as never,
      {
        spaceId: SPACE,
        previous: previousWithBooked,
        amountCurrency: "PHP",
        data: {
          id: previousWithBooked.id,
          amount: 1,
          description: previousWithBooked.description,
          transactionType: "income",
          categoryName: "Freelance",
          accountName: "Cash",
          date: previousWithBooked.date,
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          tagIds: [TAG_JAPAN],
          tags: previousWithBooked.tags,
        },
      },
      { queryClient, waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.localTransaction.amount).toBe(1);
    expect(result.localTransaction.bookedAmount).toBe(1);

    const stored = await loadLocalIndexTransactionById(
      SPACE,
      previousWithBooked.id,
    );
    expect(stored?.amount).toBe(1);
    expect(stored?.bookedAmount).toBe(1);
    expect(stored?.tagIds).toEqual([TAG_JAPAN]);

    const summaries = await loadCachedMonthlyFinancialSummaries(SPACE);
    const august = summaries?.find((row) => row.year === 2026 && row.month === 8);
    expect(august?.totalIncome).toBeCloseTo(11_666_188 - 10_000_000 + 1);

    const dashboardCache = queryClient.getQueryData<{
      transactions: IndexTransaction[];
    }>(dashboardKey);
    expect(dashboardCache?.transactions[0]?.amount).toBe(1);
    expect(dashboardCache?.transactions[0]?.bookedAmount).toBe(1);

    const listCache = queryClient.getQueryData<{
      pages: Array<{ totals: { income: number } | null }>;
    }>(listKey);
    expect(listCache?.pages[0]?.totals?.income).toBe(1);

    const dashboard = buildDashboardDataFromBuckets(
      shell,
      summaries ?? [],
      "2026-08-01",
      "2026-08-31",
      {
        transactions: dashboardCache?.transactions ?? [],
        spaceCurrency: "PHP",
      },
    );
    expect(Number(dashboard.financialSummary.totalIncome)).toBe(1);
    expect(Number(dashboard.financialSummary.totalIncome)).not.toBe(10_000_000);
    expect(august?.totalIncome).toBeCloseTo(11_666_188 - 10_000_000 + 1);
  });

  it("unfiltered August totals from IndexedDB txs when monthly buckets are empty", async () => {
    await seedIncome(1_641_483.57);
    await seedDineExpense();
    await cacheMonthlyFinancialSummaries(SPACE, [
      {
        id: "sum-2026-08",
        year: 2026,
        month: 8,
        currency: "PHP",
        fxBased: false,
        calculatedAt: new Date().toISOString(),
        totalIncome: 0,
        totalExpenses: 0,
        netSavings: 0,
        savingsPercentage: 0,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      },
    ]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      currency: "PHP",
      // Stale zero prefetched rows must not block hydrated IndexedDB totals.
      prefetchedSummaries: [
        {
          id: "sum-2026-08",
          year: 2026,
          month: 8,
          currency: "PHP",
          fxBased: false,
          calculatedAt: new Date().toISOString(),
          totalIncome: 0,
          totalExpenses: 0,
          netSavings: 0,
          savingsPercentage: 0,
          monthStartDate: "2026-08-01",
          monthEndDate: "2026-08-31",
        },
      ],
    });

    expect(bundle.summary.totalIncome).toBeCloseTo(1_641_483.57);
    expect(bundle.summary.totalExpenses).toBeCloseTo(41_037.1);
    expect(bundle.summary.netSavings).toBeCloseTo(1_641_483.57 - 41_037.1);
    expect(bundle.expenseBreakdown.length).toBeGreaterThan(0);
    expect(bundle.healthScores.score).toBeGreaterThan(0);
  });

  it("unfiltered August totals from IndexedDB monthly buckets when txs are missing", async () => {
    await cacheMonthlyFinancialSummaries(SPACE, [
      {
        id: "sum-2026-08",
        year: 2026,
        month: 8,
        currency: "PHP",
        fxBased: false,
        calculatedAt: new Date().toISOString(),
        totalIncome: 1_641_483.57,
        totalExpenses: 1_810_920.05,
        netSavings: -169_436.48,
        savingsPercentage: -10,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      },
    ]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      currency: "PHP",
    });

    expect(bundle.summary.totalIncome).toBeCloseTo(1_641_483.57);
    expect(bundle.summary.totalExpenses).toBeCloseTo(1_810_920.05);
    expect(bundle.summary.netSavings).toBeCloseTo(-169_436.48);
  });

  it("offline category and tag filters compute from local IndexedDB alone", async () => {
    await seedIncome(1);
    await seedDineExpense();

    const categoryBundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      currency: "PHP",
      categoryName: CATEGORY_DINE.name,
      categoryId: CATEGORY_DINE.id,
      categoryOptions: {
        expense: [
          {
            id: CATEGORY_DINE.id,
            label: CATEGORY_DINE.name,
            value: CATEGORY_DINE.id,
            name: CATEGORY_DINE.name,
            parentId: null,
            children: [],
          },
        ],
        income: [],
      },
    });

    expect(categoryBundle.summary.totalExpenses).toBeGreaterThan(0);
    expect(categoryBundle.summary.totalExpenses).toBeCloseTo(41037.1);

    const tagBundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      currency: "PHP",
      tagIds: [TAG_JAPAN],
    });

    expect(tagBundle.summary.totalIncome).toBe(1);
    expect(tagBundle.summary.totalExpenses).toBeCloseTo(41037.1);
    expect(tagBundle.summary.netSavings).toBeCloseTo(1 - 41037.1);
  });

  it("offline tag filter still works when Dexie lost tags but list cache kept them", async () => {
    await upsertLocalIndexTransaction(SPACE, {
      id: "tx-stripped",
      date: "2026-08-11",
      description: "Coffee",
      amount: 41037.1,
      amountCurrency: "PHP",
      categoryName: CATEGORY_DINE.name,
      categoryId: CATEGORY_DINE.id,
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      currency: "PHP",
      tagIds: [TAG_JAPAN],
      seedTransactions: [
        {
          id: "tx-stripped",
          date: "2026-08-11",
          description: "Coffee",
          amount: 41037.1,
          categoryName: CATEGORY_DINE.name,
          categoryId: CATEGORY_DINE.id,
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
          tagIds: [TAG_JAPAN],
          tags: [{ id: TAG_JAPAN, name: "Japan 2026", color: "#f472b6" }],
        },
      ],
    });

    expect(bundle.summary.totalExpenses).toBeCloseTo(41037.1);

    const healed = await loadLocalIndexTransactionById(SPACE, "tx-stripped");
    expect(healed?.tagIds).toEqual([TAG_JAPAN]);

    const withoutSeed = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: "2005-08-01",
      endDate: "2026-08-31",
      currency: "PHP",
      tagIds: [TAG_JAPAN],
    });
    expect(withoutSeed.summary.totalExpenses).toBeCloseTo(41037.1);
  });
});
