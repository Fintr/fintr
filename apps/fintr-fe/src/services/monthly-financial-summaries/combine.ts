import type { FinancialSummary } from "@/types/spaceTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

import type { ExchangeRateLookup } from "@/services/insights/space-currency-amount";
import { insightsSummaryHybrid } from "@/services/insights/from-monthly-buckets";

import type { MonthlyFinancialSummary } from "./types";

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

const yearMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

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

const summaryToFinancialSummary = (
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    calculatedAt?: string;
  },
): FinancialSummary => {
  const latestCalculatedAt = totals.calculatedAt ?? "";

  const savingsPercentage =
    totals.totalIncome > 0
      ? Number(((totals.netSavings / totals.totalIncome) * 100).toFixed(2))
      : 0;

  return {
    totalIncome: String(Number(totals.totalIncome.toFixed(2))),
    totalExpenses: String(Number(totals.totalExpenses.toFixed(2))),
    netSavings: String(Number(totals.netSavings.toFixed(2))),
    savingsPercentage: String(savingsPercentage),
    calculatedAt: latestCalculatedAt || "",
  };
};

/**
 * Sum monthly buckets for [startDate, endDate], mirroring backend TotalsInSpaceForRange
 * when transactions are unavailable.
 */
export const combineMonthlyFinancialSummaries = (
  summaries: MonthlyFinancialSummary[],
  startDate: string,
  endDate: string,
): FinancialSummary => {
  const start = parseYearMonth(startDate);
  const end = parseYearMonth(endDate);

  let totalIncome = 0;
  let totalExpenses = 0;
  let latestCalculatedAt = "";

  if (start && end) {
    const startKey = yearMonthKey(start.year, start.month);
    const endKey = yearMonthKey(end.year, end.month);

    for (const summary of summaries) {
      const key = yearMonthKey(summary.year, summary.month);
      if (key < startKey || key > endKey) {
        continue;
      }

      totalIncome += toNumber(summary.totalIncome);
      totalExpenses += toNumber(summary.totalExpenses);
      if (
        summary.calculatedAt
        && (!latestCalculatedAt || summary.calculatedAt > latestCalculatedAt)
      ) {
        latestCalculatedAt = summary.calculatedAt;
      }
    }
  }

  return summaryToFinancialSummary({
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
    calculatedAt: latestCalculatedAt,
  });
};

/**
 * Dashboard / insights summary for a date range — buckets plus transaction fallback
 * (mirrors CreateSummaryStructure + TotalsInSpaceForRange hybrid path).
 */
export const financialSummaryForDateRange = (params: {
  summaries: MonthlyFinancialSummary[];
  transactions: IndexTransaction[];
  startDate: string;
  endDate: string;
  spaceCurrency?: string;
  rateLookup?: ExchangeRateLookup;
}): FinancialSummary => {
  const {
    summaries,
    transactions,
    startDate,
    endDate,
    spaceCurrency = "PHP",
    rateLookup,
  } = params;

  const hybrid = insightsSummaryHybrid({
    summaries,
    transactions,
    startDate,
    endDate,
    spaceCurrency,
    rateLookup,
  });

  let latestCalculatedAt = "";
  const start = parseYearMonth(startDate);
  const end = parseYearMonth(endDate);

  if (start && end) {
    const startKey = yearMonthKey(start.year, start.month);
    const endKey = yearMonthKey(end.year, end.month);

    for (const summary of summaries) {
      const key = yearMonthKey(summary.year, summary.month);
      if (key < startKey || key > endKey) {
        continue;
      }

      if (
        summary.calculatedAt
        && (!latestCalculatedAt || summary.calculatedAt > latestCalculatedAt)
      ) {
        latestCalculatedAt = summary.calculatedAt;
      }
    }
  }

  return summaryToFinancialSummary({
    totalIncome: hybrid.totalIncome,
    totalExpenses: hybrid.totalExpenses,
    netSavings: hybrid.netSavings,
    calculatedAt: latestCalculatedAt,
  });
};
