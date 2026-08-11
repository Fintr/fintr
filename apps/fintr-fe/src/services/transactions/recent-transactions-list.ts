import { format } from "date-fns";

import type { IndexTransaction } from "@/types/transactionTypes";

import { compareTransactionsNewestFirst } from "./local-cache";
import {
  sameSeriesFingerprint,
  seriesFingerprintKey,
} from "./resolve-delete-scope";

const transactionDateKey = (date: string): string => date.slice(0, 10);

const todayDateKey = (today: Date = new Date()): string =>
  format(today, "yyyy-MM-dd");

/**
 * True when the row is part of a repeat/installment series. Siblings may have
 * a stale `inSeries: false` (e.g. series parent); match by fingerprint.
 */
const isSeriesMember = (
  row: IndexTransaction,
  rows: IndexTransaction[],
): boolean => {
  if (row.inSeries) {
    return true;
  }

  return rows.some(
    (other) => other.inSeries && sameSeriesFingerprint(row, other),
  );
};

const pickNewestOnOrBeforeToday = (
  members: IndexTransaction[],
  todayKey: string,
): IndexTransaction | null => {
  const eligible = members.filter(
    (row) => transactionDateKey(row.date) <= todayKey,
  );
  if (eligible.length === 0) {
    return null;
  }

  return eligible.reduce((best, row) =>
    compareTransactionsNewestFirst(row, best) < 0 ? row : best,
  );
};

/**
 * Collapse repeat/installment siblings to one row per series (newest date on or
 * before today), then return the newest standalone + series rows up to `limit`.
 */
export const buildRecentTransactionsList = (
  transactions: IndexTransaction[],
  limit: number,
  options?: { today?: Date },
): IndexTransaction[] => {
  if (limit <= 0 || transactions.length === 0) {
    return [];
  }

  const todayKey = todayDateKey(options?.today);
  const seriesGroups = new Map<string, IndexTransaction[]>();
  const standalone: IndexTransaction[] = [];

  for (const row of transactions) {
    if (!isSeriesMember(row, transactions)) {
      if (transactionDateKey(row.date) <= todayKey) {
        standalone.push(row);
      }
      continue;
    }

    const key = seriesFingerprintKey(row);
    const group = seriesGroups.get(key);
    if (group) {
      group.push(row);
    } else {
      seriesGroups.set(key, [row]);
    }
  }

  const seriesRepresentatives: IndexTransaction[] = [];
  for (const members of seriesGroups.values()) {
    const representative = pickNewestOnOrBeforeToday(members, todayKey);
    if (representative) {
      seriesRepresentatives.push(representative);
    }
  }

  const combined = [...standalone, ...seriesRepresentatives].sort(
    compareTransactionsNewestFirst,
  );

  return combined.slice(0, limit);
};
