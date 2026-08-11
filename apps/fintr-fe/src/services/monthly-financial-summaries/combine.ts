import type { FinancialSummary } from "@/types/spaceTypes";

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

/**
 * Sum monthly summary buckets that fall fully inside [startDate, endDate].
 * Matches the backend full-month path used by DateRangeSummary / TotalsInSpaceForRange.
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
        summary.calculatedAt &&
        (!latestCalculatedAt || summary.calculatedAt > latestCalculatedAt)
      ) {
        latestCalculatedAt = summary.calculatedAt;
      }
    }
  }

  const netSavings = totalIncome - totalExpenses;
  const savingsPercentage =
    totalIncome > 0 ? Number(((netSavings / totalIncome) * 100).toFixed(2)) : 0;

  return {
    totalIncome: String(Number(totalIncome.toFixed(2))),
    totalExpenses: String(Number(totalExpenses.toFixed(2))),
    netSavings: String(Number(netSavings.toFixed(2))),
    savingsPercentage: String(savingsPercentage),
    // Stable fallback — avoid new Date() so consumers don't thrash on identity.
    calculatedAt: latestCalculatedAt || "",
  };
};
