import { loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import { loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import {
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  loadAllCachedTransactionsForInsights,
  loadCachedTransactionsInRange,
  loadScatteredTransactionSnapshotsFromMeta,
  mergeIndexTransactionMetadata,
} from "@/services/transactions/local-cache";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import type { IndexTransaction } from "@/types/transactionTypes";
import type { Loan } from "@/services/loans/queries";
import type { Budget } from "@/types/budgetTypes";

import {
  monthRangesInclusive,
  OFFLINE_BOOTSTRAP_END_DATE,
  OFFLINE_BOOTSTRAP_START_DATE,
} from "@/lib/local-sync/offline-bootstrap-dates";
import {
  hydrateMonthlyFinancialSummariesFromLocalTransactions,
  summariesNeedLocalHydration,
} from "@/services/monthly-financial-summaries/hydrate-from-local-transactions";
import { filterInsightsTransactions } from "./filter-insights-transactions";

const dayKey = (isoDate: string): string => isoDate.slice(0, 10);

const transactionInDateRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean => {
  const key = dayKey(date);
  return key >= startDate && key <= endDate;
};

const filterTransactionsToRange = (
  transactions: IndexTransaction[],
  startDate: string,
  endDate: string,
): IndexTransaction[] =>
  transactions.filter((transaction) =>
    transactionInDateRange(transaction.date, startDate, endDate),
  );

/**
 * Re-apply bootstrap / all-pages meta snapshots so tag + category metadata
 * survives list refreshes that only carry partial row shapes.
 * When multiple snapshots exist for one id, keep the richest metadata.
 */
export const enrichTransactionsForInsights = (
  transactions: IndexTransaction[],
  metaSnapshots: IndexTransaction[],
): IndexTransaction[] => {
  if (metaSnapshots.length === 0) {
    return transactions;
  }

  const bestMetaById = new Map<string, IndexTransaction>();
  for (const row of metaSnapshots) {
    if (!row?.id) {
      continue;
    }

    const existing = bestMetaById.get(row.id);
    bestMetaById.set(
      row.id,
      existing
        ? (mergeIndexTransactionMetadata(existing, row) as IndexTransaction)
        : row,
    );
  }

  const enriched = transactions.map((transaction) => {
    const meta = bestMetaById.get(transaction.id);
    if (!meta) {
      return transaction;
    }

    // Meta is often richer for tags/categories after list refreshes strip them.
    // Pass meta as `existing` so empty Dexie/list rows cannot wipe metadata,
    // while `incoming` transaction keeps the latest amounts.
    return mergeIndexTransactionMetadata(
      meta,
      transaction,
    ) as IndexTransaction;
  });

  // Include meta-only rows (present in bootstrap snapshots but missing from Dexie).
  for (const [id, meta] of bestMetaById) {
    if (enriched.some((row) => row.id === id)) {
      continue;
    }
    enriched.push(meta);
  }

  return enriched;
};

export const loadAllTransactionsForInsights = async (
  spaceCode: string,
): Promise<IndexTransaction[]> => {
  if (!spaceCode) {
    return [];
  }

  const merged = await loadAllCachedTransactionsForInsights(spaceCode);

  if (merged.length > 0) {
    return merged;
  }

  return await loadCachedTransactionsInRange(
    spaceCode,
    OFFLINE_BOOTSTRAP_START_DATE,
    OFFLINE_BOOTSTRAP_END_DATE,
  );
};

export const loadTransactionsForInsightsRange = async (
  spaceCode: string,
  startDate: string,
  endDate: string,
): Promise<IndexTransaction[]> => {
  if (!spaceCode) {
    return [];
  }

  const allTransactions = await loadAllTransactionsForInsights(spaceCode);
  const inRange = filterTransactionsToRange(
    allTransactions,
    startDate,
    endDate,
  );

  if (inRange.length > 0) {
    return inRange;
  }

  const byId = new Map<string, IndexTransaction>();

  mergeInRangeFallback(
    byId,
    await loadCachedTransactionsInRange(spaceCode, startDate, endDate),
    startDate,
    endDate,
  );

  return Array.from(byId.values());
};

const mergeInRangeFallback = (
  byId: Map<string, IndexTransaction>,
  rows: IndexTransaction[],
  startDate: string,
  endDate: string,
): void => {
  for (const transaction of rows) {
    if (transactionInDateRange(transaction.date, startDate, endDate)) {
      byId.set(transaction.id, transaction);
    }
  }
};

const loadBudgetsForInsightsRange = async (
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

export type InsightsLocalSources = {
  summaries: MonthlyFinancialSummary[];
  transactionsInRange: IndexTransaction[];
  allCalculatedTransactions: IndexTransaction[];
  budgets: Budget[];
  loans: Loan[];
};

/**
 * Load everything insights needs from IndexedDB / local response cache.
 * No network calls — mirrors backend ResolveContext inputs.
 */
export const loadInsightsLocalSources = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
  transactionLoadStart: string;
  transactionLoadEnd: string;
}): Promise<InsightsLocalSources> => {
  const {
    spaceCode,
    startDate,
    endDate,
    transactionLoadStart,
    transactionLoadEnd,
  } = params;

  const allTransactionsRaw = enrichTransactionsForInsights(
    await loadAllTransactionsForInsights(spaceCode),
    await loadScatteredTransactionSnapshotsFromMeta(spaceCode),
  );
  const allCalculatedTransactions = filterInsightsTransactions(allTransactionsRaw);
  const transactionsInRange = allCalculatedTransactions.filter((transaction) =>
    transactionInDateRange(
      transaction.date,
      transactionLoadStart,
      transactionLoadEnd,
    ),
  );

  const [
    summariesRaw,
    budgets,
    loansData,
  ] = await Promise.all([
    loadCachedMonthlyFinancialSummaries(spaceCode),
    loadBudgetsForInsightsRange(spaceCode, startDate, endDate),
    loadCachedLoansInfiniteData(spaceCode),
  ]);

  let summaries = summariesRaw ?? [];

  if (
    await summariesNeedLocalHydration(
      spaceCode,
      summaries,
      allCalculatedTransactions,
    )
  ) {
    summaries = await hydrateMonthlyFinancialSummariesFromLocalTransactions(
      spaceCode,
      {
        existingSummaries: summaries,
        transactions: allCalculatedTransactions,
      },
    );
  }

  return {
    summaries,
    transactionsInRange,
    allCalculatedTransactions,
    budgets,
    loans: (loansData?.pages ?? []).flatMap((page) => page.loans),
  };
};
