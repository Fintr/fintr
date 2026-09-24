import type { QueryClient } from "@tanstack/react-query";

import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { removeLocalIndexTransactionsByIds } from "@/services/transactions/local-cache";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import type { IndexTransactionWithCategoryIds } from "@/services/transactions/upsert-into-query-caches";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  isLocalTransferFeeId,
  TRANSFER_FEE_CATEGORY_NAME,
} from "./fee-description";

const isTransferFeeExpense = (
  row: IndexTransactionWithCategoryIds,
): boolean =>
  row.type === CombinedTransactionTypeEnum.EXPENSE &&
  row.categoryName.trim().toLowerCase() ===
    TRANSFER_FEE_CATEGORY_NAME.toLowerCase();

/**
 * Drop optimistic `local:*:fee` placeholders when the server fee arrives so the
 * list does not show duplicate transfer-cost expenses.
 * Returns true when at least one local placeholder was removed (summaries already
 * include the fee from the optimistic write — caller should not add again).
 */
export const removeMatchingLocalTransferFeePlaceholders = async (params: {
  spaceId: string;
  serverFee: IndexTransactionWithCategoryIds;
  queryClient?: QueryClient;
}): Promise<boolean> => {
  const { spaceId, serverFee, queryClient } = params;
  if (!spaceId || !isTransferFeeExpense(serverFee)) {
    return false;
  }

  const serverAmount = Math.abs(Number(serverFee.amount) || 0);
  let candidates: IndexTransactionWithCategoryIds[] = [];
  try {
    candidates = (await loadCachedTransactionsInRange(
      spaceId,
      "1970-01-01",
      "2100-12-31",
    )) as IndexTransactionWithCategoryIds[];
  } catch {
    return false;
  }

  const matches = candidates.filter((row) => {
    if (!isLocalTransferFeeId(row.id)) return false;
    if (!isTransferFeeExpense(row)) return false;
    if (row.date !== serverFee.date) return false;
    if (Math.abs(Number(row.amount) || 0) !== serverAmount) return false;
    if ((row.fromAccountName ?? "") !== (serverFee.fromAccountName ?? "")) {
      return false;
    }
    return true;
  });

  if (matches.length === 0) {
    return false;
  }

  await removeLocalIndexTransactionsByIds(
    spaceId,
    matches.map((row) => row.id),
  );
  if (queryClient) {
    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId,
      removedTransactions: matches,
    });
  }
  return true;
};
