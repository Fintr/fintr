import { getMonthDateRange } from "@/utils/dateUtils";
import type { TransactionsPage } from "@/types/transactionTypes";

/** Wide date range used for the one-time offline bootstrap (all historical data). */
export const OFFLINE_BOOTSTRAP_START_DATE = "2000-01-01";
export const OFFLINE_BOOTSTRAP_END_DATE = "2099-12-31";

export const offlineBootstrapDateRange = (): {
  startDate: string;
  endDate: string;
} => ({
  startDate: OFFLINE_BOOTSTRAP_START_DATE,
  endDate: OFFLINE_BOOTSTRAP_END_DATE,
});

export const isOfflineBootstrapDateRange = (
  startDate?: string,
  endDate?: string,
): boolean =>
  startDate === OFFLINE_BOOTSTRAP_START_DATE &&
  endDate === OFFLINE_BOOTSTRAP_END_DATE;

export type MonthDateRange = {
  startDate: string;
  endDate: string;
};

const toYearMonth = (
  isoDate: string,
): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})/.exec(isoDate.slice(0, 10));
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

/** Earliest YYYY-MM-DD across cached/bootstrap transaction pages. */
export const earliestTransactionDate = (
  pages: TransactionsPage[],
): string | undefined => {
  let earliest: string | undefined;

  for (const page of pages) {
    for (const transaction of page.transactions) {
      const date = String(transaction.date ?? "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        continue;
      }
      if (!earliest || date < earliest) {
        earliest = date;
      }
    }
  }

  return earliest;
};

/**
 * Inclusive calendar months from `fromDate` through `toDate` (defaults to today).
 */
export const monthRangesInclusive = (
  fromDate: string,
  toDate?: string,
): MonthDateRange[] => {
  const start = toYearMonth(fromDate);
  const end = toYearMonth(
    toDate ?? new Date().toISOString().slice(0, 10),
  );

  if (!start || !end) {
    return [];
  }

  const ranges: MonthDateRange[] = [];
  let year = start.year;
  let month = start.month;

  while (year < end.year || (year === end.year && month <= end.month)) {
    ranges.push(getMonthDateRange(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return ranges;
};

/**
 * Months to hydrate for dashboard/budgets offline reads: from the first
 * transaction month through the current month (or just current month if empty).
 */
export const monthRangesForOfflineHydration = (
  transactionPages: TransactionsPage[],
): MonthDateRange[] => {
  const earliest = earliestTransactionDate(transactionPages);
  const today = new Date().toISOString().slice(0, 10);

  if (!earliest) {
    return monthRangesInclusive(today, today);
  }

  return monthRangesInclusive(earliest, today);
};
