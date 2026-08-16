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

const monthKeyFromDate = (date: string): string | null => {
  const match = /^(\d{4})-(\d{2})/.exec(date.slice(0, 10));
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}`;
};

const isIncomeTransaction = (transaction: IndexTransaction): boolean => {
  const type = String(transaction.type ?? "").trim().toLowerCase();
  return type.includes("income");
};

const isExpenseTransaction = (transaction: IndexTransaction): boolean => {
  const type = String(transaction.type ?? "").trim().toLowerCase();
  return type.includes("expense");
};

const monthTotalsFromTransactions = (
  transactions: IndexTransaction[],
): Map<string, { totalIncome: number; totalExpenses: number }> => {
  const totals = new Map<string, { totalIncome: number; totalExpenses: number }>();

  for (const transaction of transactions) {
    const key = monthKeyFromDate(transaction.date);
    if (!key) {
      continue;
    }

    const amount = Math.abs(toSummaryNumber(transaction.amount));
    const current = totals.get(key) ?? { totalIncome: 0, totalExpenses: 0 };

    if (isIncomeTransaction(transaction)) {
      current.totalIncome += amount;
    } else if (isExpenseTransaction(transaction)) {
      current.totalExpenses += amount;
    }

    totals.set(key, current);
  }

  return totals;
};

const totalsDisagree = (left: number, right: number): boolean =>
  Math.abs(left - right) > 0.01;

/**
 * True when cached buckets are missing, empty, or disagree with IndexedDB
 * transactions for that month.
 */
export const summariesNeedLocalHydration = async (
  spaceCode: string,
  summaries: MonthlyFinancialSummary[] | undefined,
  transactions?: IndexTransaction[],
): Promise<boolean> => {
  const txSource =
    transactions ?? await loadCalculatedTransactionsForSpace(spaceCode);

  if (!summaries || summaries.length === 0) {
    return txSource.length > 0;
  }

  if (txSource.length === 0) {
    return summaries.every(isMonthlySummaryTotalsEmpty);
  }

  const monthTotals = monthTotalsFromTransactions(txSource);
  const summaryByMonth = new Map<string, MonthlyFinancialSummary>();

  for (const summary of summaries) {
    summaryByMonth.set(yearMonthKey(summary.year, summary.month), summary);
  }

  for (const [monthKey, totals] of monthTotals) {
    const summary = summaryByMonth.get(monthKey);

    if (!summary || isMonthlySummaryTotalsEmpty(summary)) {
      return true;
    }

    if (
      totalsDisagree(totals.totalIncome, toSummaryNumber(summary.totalIncome))
      || totalsDisagree(
        totals.totalExpenses,
        toSummaryNumber(summary.totalExpenses),
      )
    ) {
      return true;
    }
  }

  return false;
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

  const totalIncome = Number(totals.totalIncome.toFixed(2));
  const totalExpenses = Number(totals.totalExpenses.toFixed(2));
  const netSavings = Number((totalIncome - totalExpenses).toFixed(2));
  const nextRow: MonthlyFinancialSummary = {
    id: existing?.id ?? `local:${yearMonthKey(year, month)}`,
    year,
    month,
    currency: existing?.currency ?? currency,
    fxBased: true,
    calculatedAt: new Date().toISOString(),
    totalIncome,
    totalExpenses,
    netSavings,
    savingsPercentage:
      totalIncome > 0
        ? Number(((netSavings / totalIncome) * 100).toFixed(2))
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
 * Recompute month buckets from calculated IndexedDB transactions and persist.
 * IndexedDB rows win over stale backend snapshots.
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
    const key = monthKeyFromDate(transaction.date);
    if (!key) {
      continue;
    }

    const bucket = grouped.get(key) ?? [];
    bucket.push(transaction);
    grouped.set(key, bucket);
  }

  let next = [...existing];

  for (const [key, monthTransactions] of grouped) {
    const [year, month] = key.split("-").map(Number);
    // Use per-row IndexedDB list amounts (same as the Transactions tab), not
    // booked-FX grouping which drops rows when a cached rate is missing.
    const totals = totalsContext.summaryFromTransactions(
      monthTransactions,
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
