import type { QueryClient } from "@tanstack/react-query";

import {
  applyLocalTransactionToMonthlySummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import {
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "@/services/transactions/upsert-into-query-caches";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const asIncomeOrExpense = (
  type: CombinedTransactionTypeEnum,
): "income" | "expense" | null => {
  if (type === CombinedTransactionTypeEnum.INCOME) return "income";
  if (type === CombinedTransactionTypeEnum.EXPENSE) return "expense";
  return null;
};

const monthlyBucketKey = (row: IndexTransactionWithCategoryIds): string =>
  `${row.date.slice(0, 7)}|${asIncomeOrExpense(row.type) ?? ""}|${Math.abs(
    Number(row.amount) || 0,
  )}|${row.amountCurrency ?? ""}`;

const shouldAdjustMonthlySummaries = (
  previous: IndexTransactionWithCategoryIds | null | undefined,
  next: IndexTransactionWithCategoryIds,
): boolean => {
  const nextKind = asIncomeOrExpense(next.type);
  if (!nextKind && !previous) return false;
  if (!previous) return Boolean(nextKind);
  return monthlyBucketKey(previous) !== monthlyBucketKey(next);
};

/**
 * Apply a peer/server transaction_updated event to IndexedDB + React Query.
 * Removes then re-upserts so filter mismatches drop stale rows from lists.
 */
export const applyRealtimeTransactionUpdated = async (params: {
  spaceId: string;
  client: QueryClient;
  row: IndexTransactionWithCategoryIds;
  targetSpace: string;
}): Promise<void> => {
  const { spaceId, client, row, targetSpace } = params;

  let previous: IndexTransactionWithCategoryIds | null = null;
  try {
    previous = (await loadLocalIndexTransactionById(
      spaceId,
      row.id,
    )) as IndexTransactionWithCategoryIds | null;

    await upsertLocalIndexTransaction(spaceId, row);

    if (shouldAdjustMonthlySummaries(previous, row)) {
      let nextSummaries = null;
      const previousKind = previous ? asIncomeOrExpense(previous.type) : null;
      if (previous && previousKind) {
        nextSummaries = await applyLocalTransactionToMonthlySummaries({
          spaceCode: spaceId,
          date: previous.date,
          amount: Math.abs(Number(previous.amount) || 0),
          type: previousKind,
          mode: "remove",
          currency: previous.amountCurrency,
        });
      }

      const nextKind = asIncomeOrExpense(row.type);
      if (nextKind) {
        nextSummaries = await applyLocalTransactionToMonthlySummaries({
          spaceCode: spaceId,
          date: row.date,
          amount: Math.abs(Number(row.amount) || 0),
          type: nextKind,
          mode: "add",
          currency: row.amountCurrency,
        });
      }

      if (nextSummaries) {
        setMonthlyFinancialSummariesQueryData(client, spaceId, nextSummaries);
      }
    }
    invalidateLocalInsightsQueries(client);
  } catch (error) {
    console.warn(
      "[realtime] Failed to persist updated transaction locally",
      error,
    );
  }

  // New rows (e.g. transfer fee created during a transfer update): upsert only.
  // Existing rows: drop-then-upsert so filter mismatches leave stale lists.
  if (previous) {
    removeIndexTransactionsFromQueryCaches(client, {
      spaceId,
      removedTransactions: [previous],
    });
  }
  upsertIndexTransactionsIntoQueryCaches(client, {
    spaceId,
    transactions: [row],
  });

  if (targetSpace && targetSpace !== spaceId) {
    if (previous) {
      removeIndexTransactionsFromQueryCaches(client, {
        spaceId: targetSpace,
        removedTransactions: [previous],
      });
    }
    upsertIndexTransactionsIntoQueryCaches(client, {
      spaceId: targetSpace,
      transactions: [row],
    });
  }
};
