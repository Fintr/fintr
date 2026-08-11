import type { QueryClient } from "@tanstack/react-query";

import {
  applyLocalTransactionToMonthlySummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  invalidateLoanRealtimeQueries,
  syncLoanRealtimeAfterDelete,
} from "@/services/loans/invalidate-loan-realtime-queries";
import {
  loadLocalIndexTransactionById,
  removeLocalIndexTransactionsByIds,
  replaceLocalIndexTransactionId,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { applyRealtimeTransactionUpdated } from "@/services/transactions/apply-realtime-update";
import { notifyRealtimeTransactionActor } from "@/services/transactions/realtime-transaction-notify";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import { TRANSFER_FEE_CATEGORY_NAME } from "@/services/transactions/transfers/fee-description";
import { removeMatchingLocalTransferFeePlaceholders } from "@/services/transactions/transfers/reconcile-local-fees";
import {
  replaceIndexTransactionIdInQueryCaches,
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "@/services/transactions/upsert-into-query-caches";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type {
  SpaceChange,
  SyncActor,
  SyncIndexTransaction,
  TransactionChangePayload,
} from "@/types/syncTypes";

import {
  normalizeRealtimeIndexTransaction,
} from "@/hooks/useTransactionsRealtime";

const asString = (value: unknown): string =>
  value == null ? "" : String(value);

const payloadRows = (
  payload: TransactionChangePayload,
): IndexTransactionWithCategoryIds[] => {
  const raw =
    "transactions" in payload && Array.isArray(payload.transactions)
      ? payload.transactions
      : "transaction" in payload && payload.transaction
        ? [payload.transaction]
        : [];

  return raw
    .map((row) =>
      normalizeRealtimeIndexTransaction(
        row as unknown as Record<string, unknown>,
      ),
    )
    .filter((row): row is IndexTransactionWithCategoryIds => Boolean(row));
};

const actorFromSync = (
  actor: SyncActor | undefined,
): Record<string, unknown> | undefined => {
  if (!actor) {
    return undefined;
  }

  return {
    userId: actor.userId,
    authId: actor.authId,
    fullName: actor.fullName,
    photoUrl: actor.photoUrl,
  };
};

/**
 * Map a server create back onto the optimistic `local:{clientMutationId}` row
 * before upserting, so the list never briefly shows both ids (create jank).
 */
const reconcileOptimisticCreateIds = async (params: {
  spaceId: string;
  targetSpace: string;
  queryClient: QueryClient;
  originClientMutationId?: string;
  rows: IndexTransactionWithCategoryIds[];
}): Promise<boolean> => {
  const {
    spaceId,
    targetSpace,
    queryClient,
    originClientMutationId,
    rows,
  } = params;
  const cid = originClientMutationId?.trim();
  if (!cid || rows.length === 0) {
    return false;
  }

  const localParentId = `local:${cid}`;
  const localParent = await loadLocalIndexTransactionById(
    spaceId,
    localParentId,
  );
  if (!localParent) {
    return false;
  }

  const primary =
    rows.find((row) => row.type === localParent.type) ?? rows[0];
  if (!primary?.id || primary.id === localParentId) {
    return false;
  }

  await replaceLocalIndexTransactionId(
    spaceId,
    localParentId,
    primary.id,
  );
  replaceIndexTransactionIdInQueryCaches(queryClient, {
    spaceId,
    previousId: localParentId,
    nextId: primary.id,
  });
  if (targetSpace && targetSpace !== spaceId) {
    replaceIndexTransactionIdInQueryCaches(queryClient, {
      spaceId: targetSpace,
      previousId: localParentId,
      nextId: primary.id,
    });
  }

  return true;
};

export const applyTransactionCreated = async (params: {
  spaceId: string;
  change: SpaceChange;
  queryClient: QueryClient;
  targetSpace?: string;
  selfAuthId?: string;
  originTabId?: string | null;
  suppressActorToast?: boolean;
  notifyActor?: boolean;
}): Promise<void> => {
  const {
    spaceId,
    change,
    queryClient,
    targetSpace = spaceId,
    selfAuthId = "",
    originTabId = null,
    suppressActorToast = false,
    notifyActor = false,
  } = params;

  const rows = payloadRows(change.payload);
  if (rows.length === 0) {
    return;
  }

  let replacedLocalFeePlaceholder = false;
  for (const row of rows) {
    const replaced = await removeMatchingLocalTransferFeePlaceholders({
      spaceId,
      serverFee: row,
      queryClient,
    });
    if (replaced) {
      replacedLocalFeePlaceholder = true;
    }
  }

  const reconciledOwnOptimistic = await reconcileOptimisticCreateIds({
    spaceId,
    targetSpace,
    queryClient,
    originClientMutationId: change.originClientMutationId,
    rows,
  });

  upsertIndexTransactionsIntoQueryCaches(queryClient, {
    spaceId,
    transactions: rows,
  });
  if (targetSpace && targetSpace !== spaceId) {
    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId: targetSpace,
      transactions: rows,
    });
  }

  try {
    let nextSummaries = null;
    for (const row of rows) {
      const alreadyLocal = await loadLocalIndexTransactionById(spaceId, row.id);
      const feeAlreadyCountedOptimistically =
        replacedLocalFeePlaceholder &&
        row.type === CombinedTransactionTypeEnum.EXPENSE &&
        row.categoryName.trim().toLowerCase() ===
          TRANSFER_FEE_CATEGORY_NAME.toLowerCase();
      await upsertLocalIndexTransaction(spaceId, row);
      if (
        alreadyLocal ||
        feeAlreadyCountedOptimistically ||
        (row.type !== CombinedTransactionTypeEnum.INCOME &&
          row.type !== CombinedTransactionTypeEnum.EXPENSE)
      ) {
        continue;
      }
      nextSummaries = await applyLocalTransactionToMonthlySummaries({
        spaceCode: spaceId,
        date: row.date,
        amount: row.amount,
        type:
          row.type === CombinedTransactionTypeEnum.INCOME ? "income" : "expense",
        mode: "add",
        currency: row.amountCurrency,
      });
    }
    if (nextSummaries) {
      setMonthlyFinancialSummariesQueryData(queryClient, spaceId, nextSummaries);
    }
    // Own optimistic create already refreshed insights; skip a second refetch.
    if (!reconciledOwnOptimistic) {
      invalidateLocalInsightsQueries(queryClient);
    }
  } catch (error) {
    console.warn("[sync] Failed to persist created transactions locally", error);
  }

  void invalidateLoanRealtimeQueries(queryClient, rows);

  if (notifyActor && !suppressActorToast) {
    notifyRealtimeTransactionActor({
      action: "added",
      actorPayload: actorFromSync(change.actor),
      originTabId,
      selfAuthId,
      transaction: rows[0] ?? null,
      transactionIds: rows.map((row) => row.id),
    });
  }
};

export const applyTransactionUpdated = async (params: {
  spaceId: string;
  change: SpaceChange;
  queryClient: QueryClient;
  targetSpace?: string;
  selfAuthId?: string;
  originTabId?: string | null;
  suppressActorToast?: boolean;
  notifyActor?: boolean;
}): Promise<void> => {
  const {
    spaceId,
    change,
    queryClient,
    targetSpace = spaceId,
    selfAuthId = "",
    originTabId = null,
    suppressActorToast = false,
    notifyActor = false,
  } = params;

  const rows = payloadRows(change.payload);
  if (rows.length === 0) {
    return;
  }

  for (const row of rows) {
    await applyRealtimeTransactionUpdated({
      spaceId,
      client: queryClient,
      row,
      targetSpace,
    });
  }

  void invalidateLoanRealtimeQueries(queryClient, rows);

  if (notifyActor) {
    notifyRealtimeTransactionActor({
      action: "updated",
      actorPayload: actorFromSync(change.actor),
      originTabId,
      selfAuthId,
      transaction: rows[0] ?? null,
      transactionIds: rows.map((row) => row.id),
      suppressActorToast,
    });
  }
};

export const applyTransactionDeleted = async (params: {
  spaceId: string;
  change: SpaceChange;
  queryClient: QueryClient;
  targetSpace?: string;
  selfAuthId?: string;
  originTabId?: string | null;
  suppressActorToast?: boolean;
  notifyActor?: boolean;
}): Promise<void> => {
  const {
    spaceId,
    change,
    queryClient,
    targetSpace = spaceId,
    selfAuthId = "",
    originTabId = null,
    suppressActorToast = false,
    notifyActor = false,
  } = params;

  const rows = payloadRows(change.payload);
  if (rows.length === 0) {
    return;
  }

  try {
    await removeLocalIndexTransactionsByIds(
      spaceId,
      rows.map((row) => row.id),
    );

    let nextSummaries = null;
    for (const row of rows) {
      if (
        row.type !== CombinedTransactionTypeEnum.INCOME &&
        row.type !== CombinedTransactionTypeEnum.EXPENSE
      ) {
        continue;
      }
      nextSummaries = await applyLocalTransactionToMonthlySummaries({
        spaceCode: spaceId,
        date: row.date,
        amount: row.amount,
        type:
          row.type === CombinedTransactionTypeEnum.INCOME ? "income" : "expense",
        mode: "remove",
        currency: row.amountCurrency,
      });
    }
    if (nextSummaries) {
      setMonthlyFinancialSummariesQueryData(queryClient, spaceId, nextSummaries);
    }
    invalidateLocalInsightsQueries(queryClient);
  } catch (error) {
    console.warn("[sync] Failed to persist deleted transactions locally", error);
  }

  removeIndexTransactionsFromQueryCaches(queryClient, {
    spaceId,
    removedTransactions: rows,
  });

  if (targetSpace && targetSpace !== spaceId) {
    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId: targetSpace,
      removedTransactions: rows,
    });
  }

  void syncLoanRealtimeAfterDelete(queryClient, targetSpace || spaceId, rows);

  if (notifyActor) {
    notifyRealtimeTransactionActor({
      action: "deleted",
      actorPayload: actorFromSync(change.actor),
      originTabId,
      selfAuthId,
      transaction: rows[0] ?? null,
      transactionIds: rows.map((row) => row.id),
      suppressActorToast,
    });
  }
};

export const indexRowsFromPayload = (
  payload: TransactionChangePayload,
): SyncIndexTransaction[] => {
  if ("transactions" in payload && Array.isArray(payload.transactions)) {
    return payload.transactions;
  }

  if ("transaction" in payload && payload.transaction) {
    return [payload.transaction];
  }

  return [];
};

export const asTargetSpace = (
  spaceId: string,
  messageSpaceId: unknown,
): string => asString(messageSpaceId) || spaceId;
