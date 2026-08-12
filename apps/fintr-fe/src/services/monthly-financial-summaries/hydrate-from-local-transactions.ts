import {
  loadAllTransactionsFromLocalIndex,
  loadScatteredTransactionSnapshotsFromMeta,
  mergeMetaTransactionSnapshotsIntoIndex,
} from "@/services/transactions/local-cache";
import { filterInsightsTransactions } from "@/services/insights/filter-insights-transactions";
import {
  buildTransactionTotalsContext,
} from "@/services/insights/transaction-space-totals";
import type { IndexTransaction } from "@/types/transactionTypes";

import {
  cacheMonthlyFinancialSummaries,
  loadCachedMonthlyFinancialSummaries,
} from "./local-cache";
import {
  isCurrentCalendarMonth,
} from "./live-current-month-summary";
import type { MonthlyFinancialSummary } from "./types";

const toSummaryNumber = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const isMonthlySummaryTotalsEmpty = (
  summary: MonthlyFinancialSummary,
): boolean => {
  const income = toSummaryNumber(summary.totalIncome);
  const expenses = toSummaryNumber(summary.totalExpenses);
  return income === 0 && expenses === 0;
};

const lastDayOfMonth = (year: number, month: number): string => {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const yearMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

const loadCalculatedTransactionsForSpace = async (
  spaceCode: string,
): Promise<IndexTransaction[]> => {
  await mergeMetaTransactionSnapshotsIntoIndex(spaceCode);

  const byId = new Map<string, IndexTransaction>();

  for (const row of [
    ...(await loadAllTransactionsFromLocalIndex(spaceCode)),
    ...(await loadScatteredTransactionSnapshotsFromMeta(spaceCode)),
  ]) {
    byId.set(row.id, row);
  }

  return filterInsightsTransactions(Array.from(byId.values()));
};

const monthTransactionKeys = (
  transactions: IndexTransaction[],
): Set<string> => {
  const keys = new Set<string>();

  for (const transaction of transactions) {
    const match = /^(\d{4})-(\d{2})/.exec(transaction.date.slice(0, 10));
    if (!match) {
      continue;
    }

    keys.add(`${match[1]}-${match[2]}`);
  }

  return keys;
};

/**
 * True when cached buckets are empty for months that have local transactions —
 * mirrors backend re-hydration when `fresh?` zero rows blocked recalculation.
 */
export const summariesNeedLocalHydration = async (
  spaceCode: string,
  summaries: MonthlyFinancialSummary[] | undefined,
  transactions?: IndexTransaction[],
): Promise<boolean> => {
  const txSource =
    transactions ?? await loadCalculatedTransactionsForSpace(spaceCode);

  if (!summaries || summaries.length === 0) {
    return true;
  }

  if (txSource.length === 0) {
    return summaries.every(isMonthlySummaryTotalsEmpty);
  }

  const monthsWithTransactions = monthTransactionKeys(txSource);
  const summaryByMonth = new Map<string, MonthlyFinancialSummary>();

  for (const summary of summaries) {
    summaryByMonth.set(yearMonthKey(summary.year, summary.month), summary);
  }

  for (const monthKey of monthsWithTransactions) {
    const summary = summaryByMonth.get(monthKey);

    if (!summary || isMonthlySummaryTotalsEmpty(summary)) {
      return true;
    }
  }

  return summaries.some((summary) => {
    if (!isMonthlySummaryTotalsEmpty(summary)) {
      return false;
    }

    return monthsWithTransactions.has(yearMonthKey(summary.year, summary.month));
  });
};

export const mergeSummariesPreferNonEmpty = (
  preferred: MonthlyFinancialSummary[],
  fallback: MonthlyFinancialSummary[],
): MonthlyFinancialSummary[] => {
  const map = new Map<string, MonthlyFinancialSummary>();

  for (const row of fallback) {
    map.set(yearMonthKey(row.year, row.month), row);
  }

  for (const row of preferred) {
    const key = yearMonthKey(row.year, row.month);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, row);
      continue;
    }

    if (
      isMonthlySummaryTotalsEmpty(existing)
      && !isMonthlySummaryTotalsEmpty(row)
    ) {
      map.set(key, row);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) {
      return a.year - b.year;
    }

    return a.month - b.month;
  });
};

const upsertMonthSummaryFromTransactions = (
  summaries: MonthlyFinancialSummary[],
  year: number,
  month: number,
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
  },
  currency: string,
): MonthlyFinancialSummary[] => {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = lastDayOfMonth(year, month);
  const hasTotals =
    totals.totalIncome > 0 || totals.totalExpenses > 0;
  const isCurrent = isCurrentCalendarMonth(year, month);
  const index = summaries.findIndex(
    (row) => row.year === year && row.month === month,
  );
  const existing = index >= 0 ? summaries[index] : undefined;
  const existingEmpty = !existing || isMonthlySummaryTotalsEmpty(existing);

  if (!hasTotals && !isCurrent && existing && !existingEmpty) {
    return summaries;
  }

  if (!hasTotals && !isCurrent && existingEmpty) {
    return summaries;
  }

  const nextRow: MonthlyFinancialSummary = {
    id: existing?.id ?? `local:${yearMonthKey(year, month)}`,
    year,
    month,
    currency: existing?.currency ?? currency,
    fxBased: true,
    calculatedAt: new Date().toISOString(),
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    netSavings: totals.netSavings,
    savingsPercentage:
      totals.totalIncome > 0
        ? Number(((totals.netSavings / totals.totalIncome) * 100).toFixed(2))
        : 0,
    monthStartDate: monthStart,
    monthEndDate: monthEnd,
  };

  if (index < 0) {
    return [...summaries, nextRow];
  }

  const next = [...summaries];
  next[index] = nextRow;
  return next;
};

/**
 * Recompute month buckets from calculated local transactions and persist to
 * IndexedDB — used after bootstrap indexes transactions when API rows are stale zeros.
 */
export const hydrateMonthlyFinancialSummariesFromLocalTransactions = async (
  spaceCode: string,
  options?: {
    currency?: string;
    existingSummaries?: MonthlyFinancialSummary[];
    transactions?: IndexTransaction[];
  },
): Promise<MonthlyFinancialSummary[]> => {
  if (!spaceCode) {
    return [];
  }

  const currency = options?.currency ?? "PHP";
  const existing =
    options?.existingSummaries
    ?? (await loadCachedMonthlyFinancialSummaries(spaceCode))
    ?? [];
  const transactions =
    options?.transactions ?? await loadCalculatedTransactionsForSpace(spaceCode);

  if (transactions.length === 0) {
    return existing;
  }

  const totalsContext = await buildTransactionTotalsContext({
    spaceCode,
    spaceCurrency: currency,
    transactions,
  });

  const grouped = new Map<string, IndexTransaction[]>();

  for (const transaction of transactions) {
    const match = /^(\d{4})-(\d{2})/.exec(transaction.date.slice(0, 10));
    if (!match) {
      continue;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const key = yearMonthKey(year, month);
    const bucket = grouped.get(key) ?? [];
    bucket.push(transaction);
    grouped.set(key, bucket);
  }

  let next = [...existing];

  for (const [key, monthTransactions] of grouped) {
    const [year, month] = key.split("-").map(Number);
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = lastDayOfMonth(year, month);
    const totals = totalsContext.aggregateTotalsInSpaceForRange(
      monthTransactions,
      monthStart,
      monthEnd,
    );
    next = upsertMonthSummaryFromTransactions(
      next,
      year,
      month,
      totals,
      currency,
    );
  }

  await cacheMonthlyFinancialSummaries(spaceCode, next);
  return next;
};
