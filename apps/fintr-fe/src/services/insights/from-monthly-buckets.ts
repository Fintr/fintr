import { combineMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/combine";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import type { InsightsSummary, MonthlySpending } from "./types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

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

const yearMonthKey = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

const lastDayOfMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const formatYmd = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const transactionDateKey = (date: string): string => date.slice(0, 10);

const transactionInDateRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean => {
  const key = transactionDateKey(date);
  return key >= startDate && key <= endDate;
};

const isExpense = (tx: IndexTransaction): boolean =>
  tx.type === CombinedTransactionTypeEnum.EXPENSE;

export type MonthSegment =
  | { kind: "full_month"; year: number; month: number }
  | { kind: "partial"; startDate: string; endDate: string };

/**
 * Split a date range into full calendar months (bucket-eligible) and partial edge slices.
 * e.g. Aug 1 – Sep 5 → [full Aug, partial Sep 1–5]
 */
export const splitDateRangeIntoMonthSegments = (
  startDate: string,
  endDate: string,
): MonthSegment[] => {
  const start = parseYearMonth(startDate);
  const end = parseYearMonth(endDate);

  if (!start || !end) {
    return [{ kind: "partial", startDate, endDate }];
  }

  const segments: MonthSegment[] = [];
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    const monthStart = formatYmd(year, month, 1);
    const monthEnd = formatYmd(year, month, lastDayOfMonth(year, month));

    const segmentStart = monthStart < startDate ? startDate : monthStart;
    const segmentEnd = monthEnd > endDate ? endDate : monthEnd;

    const isFullMonth =
      segmentStart === monthStart
      && segmentEnd === monthEnd;

    if (isFullMonth) {
      segments.push({ kind: "full_month", year, month });
    } else {
      segments.push({
        kind: "partial",
        startDate: segmentStart,
        endDate: segmentEnd,
      });
    }

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return segments;
};

const findSummaryForMonth = (
  summaries: MonthlyFinancialSummary[],
  year: number,
  month: number,
): MonthlyFinancialSummary | undefined =>
  summaries.find((summary) => summary.year === year && summary.month === month);

export const summaryFromTransactions = (
  transactions: IndexTransaction[],
): InsightsSummary => {
  const income = transactions
    .filter((tx) => tx.type === CombinedTransactionTypeEnum.INCOME)
    .reduce((sum, tx) => sum + toNumber(tx.amount), 0);
  const expenses = transactions
    .filter(isExpense)
    .reduce((sum, tx) => sum + Math.abs(toNumber(tx.amount)), 0);

  return {
    totalIncome: income,
    totalExpenses: expenses,
    netSavings: income - expenses,
  };
};

const summaryFromTransactionSlice = (
  transactions: IndexTransaction[],
  startDate: string,
  endDate: string,
): InsightsSummary => {
  const slice = transactions.filter((tx) =>
    transactionInDateRange(tx.date, startDate, endDate),
  );

  return summaryFromTransactions(slice);
};

/**
 * Unfiltered insights summary: full months from buckets, partial edge months from transactions.
 */
export const insightsSummaryHybrid = (params: {
  summaries: MonthlyFinancialSummary[];
  transactions: IndexTransaction[];
  startDate: string;
  endDate: string;
}): InsightsSummary => {
  const { summaries, transactions, startDate, endDate } = params;
  const segments = splitDateRangeIntoMonthSegments(startDate, endDate);

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const segment of segments) {
    if (segment.kind === "full_month") {
      const bucket = findSummaryForMonth(
        summaries,
        segment.year,
        segment.month,
      );
      totalIncome += toNumber(bucket?.totalIncome);
      totalExpenses += toNumber(bucket?.totalExpenses);
    } else {
      const partial = summaryFromTransactionSlice(
        transactions,
        segment.startDate,
        segment.endDate,
      );
      totalIncome += partial.totalIncome;
      totalExpenses += partial.totalExpenses;
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netSavings: totalIncome - totalExpenses,
  };
};

/** Insights summary totals from monthly FX buckets (no category filter). */
export const insightsSummaryFromMonthlyBuckets = (
  summaries: MonthlyFinancialSummary[],
  startDate: string,
  endDate: string,
): InsightsSummary => {
  const combined = combineMonthlyFinancialSummaries(
    summaries,
    startDate,
    endDate,
  );

  return {
    totalIncome: Number.parseFloat(combined.totalIncome) || 0,
    totalExpenses: Number.parseFloat(combined.totalExpenses) || 0,
    netSavings: Number.parseFloat(combined.netSavings) || 0,
  };
};

/**
 * Six calendar months ending on the filtered month (inclusive).
 * e.g. February filter → Sep…Feb, not through "today".
 */
export const financialTrendsDateRange = (
  endDate: string,
  monthCount: number = 6,
): { startDate: string; endDate: string } => {
  const end = parseYearMonth(endDate);
  if (!end) {
    const today = new Date().toISOString().slice(0, 10);
    return { startDate: today, endDate: today };
  }

  let year = end.year;
  let month = end.month - (monthCount - 1);
  while (month <= 0) {
    month += 12;
    year -= 1;
  }

  const lastDay = new Date(Date.UTC(end.year, end.month, 0)).getUTCDate();

  return {
    startDate: `${year}-${String(month).padStart(2, "0")}-01`,
    endDate: `${end.year}-${String(end.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
};

/** Monthly spending series for charts from the same buckets. */
export const monthlySpendingFromBuckets = (
  summaries: MonthlyFinancialSummary[],
  startDate: string,
  endDate: string,
): MonthlySpending[] => {
  const start = parseYearMonth(startDate);
  const end = parseYearMonth(endDate);
  if (!start || !end) {
    return [];
  }

  const startKey = yearMonthKey(start.year, start.month);
  const endKey = yearMonthKey(end.year, end.month);

  return summaries
    .filter((summary) => {
      const key = yearMonthKey(summary.year, summary.month);
      return key >= startKey && key <= endKey;
    })
    .sort((a, b) => {
      if (a.year !== b.year) {
        return a.year - b.year;
      }
      return a.month - b.month;
    })
    .map((summary) => {
      const income = toNumber(summary.totalIncome);
      const expenses = toNumber(summary.totalExpenses);
      return {
        // Match transformMonthlySpending short month labels.
        month: MONTH_LABELS[summary.month - 1],
        income,
        expenses,
        savings: income - expenses,
      };
    });
};

export type MonthlySpendingSeriesMode = "all" | "expense" | "income";

const eachMonthInRange = (
  startDate: string,
  endDate: string,
): { year: number; month: number }[] => {
  const start = parseYearMonth(startDate);
  const end = parseYearMonth(endDate);
  if (!start || !end) {
    return [];
  }

  const months: { year: number; month: number }[] = [];
  let year = start.year;
  let month = start.month;
  const endKey = yearMonthKey(end.year, end.month);

  while (yearMonthKey(year, month) <= endKey) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
};

/**
 * Monthly spending series from transactions (category/tag filtered trends).
 * When seriesMode is expense or income, amounts land on that series only and savings stay 0.
 */
export const monthlySpendingFromTransactions = (
  transactions: IndexTransaction[],
  startDate: string,
  endDate: string,
  seriesMode: MonthlySpendingSeriesMode = "all",
): MonthlySpending[] => {
  const months = eachMonthInRange(startDate, endDate);
  if (months.length === 0) {
    return [];
  }

  const incomeByMonth = new Map<string, number>();
  const expensesByMonth = new Map<string, number>();

  for (const tx of transactions) {
    if (!transactionInDateRange(tx.date, startDate, endDate)) {
      continue;
    }

    const parsed = parseYearMonth(tx.date);
    if (!parsed) {
      continue;
    }

    const key = yearMonthKey(parsed.year, parsed.month);
    const amount = Math.abs(toNumber(tx.amount));

    if (seriesMode === "expense") {
      expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + amount);
      continue;
    }

    if (seriesMode === "income") {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
      continue;
    }

    if (tx.type === CombinedTransactionTypeEnum.INCOME) {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + amount);
      continue;
    }

    if (isExpense(tx)) {
      expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + amount);
    }
  }

  return months.map(({ year, month }) => {
    const key = yearMonthKey(year, month);
    const income = incomeByMonth.get(key) ?? 0;
    const expenses = expensesByMonth.get(key) ?? 0;

    return {
      month: MONTH_LABELS[month - 1],
      income,
      expenses,
      savings: seriesMode === "all" ? income - expenses : 0,
    };
  });
};
