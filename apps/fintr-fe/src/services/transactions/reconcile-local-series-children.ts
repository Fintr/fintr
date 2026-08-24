import type { QueryClient } from "@tanstack/react-query";

import {
  loadCachedTransactionsInRange,
  removeLocalIndexTransactionsByIds,
} from "@/services/transactions/local-cache";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import type { IndexTransactionWithCategoryIds } from "@/services/transactions/upsert-into-query-caches";
import { isLocalSeriesChildId } from "@/services/transactions/schedule-occurrence-dates";

const isOptimisticSeriesChild = (row: IndexTransactionWithCategoryIds): boolean =>
  row.id.startsWith("local:") && !row.id.endsWith(":fee");

/**
 * Drop optimistic `local:{cid}:{n}` placeholders when the matching server
 * series child arrives so installment/repeat lists do not duplicate dates.
 */
export const removeMatchingLocalSeriesChildPlaceholders = async (params: {
  spaceId: string;
  serverRow: IndexTransactionWithCategoryIds;
  queryClient?: QueryClient;
}): Promise<boolean> => {
  const { spaceId, serverRow, queryClient } = params;
  if (!spaceId || !serverRow.parentId?.trim()) {
    return false;
  }

  const serverAmount = Math.abs(Number(serverRow.amount) || 0);
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

  const serverDate = serverRow.date.slice(0, 10);
  const matches = candidates.filter((row) => {
    if (!isOptimisticSeriesChild(row)) {
      return false;
    }
    if (row.date.slice(0, 10) !== serverDate) {
      return false;
    }
    if (Math.abs(Number(row.amount) || 0) !== serverAmount) {
      return false;
    }
    if ((row.categoryName ?? "") !== (serverRow.categoryName ?? "")) {
      return false;
    }
    if (row.type !== serverRow.type) {
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
