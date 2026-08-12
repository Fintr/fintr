import { loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import { loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import {
  resolveMonthlySummariesForInsights,
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

const transactionsNeedMetaEnrichment = (
  transactions: IndexTransaction[],
): boolean =>
  transactions.some(
    (transaction) =>
      !transaction.categoryName?.trim()
      || (
        !(transaction.tagIds?.length ?? 0)
        && !(transaction.tags?.length ?? 0)
      ),
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

  const fromIndex = await loadCachedTransactionsInRange(
    spaceCode,
    startDate,
    endDate,
  );

  if (fromIndex.length > 0) {
    return fromIndex;
  }

  const fromMeta = filterTransactionsToRange(
    await loadScatteredTransactionSnapshotsFromMeta(spaceCode),
    startDate,
    endDate,
  );

  if (fromMeta.length > 0) {
    return fromMeta;
  }

  return filterTransactionsToRange(
    await loadAllTransactionsForInsights(spaceCode),
    startDate,
    endDate,
  );
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

export type InsightsBucketSources = Pick<
  InsightsLocalSources,
  "summaries" | "budgets" | "loans"
> & {
  resolvedSpaceCode: string;
};

/**
 * Fast path: monthly buckets + budgets + loans only (no transaction scans).
 */
export const loadInsightsBucketSources = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
}): Promise<InsightsBucketSources> => {
  const { spaceCode, startDate, endDate } = params;

  const [
    resolvedSummaries,
    budgets,
    loansData,
  ] = await Promise.all([
    resolveMonthlySummariesForInsights(spaceCode),
    loadBudgetsForInsightsRange(spaceCode, startDate, endDate),
    loadCachedLoansInfiniteData(spaceCode),
  ]);

  return {
    resolvedSpaceCode: resolvedSummaries.spaceCode,
    summaries: resolvedSummaries.summaries,
    budgets,
    loans: (loansData?.pages ?? []).flatMap((page) => page.loans),
  };
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
  /**
   * Unfiltered dashboard views only need period rows + monthly buckets.
   * Category/tag filters need the full IndexedDB history for metadata + matching.
   */
  loadAllTransactions?: boolean;
}): Promise<InsightsLocalSources> => {
  const {
    spaceCode,
    startDate,
    endDate,
    transactionLoadStart,
    transactionLoadEnd,
    loadAllTransactions = true,
  } = params;

  const [
    resolvedSummaries,
    budgets,
    loansData,
  ] = await Promise.all([
    resolveMonthlySummariesForInsights(spaceCode),
    loadBudgetsForInsightsRange(spaceCode, startDate, endDate),
    loadCachedLoansInfiniteData(spaceCode),
  ]);

  let summaries = resolvedSummaries.summaries;
  let allCalculatedTransactions: IndexTransaction[] = [];
  let transactionsInRange: IndexTransaction[] = [];

  const transactionLoadSpaceCode =
    resolvedSummaries.spaceCode || spaceCode;

  if (loadAllTransactions) {
    const allTransactionsRaw = enrichTransactionsForInsights(
      await loadAllTransactionsForInsights(transactionLoadSpaceCode),
      await loadScatteredTransactionSnapshotsFromMeta(transactionLoadSpaceCode),
    );
    allCalculatedTransactions = filterInsightsTransactions(allTransactionsRaw);
    transactionsInRange = allCalculatedTransactions.filter((transaction) =>
      transactionInDateRange(
        transaction.date,
        transactionLoadStart,
        transactionLoadEnd,
      ),
    );

    if (
      await summariesNeedLocalHydration(
        transactionLoadSpaceCode,
        summaries,
        allCalculatedTransactions,
      )
    ) {
      summaries = await hydrateMonthlyFinancialSummariesFromLocalTransactions(
        transactionLoadSpaceCode,
        {
          existingSummaries: summaries,
          transactions: allCalculatedTransactions,
        },
      );
    }
  } else {
    let periodRaw = await loadTransactionsForInsightsRange(
      transactionLoadSpaceCode,
      transactionLoadStart,
      transactionLoadEnd,
    );

    if (
      periodRaw.length > 0
      && transactionsNeedMetaEnrichment(periodRaw)
    ) {
      periodRaw = enrichTransactionsForInsights(
        periodRaw,
        await loadScatteredTransactionSnapshotsFromMeta(transactionLoadSpaceCode),
      );
    }

    allCalculatedTransactions = filterInsightsTransactions(periodRaw);
    transactionsInRange = allCalculatedTransactions;
  }

  return {
    summaries,
    transactionsInRange,
    allCalculatedTransactions,
    budgets,
    loans: (loansData?.pages ?? []).flatMap((page) => page.loans),
  };
};
