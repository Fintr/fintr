import { getColorByIndex } from "@/lib/utils";
import { monthRangesInclusive } from "@/lib/local-sync/offline-bootstrap-dates";
import { loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import {
  enrichTransactionsForInsights,
  loadInsightsBucketSources,
  loadInsightsLocalSources,
} from "./load-local-sources";
import { filterInsightsTransactions } from "./filter-insights-transactions";
import { financialSummaryForDateRange } from "@/services/monthly-financial-summaries/combine";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import { upsertLiveCurrentMonthSummary } from "@/services/monthly-financial-summaries/live-current-month-summary";
import type { Budget } from "@/types/budgetTypes";
import type { Loan } from "@/services/loans/queries";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import {
  filterTransactionsByInsightsCategory,
  type InsightsCategoryFilter,
} from "@/utils/transactionListFilter";
import { getLocalIsoDateKey } from "@/utils/dateUtils";
import { resolveIndexTransactionTagIds } from "@/utils/resolveIndexTransactionTagIds";
import { mergeMetaTransactionSnapshotsIntoIndex } from "@/services/transactions/local-cache";
import { loadCachedDashboardFinancialSummary } from "@/services/spaces/local-cache";

import {
  formatCategoryPickerValue,
  isCategoryPickerId,
  type CategoryTreeOption,
} from "@/types/categoryTreeTypes";
import {
  isExpenseCategoryFilterValue,
  isIncomeCategoryFilterValue,
} from "@/utils/categoryFilterOptions";

import {
  buildTransactionTotalsContext,
  amountNumericForSpaceTotal,
} from "@/services/insights/transaction-space-totals";
import {
  financialTrendsDateRange,
  monthlySpendingFromBuckets,
  monthlySpendingFromTransactions,
  insightsSummaryFromMonthlyBuckets,
  type MonthlySpendingSeriesMode,
} from "./from-monthly-buckets";
import { transformHealthScores } from "./transforms";
import type {
  ExpenseBreakdown,
  FinancialHealthScore,
  InsightsSummary,
  MonthlySpending,
  WeeklySpending,
} from "./types";

const dayKey = (isoDate: string): string => isoDate.slice(0, 10);

const isLocalInsightsDebugEnabled = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "localhost"
    || window.location.hostname === "127.0.0.1"
  );
};

const insightsSummaryFromFinancialSummary = (
  financialSummary: {
    totalIncome: string;
    totalExpenses: string;
    netSavings: string;
  },
): InsightsSummary => ({
  totalIncome: Number.parseFloat(financialSummary.totalIncome) || 0,
  totalExpenses: Number.parseFloat(financialSummary.totalExpenses) || 0,
  netSavings: Number.parseFloat(financialSummary.netSavings) || 0,
});

export const summaryHasInsightsSignal = (summary: InsightsSummary): boolean =>
  summary.totalIncome !== 0 || summary.totalExpenses !== 0;

/**
 * Pick unfiltered Net / In / Out totals from IndexedDB sources.
 * Order: monthly buckets → cached dashboard snapshot → hybrid (buckets + txs)
 * → period txs. Buckets are authoritative for unfiltered month views; period
 * transactions enrich breakdowns and charts without replacing hero totals.
 */
export const resolveUnfilteredInsightsSummary = (params: {
  fromPeriodTransactions: InsightsSummary;
  hybridSummary: InsightsSummary;
  bucketSummary: InsightsSummary;
  cachedDashboardSummary?: InsightsSummary;
}): InsightsSummary => {
  const {
    fromPeriodTransactions,
    hybridSummary,
    bucketSummary,
    cachedDashboardSummary,
  } = params;

  if (summaryHasInsightsSignal(bucketSummary)) {
    return bucketSummary;
  }

  if (
    cachedDashboardSummary
    && summaryHasInsightsSignal(cachedDashboardSummary)
  ) {
    return cachedDashboardSummary;
  }

  if (summaryHasInsightsSignal(hybridSummary)) {
    return hybridSummary;
  }

  if (summaryHasInsightsSignal(fromPeriodTransactions)) {
    return fromPeriodTransactions;
  }

  return bucketSummary;
};

const EMPTY_INSIGHTS_SUMMARY: InsightsSummary = {
  totalIncome: 0,
  totalExpenses: 0,
  netSavings: 0,
};

const assembleBucketOnlyOfflineInsightsBundle = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
  currency: string;
  summaries: MonthlyFinancialSummary[];
  budgets: Budget[];
  loans: Loan[];
}): Promise<OfflineInsightsBundle> => {
  const {
    spaceCode,
    startDate,
    endDate,
    currency,
    summaries,
    budgets,
    loans,
  } = params;

  const trendsRange = financialTrendsDateRange(endDate);
  const bucketSummary = insightsSummaryFromMonthlyBuckets(
    summaries,
    startDate,
    endDate,
  );
  const cachedDashboardFinancialSummary = await loadCachedDashboardFinancialSummary(
    spaceCode,
    startDate,
    endDate,
  );
  const cachedDashboardSummary = cachedDashboardFinancialSummary
    ? insightsSummaryFromFinancialSummary(cachedDashboardFinancialSummary)
    : undefined;

  const resolvedSummary = resolveUnfilteredInsightsSummary({
    fromPeriodTransactions: EMPTY_INSIGHTS_SUMMARY,
    hybridSummary: EMPTY_INSIGHTS_SUMMARY,
    bucketSummary,
    cachedDashboardSummary,
  });

  const hybridSummaries = upsertLiveCurrentMonthSummary({
    summaries,
    transactions: [],
    currency,
  });
  const monthlySpending = monthlySpendingFromBuckets(
    hybridSummaries,
    trendsRange.startDate,
    trendsRange.endDate,
  ).map((row) => ({
    ...row,
    expenses: -Math.abs(row.expenses),
  }));

  const totalBudget = budgets.reduce(
    (sum, budget) => sum + toAmount(budget.amount),
    0,
  );
  const monthlyDebt = totalMonthlyDebtFromLoans(loans);

  return {
    summary: resolvedSummary,
    expenseBreakdown: [],
    merchantBreakdown: [],
    subcategoryBreakdown: [],
    weeklySpending: [],
    monthlySpending,
    totalBudget,
    monthlyDebt,
    healthScores: healthScoresFromLocalData({
      summary: resolvedSummary,
      periodDays: periodDaysBetween(startDate, endDate),
      totalBudget,
      monthlyDebt,
    }),
  };
};

const rowTagCount = (row: IndexTransaction): number =>
  (row as IndexTransaction & { tagIds?: string[] }).tagIds?.length
  ?? row.tags?.length
  ?? 0;

/**
 * Write seed-restored tag/category metadata back to IndexedDB so offline
 * category/tag filters keep working after React Query caches are cleared.
 */
const persistRestoredInsightsMetadata = async (params: {
  spaceCode: string;
  before: IndexTransaction[];
  after: IndexTransaction[];
}): Promise<void> => {
  const { spaceCode, before, after } = params;
  if (!spaceCode || after.length === 0) {
    return;
  }

  const beforeById = new Map(before.map((row) => [row.id, row]));
  const toPersist: IndexTransaction[] = [];

  for (const row of after) {
    if (!row?.id) {
      continue;
    }

    const prior = beforeById.get(row.id);
    const gainedTags = rowTagCount(row) > 0 && rowTagCount(prior ?? { tags: [] } as IndexTransaction) === 0;
    const gainedCategory =
      Boolean(row.categoryId || row.categoryName?.trim())
      && !prior?.categoryId
      && !prior?.categoryName?.trim();

    if (gainedTags || gainedCategory) {
      toPersist.push(row);
    }
  }

  if (toPersist.length === 0) {
    return;
  }

  try {
    const { upsertLocalIndexTransaction } = await import(
      "@/services/transactions/local-cache"
    );

    await Promise.all(
      toPersist.map((row) => upsertLocalIndexTransaction(spaceCode, row)),
    );
  } catch (error) {
    console.warn(
      "[insights] Failed to persist restored filter metadata",
      error,
    );
  }
};

const resolveInsightsCategoryName = (params: {
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  categoryOptions?: {
    expense: CategoryTreeOption[];
    income: CategoryTreeOption[];
  };
}): string | undefined => {
  const trimmed = params.categoryName?.trim();
  // Offline UI may pass the raw category picker UUID as `categoryName` when
  // options were empty at selection time — never treat that as a display name.
  if (trimmed && !isCategoryPickerId(trimmed)) {
    return trimmed;
  }

  if (!params.categoryId || !params.categoryOptions) {
    return undefined;
  }

  const parents = [
    ...params.categoryOptions.expense,
    ...params.categoryOptions.income,
  ];
  const parent = parents.find((option) => option.id === params.categoryId);
  if (!parent) {
    return undefined;
  }

  if (params.subcategoryId) {
    const subcategory = parent.children?.find(
      (child) => child.id === params.subcategoryId,
    );
    if (subcategory) {
      return subcategory.name || subcategory.label;
    }
  }

  return parent.name || parent.label;
};

export const resolveCategoryTrendsSeriesMode = (params: {
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  categoryOptions?: InsightsCategoryFilter["categoryOptions"];
}): MonthlySpendingSeriesMode | null => {
  const { categoryName, categoryId, subcategoryId, categoryOptions } = params;
  const categoryFiltered = Boolean(
    categoryId
    || subcategoryId
    || (categoryName && categoryName.length > 0),
  );

  if (!categoryFiltered) {
    return null;
  }

  if (!categoryOptions || !categoryId) {
    return "expense";
  }

  const pickerValue = formatCategoryPickerValue({
    categoryId,
    subcategoryId: subcategoryId ?? null,
  });

  if (isIncomeCategoryFilterValue(pickerValue, categoryOptions.income)) {
    return "income";
  }

  if (isExpenseCategoryFilterValue(pickerValue, categoryOptions.expense)) {
    return "expense";
  }

  // Name/id matched a filter but tree side is unclear — treat as expense series.
  return "expense";
};

const toAmount = (value: IndexTransaction["amount"] | number | string): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number.parseFloat(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPercentage = (value: number): string => `${value.toFixed(2)}%`;

export const periodDaysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const ms = end.getTime() - start.getTime();
  if (!Number.isFinite(ms) || ms < 0) {
    return 30;
  }
  return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
};

const isExpense = (tx: IndexTransaction): boolean => {
  const type = String(tx.type ?? "").trim().toLowerCase();
  if (!type) {
    return true;
  }

  return (
    type === CombinedTransactionTypeEnum.EXPENSE
    || type === "transactions::expense"
    || type.endsWith("::expense")
    || type === "expense"
  );
};

const filterByTagIds = (
  transactions: IndexTransaction[],
  tagIds: string[],
): IndexTransaction[] => {
  if (tagIds.length === 0) {
    return transactions;
  }

  const allowed = new Set(tagIds);
  return transactions.filter((tx) => {
    const transactionTagIds = resolveIndexTransactionTagIds(tx);
    return transactionTagIds.some((tagId) => allowed.has(tagId));
  });
};

const metadataRichness = (row: IndexTransaction): number => {
  let score = 0;
  if (row.categoryId) {
    score += 2;
  }
  if (row.categoryName?.trim()) {
    score += 1;
  }
  if (row.subcategoryId) {
    score += 1;
  }
  if (row.subcategoryName?.trim()) {
    score += 1;
  }
  score += resolveIndexTransactionTagIds(row).length * 3;
  return score;
};

const preferRicherTransaction = (
  current: IndexTransaction | undefined,
  incoming: IndexTransaction,
): IndexTransaction => {
  if (!current) {
    return incoming;
  }

  if (metadataRichness(incoming) > metadataRichness(current)) {
    return {
      ...current,
      ...incoming,
      tags: incoming.tags?.length ? incoming.tags : current.tags,
      tagIds:
        resolveIndexTransactionTagIds(incoming).length > 0
          ? resolveIndexTransactionTagIds(incoming)
          : resolveIndexTransactionTagIds(current),
      categoryName: incoming.categoryName?.trim()
        ? incoming.categoryName
        : current.categoryName,
      categoryId: incoming.categoryId ?? current.categoryId,
      subcategoryId: incoming.subcategoryId ?? current.subcategoryId,
      subcategoryName: incoming.subcategoryName ?? current.subcategoryName,
    } as IndexTransaction;
  }

  return {
    ...incoming,
    ...current,
    tags: current.tags?.length ? current.tags : incoming.tags,
    tagIds:
      resolveIndexTransactionTagIds(current).length > 0
        ? resolveIndexTransactionTagIds(current)
        : resolveIndexTransactionTagIds(incoming),
    categoryName: current.categoryName?.trim()
      ? current.categoryName
      : incoming.categoryName,
    categoryId: current.categoryId ?? incoming.categoryId,
    subcategoryId: current.subcategoryId ?? incoming.subcategoryId,
    subcategoryName: current.subcategoryName ?? incoming.subcategoryName,
  } as IndexTransaction;
};

/** Mirrors Insights::MonthlyDebtPayments.estimate_monthly_payment */
export const estimateMonthlyLoanPayment = (loan: Loan): number => {
  const principal = toAmount(loan.outstandingBalance);
  const termMonths = loan.loanTermMonths;
  if (principal <= 0 || !termMonths || termMonths <= 0) {
    return 0;
  }

  const monthlyRate = toAmount(loan.interestRate) / 100 / 12;
  if (monthlyRate === 0) {
    return principal / termMonths;
  }

  const onePlusRate = 1 + monthlyRate;
  const powerResult = onePlusRate ** termMonths;
  const denominator = powerResult - 1;
  if (denominator <= 0) {
    return 0;
  }

  return principal * ((monthlyRate * powerResult) / denominator);
};

export const totalMonthlyDebtFromLoans = (loans: Loan[]): number =>
  loans
    .filter((loan) => loan.loanType === "borrowed" && loan.status === "active")
    .reduce((sum, loan) => sum + estimateMonthlyLoanPayment(loan), 0);

const savingsScore = (percentage: number): number => {
  if (percentage >= 20) return 100;
  if (percentage >= 15) return 90;
  if (percentage >= 10) return 75;
  if (percentage >= 5) return 50;
  if (percentage >= 1) return 25;
  return 0;
};

const debtToIncomeScore = (percentage: number): number => {
  if (percentage < 20) return 100;
  if (percentage < 30) return 80;
  if (percentage < 40) return 60;
  if (percentage < 50) return 40;
  return 20;
};

const budgetUsageScore = (percentage: number): number => {
  if (percentage <= 100) return 100;
  if (percentage < 110) return 90;
  if (percentage < 120) return 80;
  if (percentage < 130) return 70;
  if (percentage < 140) return 60;
  if (percentage < 150) return 50;
  if (percentage < 160) return 40;
  if (percentage < 170) return 30;
  if (percentage < 180) return 20;
  if (percentage < 190) return 10;
  return 0;
};

export const loadLocalBudgetsForRange = async (
  spaceCode: string,
  startDate: string,
  endDate: string,
): Promise<Budget[]> => {
  const months = monthRangesInclusive(startDate, endDate);
  const pages = await Promise.all(
    months.map((month) =>
      loadCachedBudgetsResponse(spaceCode, month.startDate, month.endDate),
    ),
  );

  return pages.flatMap((page) => page?.budgets ?? []);
};

export const expenseBreakdownFromTransactions = (
  transactions: IndexTransaction[],
  amountForTotal?: (transaction: IndexTransaction) => number,
): ExpenseBreakdown[] => {
  const readAmount = amountForTotal ?? ((tx) => Math.abs(toAmount(tx.amount)));
  const expenses = transactions.filter(isExpense);
  if (expenses.length === 0) {
    return [];
  }

  const total = expenses.reduce(
    (sum, tx) => sum + readAmount(tx),
    0,
  );
  if (total <= 0) {
    return [];
  }

  const byCategory = new Map<string, number>();
  for (const tx of expenses) {
    const name = tx.categoryName || "Uncategorized";
    byCategory.set(
      name,
      (byCategory.get(name) ?? 0) + readAmount(tx),
    );
  }

  return Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: getColorByIndex(index),
      percentage: formatPercentage((value / total) * 100),
    }));
};

export const UNASSIGNED_MERCHANT_LABEL = "Unassigned";
export const UNASSIGNED_SUBCATEGORY_LABEL = "Unassigned";

const expenseBreakdownByLabel = (
  transactions: IndexTransaction[],
  labelFor: (tx: IndexTransaction) => string,
  amountForTotal?: (transaction: IndexTransaction) => number,
): ExpenseBreakdown[] => {
  const readAmount = amountForTotal ?? ((tx) => Math.abs(toAmount(tx.amount)));
  const expenses = transactions.filter(isExpense);
  if (expenses.length === 0) {
    return [];
  }

  const total = expenses.reduce(
    (sum, tx) => sum + readAmount(tx),
    0,
  );
  if (total <= 0) {
    return [];
  }

  const byLabel = new Map<string, number>();
  for (const tx of expenses) {
    const name = labelFor(tx);
    byLabel.set(
      name,
      (byLabel.get(name) ?? 0) + readAmount(tx),
    );
  }

  return Array.from(byLabel.entries())
    .sort((a, b) => {
      if (a[0] === UNASSIGNED_MERCHANT_LABEL || a[0] === UNASSIGNED_SUBCATEGORY_LABEL) {
        return 1;
      }
      if (b[0] === UNASSIGNED_MERCHANT_LABEL || b[0] === UNASSIGNED_SUBCATEGORY_LABEL) {
        return -1;
      }
      return b[1] - a[1];
    })
    .map(([name, value], index) => ({
      name,
      value,
      color: getColorByIndex(index),
      percentage: formatPercentage((value / total) * 100),
    }));
};

export const merchantBreakdownFromTransactions = (
  transactions: IndexTransaction[],
  amountForTotal?: (transaction: IndexTransaction) => number,
): ExpenseBreakdown[] =>
  expenseBreakdownByLabel(
    transactions,
    (tx) => {
      const trimmed = tx.entityName?.trim() ?? "";
      return trimmed.length > 0 ? trimmed : UNASSIGNED_MERCHANT_LABEL;
    },
    amountForTotal,
  );

/** Groups expense amounts by subcategory; blank subcategory → Unassigned. */
export const subcategoryBreakdownFromTransactions = (
  transactions: IndexTransaction[],
  amountForTotal?: (transaction: IndexTransaction) => number,
): ExpenseBreakdown[] =>
  expenseBreakdownByLabel(
    transactions,
    (tx) => {
      const trimmed = tx.subcategoryName?.trim() ?? "";
      return trimmed.length > 0 ? trimmed : UNASSIGNED_SUBCATEGORY_LABEL;
    },
    amountForTotal,
  );

/**
 * Mirrors CreateWeeklySpending: last 7 calendar days ending today (local).
 */
export const weeklySpendingFromTransactions = (
  transactions: IndexTransaction[],
  today: Date = new Date(),
  amountForTotal?: (transaction: IndexTransaction) => number,
): WeeklySpending[] => {
  const readAmount = amountForTotal ?? ((tx) => Math.abs(toAmount(tx.amount)));
  const endKey = getLocalIsoDateKey(today);
  const endParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endKey);
  if (!endParts) {
    return [];
  }

  const end = new Date(
    Number(endParts[1]),
    Number(endParts[2]) - 1,
    Number(endParts[3]),
  );
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const startKey = getLocalIsoDateKey(start);

  const expenses = transactions.filter(
    (tx) =>
      isExpense(tx)
      && dayKey(tx.date) >= startKey
      && dayKey(tx.date) <= endKey,
  );

  const byDate = new Map<string, number>();
  for (const tx of expenses) {
    const key = dayKey(tx.date);
    byDate.set(key, (byDate.get(key) ?? 0) + readAmount(tx));
  }

  const ordered: WeeklySpending[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const key = getLocalIsoDateKey(date);
    const amount = byDate.get(key) ?? 0;
    const day = date.toLocaleDateString("en-US", { weekday: "short" });
    ordered.push({ day, amount });
  }

  return ordered;
};

export const healthScoresFromLocalData = (input: {
  summary: InsightsSummary;
  periodDays: number;
  totalBudget: number;
  monthlyDebt: number;
}): FinancialHealthScore => {
  const { summary, periodDays, totalBudget, monthlyDebt } = input;
  const totalIncome = summary.totalIncome;
  const totalExpenses = summary.totalExpenses;
  const netSavings = summary.netSavings;

  const savingsRate =
    totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;
  const savingsScoreValue = totalIncome > 0 ? savingsScore(savingsRate) : 0;

  const months = Math.max(periodDays / 30, 1);
  const monthlyIncome = totalIncome / months;
  const debtRatio =
    monthlyIncome > 0 ? (monthlyDebt / monthlyIncome) * 100 : 0;
  const debtScoreValue =
    monthlyIncome === 0 ? 100 : debtToIncomeScore(debtRatio);

  const usagePercentage =
    totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;
  const budgetScoreValue =
    totalBudget > 0 ? budgetUsageScore(usagePercentage) : 0;

  const weighted =
    savingsScoreValue * 0.5 + budgetScoreValue * 0.3 + debtScoreValue * 0.2;

  return transformHealthScores({
    financialHealthScore: formatPercentage(weighted),
    savingsPercentage: {
      percentage: formatPercentage(savingsRate),
      score: savingsScoreValue,
    },
    debtToIncomeRatio: {
      percentage: formatPercentage(debtRatio),
      score: debtScoreValue,
      monthlyDebt: String(Number(monthlyDebt.toFixed(2))),
    },
    budgetUsage: {
      percentage: formatPercentage(usagePercentage),
      score: budgetScoreValue,
    },
  });
};

export type OfflineInsightsBundle = {
  summary: InsightsSummary;
  expenseBreakdown: ExpenseBreakdown[];
  merchantBreakdown: ExpenseBreakdown[];
  subcategoryBreakdown: ExpenseBreakdown[];
  weeklySpending: WeeklySpending[];
  monthlySpending: MonthlySpending[];
  healthScores: FinancialHealthScore;
  totalBudget: number;
  monthlyDebt: number;
};

export type OfflineInsightsTransactionPhase = "none" | "period" | "all";

export const buildOfflineInsightsBundle = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
  currency?: string;
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  tagIds?: string[];
  categoryOptions?: InsightsCategoryFilter["categoryOptions"];
  prefetchedSummaries?: MonthlyFinancialSummary[];
  /**
   * Optional test/metadata enrichment rows. Production Insights never pass
   * React Query caches here — IndexedDB (via loadInsightsLocalSources) is the
   * sole source of transactions.
   */
  seedTransactions?: IndexTransaction[];
  /**
   * `none` — monthly buckets only (fast Net / In / Out).
   * `period` — load period transactions for breakdown / weekly charts.
   * `all` — full history (category / tag filters).
   */
  transactionPhase?: OfflineInsightsTransactionPhase;
}): Promise<OfflineInsightsBundle> => {
  const {
    spaceCode,
    startDate,
    endDate,
    currency = "PHP",
    categoryName,
    categoryId,
    subcategoryId,
    tagIds = [],
    categoryOptions,
    prefetchedSummaries,
    seedTransactions = [],
    transactionPhase,
  } = params;

  const resolvedCategoryName = resolveInsightsCategoryName({
    categoryName,
    categoryId,
    subcategoryId,
    categoryOptions,
  });

  const categoryFilter: InsightsCategoryFilter = {
    categoryName: resolvedCategoryName,
    categoryId,
    subcategoryId,
    categoryOptions,
  };

  const categoryFiltered = Boolean(
    categoryId
    || subcategoryId
    || (resolvedCategoryName && resolvedCategoryName.length > 0),
  );
  const tagFiltered = tagIds.length > 0;
  const useTransactionSummary = categoryFiltered || tagFiltered;
  const resolvedTransactionPhase: OfflineInsightsTransactionPhase =
    transactionPhase
    ?? (useTransactionSummary ? "all" : "period");

  // Re-sync / list refreshes can leave Dexie rows without tags while meta still
  // has bootstrap snapshots. Heal the index before filtering so offline
  // category/tag chips do not stay at ₱0 after a pull.
  if (useTransactionSummary && spaceCode) {
    await mergeMetaTransactionSnapshotsIntoIndex(spaceCode);
  }

  const trendsRange = financialTrendsDateRange(endDate);
  const txLoadStart =
    categoryFiltered && trendsRange.startDate < startDate
      ? trendsRange.startDate
      : startDate;
  const txLoadEnd =
    categoryFiltered && trendsRange.endDate > endDate
      ? trendsRange.endDate
      : endDate;

  let loadedSummaries: MonthlyFinancialSummary[] = [];
  let transactionsInRange: IndexTransaction[] = [];
  let allCalculatedTransactions: IndexTransaction[] = [];
  let budgets: Budget[] = [];
  let loans: Loan[] = [];

  if (resolvedTransactionPhase === "none") {
    const bucketSources = await loadInsightsBucketSources({
      spaceCode,
      startDate,
      endDate,
    });

    return assembleBucketOnlyOfflineInsightsBundle({
      spaceCode: bucketSources.resolvedSpaceCode || spaceCode,
      startDate,
      endDate,
      currency,
      summaries: bucketSources.summaries,
      budgets: bucketSources.budgets,
      loans: bucketSources.loans,
    });
  }

  const localSources = await loadInsightsLocalSources({
    spaceCode,
    startDate,
    endDate,
    transactionLoadStart: txLoadStart,
    transactionLoadEnd: txLoadEnd,
    loadAllTransactions: resolvedTransactionPhase === "all",
  });

  loadedSummaries = localSources.summaries;
  transactionsInRange = localSources.transactionsInRange;
  allCalculatedTransactions = localSources.allCalculatedTransactions;
  budgets = localSources.budgets;
  loans = localSources.loans;

  // Always prefer summaries from loadInsightsLocalSources (hydrated from
  // IndexedDB txs). Prefetched rows are only a fallback for tests/callers.
  const summaries =
    loadedSummaries.length > 0
      ? loadedSummaries
      : (prefetchedSummaries ?? []);

  // Prefer the enriched all-time set from loadInsightsLocalSources so category /
  // tag metadata from bootstrap meta is not lost on a second Dexie-only read.
  const seededPeriod = filterInsightsTransactions(seedTransactions).filter(
    (transaction) =>
      dayKey(transaction.date) >= startDate
      && dayKey(transaction.date) <= endDate,
  );

  const periodFromCache = (
    allCalculatedTransactions.length > 0
      ? allCalculatedTransactions
      : filterInsightsTransactions(transactionsInRange)
  ).filter(
    (transaction) =>
      dayKey(transaction.date) >= startDate
      && dayKey(transaction.date) <= endDate,
  );

  const periodById = new Map<string, IndexTransaction>();
  for (const transaction of [...seededPeriod, ...periodFromCache]) {
    if (!transaction?.id) {
      continue;
    }
    periodById.set(
      transaction.id,
      preferRicherTransaction(periodById.get(transaction.id), transaction),
    );
  }
  const periodTransactions = Array.from(periodById.values());
  const calculatedTransactions = filterInsightsTransactions(transactionsInRange);
  const rateContextTransactions =
    allCalculatedTransactions.length > 0
      ? allCalculatedTransactions
      : calculatedTransactions.length > 0
        ? calculatedTransactions
        : periodTransactions;

  const totalsContext = await buildTransactionTotalsContext({
    spaceCode,
    spaceCurrency: currency,
    transactions: rateContextTransactions,
  });
  const expenseAmountForTotal = (transaction: IndexTransaction) => {
    const converted = Math.abs(
      amountNumericForSpaceTotal(
        transaction,
        currency,
        totalsContext.rateLookup,
      ),
    );
    if (converted > 0) {
      return converted;
    }

    // List `amount` is already space currency from the API — use it when FX
    // lookup misses so offline charts still render.
    return Math.abs(toAmount(transaction.amount));
  };

  const hybridTransactions =
    periodTransactions.length > 0
      ? periodTransactions
      : calculatedTransactions.filter(
          (transaction) =>
            dayKey(transaction.date) >= startDate
            && dayKey(transaction.date) <= endDate,
        );

  const liveMonthTransactions =
    allCalculatedTransactions.length > 0
      ? allCalculatedTransactions
      : periodTransactions;

  const hybridSummaries = useTransactionSummary
    ? summaries
    : upsertLiveCurrentMonthSummary({
        summaries,
        transactions: liveMonthTransactions,
        currency,
      });

  const sourceBase =
    allCalculatedTransactions.length > 0
      ? allCalculatedTransactions
      : calculatedTransactions.length > 0
        ? calculatedTransactions
        : periodTransactions.length > 0
          ? periodTransactions
          : seededPeriod;

  // Optional seed rows (tests / one-off metadata heal) fold into the filter
  // source; production Insights loads only from IndexedDB.
  const sourceForFilters = enrichTransactionsForInsights(
    sourceBase,
    seedTransactions,
  );

  if (seedTransactions.length > 0 && (categoryFiltered || tagFiltered)) {
    // Persist enriched category/tag metadata back into IndexedDB.
    await persistRestoredInsightsMetadata({
      spaceCode,
      before: sourceBase,
      after: sourceForFilters,
    });
  }

  const categoryFilteredTransactions = filterTransactionsByInsightsCategory(
    sourceForFilters,
    categoryFilter,
  );
  const filteredTransactions = filterByTagIds(
    categoryFilteredTransactions,
    tagIds,
  );
  const periodFilteredTransactions = filteredTransactions.filter(
    (tx) => dayKey(tx.date) >= startDate && dayKey(tx.date) <= endDate,
  );

  if (
    process.env.NODE_ENV === "development"
    && (categoryName || categoryId || subcategoryId || tagIds.length > 0)
  ) {
    console.debug("[insights:offline-filter]", {
      startDate,
      endDate,
      categoryName: resolvedCategoryName ?? categoryName ?? "",
      categoryId: categoryId ?? "",
      subcategoryId: subcategoryId ?? "",
      tagIds,
      loadedTransactions: sourceForFilters.length,
      matchedCategory: categoryFilteredTransactions.length,
      matchedAfterTags: filteredTransactions.length,
      matchedInPeriod: periodFilteredTransactions.length,
      sampleCategoryNames: [
        ...new Set(
          sourceForFilters
            .slice(0, 50)
            .map((tx) => tx.categoryName)
            .filter(Boolean),
        ),
      ],
      sampleTagIds: [
        ...new Set(
          sourceForFilters
            .slice(0, 50)
            .flatMap(
              (tx) =>
                (tx as IndexTransaction & { tagIds?: string[] }).tagIds
                ?? tx.tags?.map((tag) => tag.id)
                ?? [],
            ),
        ),
      ],
    });
  }

  if (isLocalInsightsDebugEnabled()) {
    console.info("[insights:offline-bundle]", {
      spaceCode,
      startDate,
      endDate,
      summariesCount: summaries.length,
      periodTransactions: periodTransactions.length,
      transactionsInRange: transactionsInRange.length,
      allCalculatedTransactions: allCalculatedTransactions.length,
      hybridTransactions: hybridTransactions.length,
      sampleSummaryMonths: summaries
        .filter((row) => row.year === Number(startDate.slice(0, 4)))
        .map((row) => ({
          month: row.month,
          income: row.totalIncome,
          expenses: row.totalExpenses,
          fxBased: row.fxBased,
          currency: row.currency,
        })),
    });
  }

  const fromPeriodTransactions = totalsContext.summaryFromTransactions(
    useTransactionSummary
      ? periodFilteredTransactions
      : periodTransactions,
  );

  const hybridSummary = insightsSummaryFromFinancialSummary(
    financialSummaryForDateRange({
      summaries,
      transactions: periodTransactions,
      startDate,
      endDate,
      spaceCurrency: currency,
      rateLookup: totalsContext.rateLookup,
    }),
  );

  const bucketSummary = insightsSummaryFromMonthlyBuckets(
    summaries,
    startDate,
    endDate,
  );

  const cachedDashboardFinancialSummary = useTransactionSummary
    ? undefined
    : await loadCachedDashboardFinancialSummary(spaceCode, startDate, endDate);

  const cachedDashboardSummary = cachedDashboardFinancialSummary
    ? insightsSummaryFromFinancialSummary(cachedDashboardFinancialSummary)
    : undefined;

  // IndexedDB is authoritative: prefer live period txs, then hybrid
  // (buckets + txs), then monthly buckets, then the range dashboard snapshot.
  const resolvedSummary = useTransactionSummary
    ? fromPeriodTransactions
    : resolveUnfilteredInsightsSummary({
        fromPeriodTransactions,
        hybridSummary,
        bucketSummary,
        cachedDashboardSummary,
      });

  const trendsSeriesMode = resolveCategoryTrendsSeriesMode({
    categoryName: resolvedCategoryName,
    categoryId,
    subcategoryId,
    categoryOptions,
  });

  const chartTransactions =
    periodFilteredTransactions.length > 0
      ? periodFilteredTransactions
      : useTransactionSummary
        ? periodFilteredTransactions
        : hybridTransactions;

  const monthlySpending = (
    trendsSeriesMode
      ? monthlySpendingFromTransactions(
          filteredTransactions,
          trendsRange.startDate,
          trendsRange.endDate,
          trendsSeriesMode,
          currency,
          totalsContext.rateLookup,
        )
      : summaries.length > 0
        ? monthlySpendingFromBuckets(
            hybridSummaries,
            trendsRange.startDate,
            trendsRange.endDate,
          )
        : monthlySpendingFromTransactions(
            chartTransactions,
            trendsRange.startDate,
            trendsRange.endDate,
            "all",
            currency,
            totalsContext.rateLookup,
          )
  ).map((row) => ({
    ...row,
    expenses: -Math.abs(row.expenses),
  }));

  // If bucket series is all-zero but we have local expenses, rebuild from txs
  // so Financial Trends is not a blank/flat chart while Net Income shows totals.
  const monthlySpendingHasSignal = monthlySpending.some(
    (row) =>
      Math.abs(row.income) > 0
      || Math.abs(row.expenses) > 0
      || Math.abs(row.savings) > 0,
  );

  const resolvedMonthlySpending =
    !trendsSeriesMode
    && !monthlySpendingHasSignal
    && chartTransactions.length > 0
      ? monthlySpendingFromTransactions(
          chartTransactions,
          trendsRange.startDate,
          trendsRange.endDate,
          "all",
          currency,
          totalsContext.rateLookup,
        ).map((row) => ({
          ...row,
          expenses: -Math.abs(row.expenses),
        }))
      : monthlySpending;

  const totalBudget = budgets.reduce(
    (sum, budget) => sum + toAmount(budget.amount),
    0,
  );
  const monthlyDebt = totalMonthlyDebtFromLoans(loans);

  return {
    summary: resolvedSummary,
    expenseBreakdown: expenseBreakdownFromTransactions(
      chartTransactions,
      expenseAmountForTotal,
    ),
    merchantBreakdown: merchantBreakdownFromTransactions(
      chartTransactions,
      expenseAmountForTotal,
    ),
    subcategoryBreakdown: subcategoryBreakdownFromTransactions(
      chartTransactions,
      expenseAmountForTotal,
    ),
    weeklySpending: weeklySpendingFromTransactions(
      // Backend weekly card is always "this calendar week", independent of the
      // filtered month — only category/tag filters narrow the expense set.
      filteredTransactions.length > 0 || useTransactionSummary
        ? filteredTransactions
        : allCalculatedTransactions.length > 0
          ? allCalculatedTransactions
          : chartTransactions,
      new Date(),
      expenseAmountForTotal,
    ),
    monthlySpending: resolvedMonthlySpending,
    totalBudget,
    monthlyDebt,
    healthScores: healthScoresFromLocalData({
      summary: resolvedSummary,
      periodDays: periodDaysBetween(startDate, endDate),
      totalBudget,
      monthlyDebt,
    }),
  };
};
