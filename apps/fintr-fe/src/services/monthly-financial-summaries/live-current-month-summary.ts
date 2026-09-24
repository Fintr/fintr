import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { getLocalIsoDateKey } from "@/utils/dateUtils";

const toNumber = (value: number | string | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const parseYearMonth = (
  isoDate: string,
): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate.slice(0, 10));
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
};

const monthStartDate = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}-01`;

const monthEndDate = (year: number, month: number): string => {
  const day = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

import { summaryFromTransactionsForSpace } from "@/services/insights/transaction-space-totals";

const transactionInDateRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean => {
  const key = date.slice(0, 10);
  return key >= startDate && key <= endDate;
};

/** Mirrors MonthlyFinancialSummary#fresh? on the backend. */
const normalizeSummaryCurrency = (code: string | undefined): string =>
  (code ?? "PHP").trim().toUpperCase();

export const isMonthlySummaryBucketFresh = (
  summary: MonthlyFinancialSummary,
  spaceCurrency?: string,
): boolean => {
  if (!summary.fxBased) {
    return false;
  }

  if (!spaceCurrency) {
    return true;
  }

  return (
    normalizeSummaryCurrency(summary.currency)
    === normalizeSummaryCurrency(spaceCurrency)
  );
};

export const isCurrentCalendarMonth = (
  year: number,
  month: number,
  today = getLocalIsoDateKey(),
): boolean => {
  const current = parseYearMonth(today);
  if (!current) {
    return false;
  }

  return current.year === year && current.month === month;
};

/**
 * Current calendar month totals from calculated transactions only.
 * Replaces any cached bucket so insights match backend live aggregation.
 */
export const upsertLiveCurrentMonthSummary = (params: {
  summaries: MonthlyFinancialSummary[];
  transactions: IndexTransaction[];
  currency?: string;
  today?: string;
}): MonthlyFinancialSummary[] => {
  const { summaries, transactions, currency = "PHP", today = getLocalIsoDateKey() } =
    params;
  const current = parseYearMonth(today);
  if (!current) {
    return summaries;
  }

  const monthStart = monthStartDate(current.year, current.month);
  const monthEnd = monthEndDate(current.year, current.month);
  const slice = transactions.filter((transaction) =>
    transactionInDateRange(transaction.date, monthStart, monthEnd),
  );
  const totals = summaryFromTransactionsForSpace(slice, currency);

  const liveSummary: MonthlyFinancialSummary = {
    id: `live:${current.year}-${String(current.month).padStart(2, "0")}`,
    year: current.year,
    month: current.month,
    currency,
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

  const existing = summaries.find(
    (summary) => summary.year === current.year && summary.month === current.month,
  );
  const existingIncome = existing ? toNumber(existing.totalIncome) : 0;
  const existingExpenses = existing ? toNumber(existing.totalExpenses) : 0;
  const existingHasTotals = existingIncome > 0 || existingExpenses > 0;
  const liveHasTotals =
    totals.totalIncome > 0 || totals.totalExpenses > 0;

  if (!liveHasTotals && existingHasTotals) {
    return summaries;
  }

  const withoutCurrent = summaries.filter(
    (summary) =>
      summary.year !== current.year || summary.month !== current.month,
  );

  return [...withoutCurrent, liveSummary];
};
