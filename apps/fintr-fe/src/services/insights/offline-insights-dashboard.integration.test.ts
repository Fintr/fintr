import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import {
  cacheDashboardShell,
  cacheMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  cacheDashboardResponse,
  loadCachedDashboardResponse,
} from "@/services/spaces/local-cache";
import { upsertLocalIndexTransaction } from "@/services/transactions/local-cache";

import { buildOfflineInsightsBundle } from "./offline-calculations";

const SPACE = "space-dashboard-aug";
const AUGUST_START = "2026-08-01";
const AUGUST_END = "2026-08-31";

const AUGUST_TOTALS = {
  totalIncome: 1_641_483.57,
  totalExpenses: 1_810_920.05,
  netSavings: -169_436.48,
};

const shell = {
  id: "dash-1",
  categoryOptions: [],
  accountOptions: [],
  expenseCategoryOptions: [],
  incomeCategoryOptions: [],
  goalDescription: "",
};

const augustBucket = {
  id: "sum-2026-08",
  year: 2026,
  month: 8,
  currency: "PHP",
  fxBased: true,
  calculatedAt: new Date().toISOString(),
  totalIncome: AUGUST_TOTALS.totalIncome,
  totalExpenses: AUGUST_TOTALS.totalExpenses,
  netSavings: AUGUST_TOTALS.netSavings,
  savingsPercentage: -10,
  monthStartDate: AUGUST_START,
  monthEndDate: AUGUST_END,
};

const seedAugustExpense = async (
  amount: number,
  overrides: Partial<IndexTransaction> = {},
): Promise<void> => {
  await upsertLocalIndexTransaction(SPACE, {
    id: overrides.id ?? `tx-expense-${amount}`,
    date: overrides.date ?? "2026-08-11",
    description: overrides.description ?? "Coffee",
    amount,
    amountCurrency: "PHP",
    categoryName: overrides.categoryName ?? "Dine Out & Entertainment",
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: false,
    hasImage: false,
    ...overrides,
  });
};

const seedAugustIncome = async (amount: number): Promise<void> => {
  await upsertLocalIndexTransaction(SPACE, {
    id: `tx-income-${amount}`,
    date: "2026-08-05",
    description: "Freelance",
    amount,
    amountCurrency: "PHP",
    categoryName: "Freelance",
    fromAccountName: "",
    toAccountName: "Cash",
    type: CombinedTransactionTypeEnum.INCOME,
    inSeries: false,
    hasImage: false,
  });
};

describe("offline insights dashboard — August 2026 unfiltered", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("populates Net / In / Out from IndexedDB monthly buckets", async () => {
    await cacheDashboardShell(SPACE, shell);
    await cacheMonthlyFinancialSummaries(SPACE, [augustBucket]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: AUGUST_START,
      endDate: AUGUST_END,
      currency: "PHP",
      transactionPhase: "none",
    });

    expect(bundle.summary.totalIncome).toBeCloseTo(AUGUST_TOTALS.totalIncome);
    expect(bundle.summary.totalExpenses).toBeCloseTo(AUGUST_TOTALS.totalExpenses);
    expect(bundle.summary.netSavings).toBeCloseTo(AUGUST_TOTALS.netSavings);
    expect(bundle.expenseBreakdown).toEqual([]);
  });

  it("populates expense breakdown when IndexedDB has August transactions", async () => {
    await cacheDashboardShell(SPACE, shell);
    await cacheMonthlyFinancialSummaries(SPACE, [augustBucket]);
    await seedAugustExpense(1_810_920.05);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: AUGUST_START,
      endDate: AUGUST_END,
      currency: "PHP",
    });

    expect(bundle.summary.totalExpenses).toBeCloseTo(AUGUST_TOTALS.totalExpenses);
    expect(bundle.expenseBreakdown.length).toBeGreaterThan(0);
  });

  it("populates totals from IndexedDB transactions when buckets are stale zeros", async () => {
    await cacheDashboardShell(SPACE, shell);
    await cacheMonthlyFinancialSummaries(SPACE, [
      {
        ...augustBucket,
        fxBased: false,
        totalIncome: 0,
        totalExpenses: 0,
        netSavings: 0,
      },
    ]);
    await seedAugustIncome(AUGUST_TOTALS.totalIncome);
    await seedAugustExpense(AUGUST_TOTALS.totalExpenses);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: AUGUST_START,
      endDate: AUGUST_END,
      currency: "PHP",
    });

    expect(bundle.summary.totalIncome).toBeCloseTo(AUGUST_TOTALS.totalIncome);
    expect(bundle.summary.totalExpenses).toBeCloseTo(AUGUST_TOTALS.totalExpenses);
    expect(bundle.summary.netSavings).toBeCloseTo(AUGUST_TOTALS.netSavings);
  });

  it("populates totals from cached dashboard snapshot when monthly buckets are empty", async () => {
    await cacheDashboardShell(SPACE, shell);
    await cacheMonthlyFinancialSummaries(SPACE, []);
    await cacheDashboardResponse(
      SPACE,
      {
        ...shell,
        financialSummary: {
          totalIncome: String(AUGUST_TOTALS.totalIncome),
          totalExpenses: String(AUGUST_TOTALS.totalExpenses),
          netSavings: String(AUGUST_TOTALS.netSavings),
          savingsPercentage: "-10",
          calculatedAt: new Date().toISOString(),
        },
      },
      AUGUST_START,
      AUGUST_END,
    );

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: AUGUST_START,
      endDate: AUGUST_END,
      currency: "PHP",
    });

    expect(bundle.summary.totalIncome).toBeCloseTo(AUGUST_TOTALS.totalIncome);
    expect(bundle.summary.totalExpenses).toBeCloseTo(AUGUST_TOTALS.totalExpenses);
    expect(bundle.summary.netSavings).toBeCloseTo(AUGUST_TOTALS.netSavings);

    const dashboard = await loadCachedDashboardResponse(
      SPACE,
      AUGUST_START,
      AUGUST_END,
    );

    expect(Number(dashboard?.financialSummary.totalIncome)).toBeCloseTo(
      bundle.summary.totalIncome,
    );
    expect(Number(dashboard?.financialSummary.totalExpenses)).toBeCloseTo(
      bundle.summary.totalExpenses,
    );
  });

  it("matches dashboard cache totals for non-fx August buckets with no Dexie txs", async () => {
    await cacheDashboardShell(SPACE, shell);
    await cacheMonthlyFinancialSummaries(SPACE, [
      {
        ...augustBucket,
        fxBased: false,
      },
    ]);

    const bundle = await buildOfflineInsightsBundle({
      spaceCode: SPACE,
      startDate: AUGUST_START,
      endDate: AUGUST_END,
      currency: "PHP",
    });

    const dashboard = await loadCachedDashboardResponse(
      SPACE,
      AUGUST_START,
      AUGUST_END,
    );

    expect(bundle.summary.totalIncome).toBeCloseTo(AUGUST_TOTALS.totalIncome);
    expect(Number(dashboard?.financialSummary.totalIncome)).toBeCloseTo(
      bundle.summary.totalIncome,
    );
  });
});
