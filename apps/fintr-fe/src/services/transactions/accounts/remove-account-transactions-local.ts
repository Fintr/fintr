import type { QueryClient } from "@tanstack/react-query";

import {
  listSpaceTransactions,
  putSpaceTransactions,
  removeOutboxRecord,
} from "@/lib/local-db";
import { transactionTouchesAccount } from "@/services/transactions/account-balance-timeline-local";
import {
  applyLocalTransactionToMonthlySummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import { purgeAttachmentsForTransactions } from "@/services/attachments/create-outbox";
import { clearCachedTransactionDetail } from "@/services/transactions/detail-local";
import { removeLocalIndexTransactionsByIds } from "@/services/transactions/local-cache";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import type { Account } from "@/types/accountTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";

export type RemovedAccountTransactions = {
  transactions: IndexTransaction[];
  summariesAdjusted: boolean;
};

const incomeExpenseType = (
  type: CombinedTransactionTypeEnum,
): "income" | "expense" | null => {
  if (type === CombinedTransactionTypeEnum.INCOME) return "income";
  if (type === CombinedTransactionTypeEnum.EXPENSE) return "expense";
  return null;
};

const adjustSummaries = async (params: {
  spaceId: string;
  transactions: IndexTransaction[];
  mode: "add" | "remove";
  queryClient?: QueryClient;
}): Promise<boolean> => {
  const { spaceId, transactions, mode, queryClient } = params;
  let nextSummaries: MonthlyFinancialSummary[] | null = null;
  let adjusted = false;

  for (const row of transactions) {
    const summaryType = incomeExpenseType(row.type);
    if (!summaryType) continue;

    const updated = await applyLocalTransactionToMonthlySummaries({
      spaceCode: spaceId,
      date: row.date,
      amount: Math.abs(Number(row.amount) || 0),
      type: summaryType,
      mode,
      currency: row.amountCurrency,
    });

    if (updated) {
      adjusted = true;
      nextSummaries = updated;
    }
  }

  if (queryClient && nextSummaries) {
    setMonthlyFinancialSummariesQueryData(queryClient, spaceId, nextSummaries);
  }

  return adjusted;
};

const patchQueryCaches = (params: {
  queryClient?: QueryClient;
  spaceId: string;
  transactions: IndexTransaction[];
}): void => {
  const { queryClient, spaceId, transactions } = params;
  if (!queryClient || transactions.length === 0) {
    return;
  }

  removeIndexTransactionsFromQueryCaches(queryClient, {
    spaceId,
    removedIds: transactions.map((row) => row.id),
    removedTransactions: transactions,
  });
  invalidateLocalInsightsQueries(queryClient);
  queryClient.invalidateQueries({
    queryKey: ["dashboard", "transactions", spaceId],
    exact: false,
  });
};

const cancelPendingLocalCreates = async (
  transactions: IndexTransaction[],
): Promise<void> => {
  for (const row of transactions) {
    if (!row.id.startsWith("local:")) {
      continue;
    }

    const clientMutationId = row.id.slice("local:".length);
    if (clientMutationId) {
      await removeOutboxRecord(clientMutationId);
    }
  }
};

/**
 * Drop IndexedDB rows, query caches, and monthly totals for activity that
 * belongs to the account. Account balances are adjusted by the caller after
 * the account itself leaves the cache, so the deleted balance is not counted
 * twice.
 */
export const removeAccountTransactionsFromLocalCache = async (params: {
  spaceId: string;
  account: Account;
  queryClient?: QueryClient;
}): Promise<RemovedAccountTransactions> => {
  const { spaceId, account, queryClient } = params;
  const rows = await listSpaceTransactions(spaceId);
  const matching = rows.filter((row) =>
    transactionTouchesAccount(row, account),
  );

  if (matching.length === 0) {
    return { transactions: [], summariesAdjusted: false };
  }

  await cancelPendingLocalCreates(matching);
  const removed = await removeLocalIndexTransactionsByIds(
    spaceId,
    matching.map((row) => row.id),
  );
  const transactions = removed.length > 0 ? removed : matching;

  patchQueryCaches({
    queryClient,
    spaceId,
    transactions,
  });
  await purgeAttachmentsForTransactions(spaceId, transactions);
  await Promise.all(
    transactions.map((row) => clearCachedTransactionDetail(spaceId, row.id)),
  );

  const summariesAdjusted = await adjustSummaries({
    spaceId,
    transactions,
    mode: "remove",
    queryClient,
  });

  return { transactions, summariesAdjusted };
};

export const restoreAccountTransactionsInLocalCache = async (params: {
  spaceId: string;
  transactions: IndexTransaction[];
  summariesAdjusted: boolean;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, transactions, summariesAdjusted, queryClient } = params;
  if (transactions.length === 0) {
    return;
  }

  await putSpaceTransactions(spaceId, transactions);

  if (summariesAdjusted) {
    await adjustSummaries({
      spaceId,
      transactions,
      mode: "add",
      queryClient,
    });
  }

  if (queryClient) {
    invalidateLocalInsightsQueries(queryClient);
    queryClient.invalidateQueries({
      queryKey: ["dashboard", "transactions", spaceId],
      exact: false,
    });
  }
};
