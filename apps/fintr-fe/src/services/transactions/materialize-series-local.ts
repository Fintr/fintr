import type { QueryClient } from "@tanstack/react-query";

import { normalizeRealtimeIndexTransaction } from "@/hooks/useTransactionsRealtime";
import { upsertLocalIndexTransaction } from "@/services/transactions/local-cache";
import {
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "@/services/transactions/upsert-into-query-caches";

export const persistMaterializedSeriesTransactions = async ({
  spaceId,
  transactions,
  queryClient,
}: {
  spaceId: string;
  transactions: unknown[];
  queryClient?: QueryClient;
}): Promise<IndexTransactionWithCategoryIds[]> => {
  if (!spaceId || transactions.length === 0) {
    return [];
  }

  const rows = transactions
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }

      return normalizeRealtimeIndexTransaction(row as Record<string, unknown>);
    })
    .filter((row): row is IndexTransactionWithCategoryIds => Boolean(row));

  for (const row of rows) {
    await upsertLocalIndexTransaction(spaceId, row);
  }

  if (queryClient && rows.length > 0) {
    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: rows,
    });
  }

  return rows;
};
