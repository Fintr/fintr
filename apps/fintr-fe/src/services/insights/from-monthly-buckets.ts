import { combineMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/combine";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { getLocalIsoDateKey } from "@/utils/dateUtils";

import type { ExchangeRateLookup } from "./space-currency-amount";
import { summaryFromTransactionsForSpace } from "./transaction-space-totals";
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

const monthStartDate = (year: number, month: number): string =>
  formatYmd(year, month, 1);

const monthEndDate = (year: number, month: number): string =>
  formatYmd(year, month, lastDayOfMonth(year, month));

/**
 * Mirrors MonthlyFinancialSummaries::Support::DateRangePieces (backend).
 * Single-calendar-month ranges are one partial slice (live transactions), not bucket lookups.
 */
export type DateRangePieces = {
  firstStart: string | null;
  firstEnd: string | null;
  lastStart: string | null;
  lastEnd: string | null;
  fullMonthDates: string[];
};

export const dateRangePieces = (
  startDate: string,
  endDate: string,
): DateRangePieces => {
  const startYm = parseYearMonth(startDate);
  const endYm = parseYearMonth(endDate);

  if (!startYm || !endYm) {
    return {
      firstStart: startDate,
      firstEnd: endDate,
      lastStart: null,
      lastEnd: null,
      fullMonthDates: [],
    };
  }

  const firstMonthStart = monthStartDate(startYm.year, startYm.month);
  const lastMonthStart = monthStartDate(endYm.year, endYm.month);
  const lastMonthEnd = monthEndDate(endYm.year, endYm.month);

  let firstStart: string | null = null;
  let firstEnd: string | null = null;
  let lastStart: string | null = null;
  let lastEnd: string | null = null;
  const fullMonthDates: string[] = [];

  if (firstMonthStart === lastMonthStart) {
    firstStart = startDate;
    firstEnd = endDate;
  } else {
    if (startDate !== firstMonthStart) {
      firstStart = startDate;
      firstEnd = monthEndDate(startYm.year, startYm.month);
    }

    let year = startYm.year;
    let month = startYm.month + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }

    while (year < endYm.year || (year === endYm.year && month < endYm.month)) {
      fullMonthDates.push(monthStartDate(year, month));
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    if (startDate === firstMonthStart) {
      fullMonthDates.unshift(firstMonthStart);
    }

    if (endDate === lastMonthEnd) {
      fullMonthDates.push(lastMonthStart);
    }

    if (endDate !== lastMonthEnd) {
      lastStart = lastMonthStart;
      lastEnd = endDate;
    }
  }

  return {
    firstStart,
    firstEnd,
    lastStart,
    lastEnd,
    fullMonthDates,
  };
};

const transactionDateKey = (date: string): string => date.slice(0, 10);

const transactionInDateRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean => {
  const key = transactionDateKey(date);
  return key >= startDate && key <= endDate;
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
  spaceCurrency = "PHP",
  rateLookup?: ExchangeRateLookup,
): InsightsSummary =>
  summaryFromTransactionsForSpace(
    transactions,
    spaceCurrency,
    rateLookup,
  );

const summaryFromTransactionSlice = (
  transactions: IndexTransaction[],
  startDate: string,
  endDate: string,
  spaceCurrency?: string,
  rateLookup?: ExchangeRateLookup,
): InsightsSummary => {
  const slice = transactions.filter((tx) =>
    transactionInDateRange(tx.date, startDate, endDate),
  );

  return summaryFromTransactions(
    slice,
    spaceCurrency ?? "PHP",
    rateLookup,
  );
};

const isBucketTotalsEmpty = (
  income: number,
  expenses: number,
): boolean => income === 0 && expenses === 0;

const resolveMonthTotals = (
  summaries: MonthlyFinancialSummary[],
  transactions: IndexTransaction[],
  year: number,
  month: number,
  spaceCurrency?: string,
  rateLookup?: ExchangeRateLookup,
): { totalIncome: number; totalExpenses: number } => {
  const monthStart = monthStartDate(year, month);
  const monthEnd = monthEndDate(year, month);
  const partial = summaryFromTransactionSlice(
    transactions,
    monthStart,
    monthEnd,
    spaceCurrency,
    rateLookup,
  );

  const bucket = findSummaryForMonth(summaries, year, month);
  const bucketIncome = bucket ? toNumber(bucket.totalIncome) : 0;
  const bucketExpenses = bucket ? toNumber(bucket.totalExpenses) : 0;
  const bucketHasTotals = !isBucketTotalsEmpty(bucketIncome, bucketExpenses);
  const partialHasTotals =
    partial.totalIncome > 0 || partial.totalExpenses > 0;
  const bucketIsFresh =
    bucket != null && isMonthlySummaryBucketFresh(bucket, spaceCurrency);

  if (isCurrentCalendarMonth(year, month)) {
    if (partialHasTotals) {
      return {
        totalIncome: partial.totalIncome,
        totalExpenses: partial.totalExpenses,
      };
    }

    if (bucketIsFresh && bucketHasTotals) {
      return {
        totalIncome: bucketIncome,
        totalExpenses: bucketExpenses,
      };
    }

    return {
      totalIncome: partial.totalIncome,
      totalExpenses: partial.totalExpenses,
    };
  }

  if (bucketIsFresh && bucketHasTotals) {
    return {
      totalIncome: bucketIncome,
      totalExpenses: bucketExpenses,
    };
  }

  return {
    totalIncome: partial.totalIncome,
    totalExpenses: partial.totalExpenses,
  };
};

const addPartialSummary = (
  summaries: MonthlyFinancialSummary[],
  transactions: IndexTransaction[],
  start: string | null,
  end: string | null,
  totals: { totalIncome: number; totalExpenses: number },
  spaceCurrency?: string,
  rateLookup?: ExchangeRateLookup,
): void => {
  if (!start || !end) {
    return;
  }

  const startYm = parseYearMonth(start);
  const endYm = parseYearMonth(end);

  if (
    startYm
    && endYm
    && startYm.year === endYm.year
    && startYm.month === endYm.month
  ) {
    const monthStart = monthStartDate(startYm.year, startYm.month);
    const monthEnd = monthEndDate(startYm.year, startYm.month);
    const isFullCalendarMonth = start === monthStart && end === monthEnd;

    if (isFullCalendarMonth) {
      const monthTotals = resolveMonthTotals(
        summaries,
        transactions,
        startYm.year,
        startYm.month,
        spaceCurrency,
        rateLookup,
      );
      totals.totalIncome += monthTotals.totalIncome;
      totals.totalExpenses += monthTotals.totalExpenses;
      return;
    }
  }

  const partial = summaryFromTransactionSlice(
    transactions,
    start,
    end,
    spaceCurrency,
    rateLookup,
  );
  totals.totalIncome += partial.totalIncome;
  totals.totalExpenses += partial.totalExpenses;
};

const addFullMonthSummary = (
  summaries: MonthlyFinancialSummary[],
  transactions: IndexTransaction[],
  monthStart: string,
  totals: { totalIncome: number; totalExpenses: number },
  spaceCurrency?: string,
  rateLookup?: ExchangeRateLookup,
): void => {
  const ym = parseYearMonth(monthStart);
  if (!ym) {
    return;
  }

  const monthTotals = resolveMonthTotals(
    summaries,
    transactions,
    ym.year,
    ym.month,
    spaceCurrency,
    rateLookup,
  );
  totals.totalIncome += monthTotals.totalIncome;
  totals.totalExpenses += monthTotals.totalExpenses;
};

const normalizeSummaryCurrency = (code: string | undefined): string =>
  (code ?? "PHP").trim().toUpperCase();

const isMonthlySummaryBucketFresh = (
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

const isCurrentCalendarMonth = (
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
 * Unfiltered insights summary: mirrors TotalsInSpaceForRange — partial edges and
 * single-month filters from transactions; interior full months from FX buckets.
 */
export const insightsSummaryHybrid = (params: {
  summaries: MonthlyFinancialSummary[];
  transactions: IndexTransaction[];
  startDate: string;
  endDate: string;
  spaceCurrency?: string;
  rateLookup?: ExchangeRateLookup;
}): InsightsSummary => {
  const { summaries, transactions, startDate, endDate, spaceCurrency, rateLookup } =
    params;
  const pieces = dateRangePieces(startDate, endDate);

  const totals = { totalIncome: 0, totalExpenses: 0 };

  addPartialSummary(
    summaries,
    transactions,
    pieces.firstStart,
    pieces.firstEnd,
    totals,
    spaceCurrency,
    rateLookup,
  );
  addPartialSummary(
    summaries,
    transactions,
    pieces.lastStart,
    pieces.lastEnd,
    totals,
    spaceCurrency,
    rateLookup,
  );

  for (const monthStart of pieces.fullMonthDates) {
    addFullMonthSummary(
      summaries,
      transactions,
      monthStart,
      totals,
      spaceCurrency,
      rateLookup,
    );
  }

  return {
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    netSavings: totals.totalIncome - totals.totalExpenses,
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

  const byMonth = new Map<string, MonthlyFinancialSummary>();
  for (const summary of summaries) {
    byMonth.set(yearMonthKey(summary.year, summary.month), summary);
  }

  return eachMonthInRange(startDate, endDate).map(({ year, month }) => {
    const summary = byMonth.get(yearMonthKey(year, month));
    const income = toNumber(summary?.totalIncome);
    const expenses = toNumber(summary?.totalExpenses);
    return {
      // Match transformMonthlySpending short month labels.
      month: MONTH_LABELS[month - 1],
      income,
      expenses,
      savings: income - expenses,
    };
  });
};

export type MonthlySpendingSeriesMode = "all" | "expense" | "income";

/**
 * Monthly spending series from transactions (category/tag filtered trends).
 * When seriesMode is expense or income, amounts land on that series only and savings stay 0.
 */
export const monthlySpendingFromTransactions = (
  transactions: IndexTransaction[],
  startDate: string,
  endDate: string,
  seriesMode: MonthlySpendingSeriesMode = "all",
  spaceCurrency = "PHP",
  rateLookup?: ExchangeRateLookup,
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
    const spaceAmount = summaryFromTransactionsForSpace(
      [tx],
      spaceCurrency,
      rateLookup,
    );
    const incomeAmount = spaceAmount.totalIncome;
    const expenseAmount = spaceAmount.totalExpenses;

    if (seriesMode === "expense") {
      expensesByMonth.set(
        key,
        (expensesByMonth.get(key) ?? 0) + expenseAmount,
      );
      continue;
    }

    if (seriesMode === "income") {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + incomeAmount);
      continue;
    }

    if (tx.type === CombinedTransactionTypeEnum.INCOME) {
      incomeByMonth.set(key, (incomeByMonth.get(key) ?? 0) + incomeAmount);
      continue;
    }

    if (isExpense(tx)) {
      expensesByMonth.set(
        key,
        (expensesByMonth.get(key) ?? 0) + expenseAmount,
      );
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
