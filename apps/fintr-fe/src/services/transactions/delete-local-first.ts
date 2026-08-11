import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { DeleteScopeEnum } from "@/constants/transactionConstants";
import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_LOAN_CREATE,
  OUTBOX_COMMAND_LOAN_DELETE,
  OUTBOX_COMMAND_LOAN_PAYMENT_CREATE,
  OUTBOX_COMMAND_LOAN_PAYMENT_DELETE,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  OUTBOX_COMMAND_TRANSACTION_DELETE,
  OUTBOX_COMMAND_TRANSFER_CREATE,
  OUTBOX_COMMAND_TRANSFER_DELETE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { getLocalDb } from "@/lib/local-db/db";
import { deleteLoan } from "@/services/loans/mutation";
import { removeLoanFromCachedPages } from "@/services/loans/local-cache";
import { removeLoanFromQueryCaches } from "@/services/loans/loans-list-cache";
import { deleteLoanPayment } from "@/services/loans/payments";
import { applyLocalTransactionToMonthlySummaries } from "@/services/monthly-financial-summaries/local-cache";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  loadCachedTransactionsInRange,
  loadLocalIndexTransactionById,
  loadAllTimeTransactionsForDeleteScope,
  removeLocalIndexTransactionsByIds,
} from "./local-cache";
import { deleteTransaction } from "./mutation";
import { removeIndexTransactionsFromQueryCaches } from "./remove-from-query-caches";
import {
  collectIndexTransactionsFromQueryCaches,
  resolveLinkedTransferFeeRows,
  resolveSeriesRowsForDeleteScope,
} from "./resolve-delete-scope";
import { deleteTransfer } from "./transfers/mutation";

export type DeleteTransactionLocalFirstResult = {
  pendingSync: boolean;
  removedIds: string[];
  removedTransactions: IndexTransaction[];
  serverResponse?: unknown;
  /** Settles when the network delete finishes (online success, offline keep, or throw). */
  syncPromise: Promise<DeleteTransactionLocalFirstResult>;
};

export type DeleteTransactionLocalFirstOptions = {
  queryClient?: QueryClient;
  /**
   * When false, return as soon as React Query + IndexedDB are updated.
   * Defaults to true for existing callers/tests that await the network.
   */
  waitForSync?: boolean;
};

export type TransactionDeleteOutboxPayload = {
  id: string;
  deleteScope: DeleteScopeEnum;
  removedTransactions: IndexTransaction[];
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const incomeExpenseType = (
  type: CombinedTransactionTypeEnum,
): "income" | "expense" | null => {
  if (type === CombinedTransactionTypeEnum.INCOME) return "income";
  if (type === CombinedTransactionTypeEnum.EXPENSE) return "expense";
  return null;
};

const adjustSummariesForRemoved = async (
  spaceId: string,
  removed: IndexTransaction[],
  mode: "add" | "remove",
): Promise<void> => {
  for (const row of removed) {
    const summaryType = incomeExpenseType(row.type);
    if (!summaryType) continue;
    await applyLocalTransactionToMonthlySummaries({
      spaceCode: spaceId,
      date: row.date,
      amount: Math.abs(Number(row.amount) || 0),
      type: summaryType,
      mode,
      currency: row.amountCurrency,
    });
  }
};

const isNetworkLikeDeleteError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to delete transaction" ||
      error.message === "Failed to delete transfer" ||
      error.message === "Failed to delete loan" ||
      error.message === "Failed to delete loan payment" ||
      error.message.toLowerCase().includes("network")
    );
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      details?: unknown;
      success?: unknown;
    };
    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return false;
};

const resolvedDeleteResult = (
  result: Omit<DeleteTransactionLocalFirstResult, "syncPromise">,
): DeleteTransactionLocalFirstResult => {
  const full = {
    ...result,
  } as DeleteTransactionLocalFirstResult;
  full.syncPromise = Promise.resolve(full);
  return full;
};

const patchQueryCachesForDelete = (params: {
  queryClient?: QueryClient;
  spaceId: string;
  removedIds: string[];
  removedTransactions: IndexTransaction[];
}): void => {
  const { queryClient, spaceId, removedIds, removedTransactions } = params;
  if (!queryClient || removedIds.length === 0) {
    return;
  }
  removeIndexTransactionsFromQueryCaches(queryClient, {
    spaceId,
    removedIds,
    removedTransactions,
  });
};

const cancelPendingLocalCreate = async (
  transactionId: string,
): Promise<boolean> => {
  if (!transactionId.startsWith("local:")) {
    return false;
  }

  const clientMutationId = transactionId.slice("local:".length);
  if (!clientMutationId) {
    return false;
  }

  const existing = await getLocalDb().outbox.get(clientMutationId);
  if (
    !existing ||
    (existing.commandType !== OUTBOX_COMMAND_TRANSACTION_CREATE &&
      existing.commandType !== OUTBOX_COMMAND_TRANSFER_CREATE)
  ) {
    return false;
  }

  await removeOutboxRecord(clientMutationId);
  return true;
};

type OptimisticDeleteKind = "transfer" | "transaction";

const mergeRowsById = (
  ...groups: IndexTransaction[][]
): IndexTransaction[] => {
  const byId = new Map<string, IndexTransaction>();
  for (const group of groups) {
    for (const row of group) {
      if (row?.id) byId.set(row.id, row);
    }
  }
  return Array.from(byId.values());
};

const loadIdbRowsForDelete = async (
  spaceId: string,
): Promise<IndexTransaction[]> => {
  try {
    return await loadCachedTransactionsInRange(
      spaceId,
      "1970-01-01",
      "2100-12-31",
    );
  } catch {
    return [];
  }
};

/**
 * Shared optimistic path for income/expense/transfer:
 * 1) React Query (series + fees) immediately
 * 2) IndexedDB + outbox
 * 3) Network (background when waitForSync is false)
 */
const deleteIndexRowsOptimistic = async (params: {
  api: AxiosInstance;
  spaceId: string;
  transactionId: string;
  deleteScope: DeleteScopeEnum;
  target: IndexTransaction;
  queryClient?: QueryClient;
  waitForSync: boolean;
  kind: OptimisticDeleteKind;
}): Promise<DeleteTransactionLocalFirstResult> => {
  const {
    api,
    spaceId,
    transactionId,
    deleteScope: requestedDeleteScope,
    target,
    queryClient,
    waitForSync,
    kind,
  } = params;

  // One-time rows must never expand by fingerprint, even if a stale series
  // scope is passed from the UI.
  const deleteScope = target.inSeries
    ? requestedDeleteScope
    : DeleteScopeEnum.THIS_ONLY;

  const rqRows = queryClient
    ? collectIndexTransactionsFromQueryCaches(queryClient, spaceId)
    : [];

  // Resolve series from RQ first so the UI can drop siblings instantly.
  const seriesFromRq = resolveSeriesRowsForDeleteScope({
    rows: rqRows,
    target,
    deleteScope,
  });
  const feesFromRq =
    kind === "transfer"
      ? resolveLinkedTransferFeeRows({
          rows: rqRows,
          transfers: seriesFromRq,
          deleteScope,
          targetDate: target.date,
        })
      : [];

  const instantPreview = mergeRowsById(seriesFromRq, feesFromRq, [target]);
  patchQueryCachesForDelete({
    queryClient,
    spaceId,
    removedIds: instantPreview.map((row) => row.id),
    removedTransactions: instantPreview,
  });

  const idbRows = await loadIdbRowsForDelete(spaceId);
  const idsToRemove = await loadAllTimeTransactionsForDeleteScope({
    spaceId,
    target,
    deleteScope,
    extraRows: rqRows,
  });
  const scopedIds = transactionId.startsWith("local:")
    ? idsToRemove.filter((id) => id.startsWith("local:"))
    : idsToRemove;

  const seedById = new Map<string, IndexTransaction>();
  for (const row of mergeRowsById(rqRows, idbRows, [target])) {
    seedById.set(row.id, row);
  }

  const removedTransfers: IndexTransaction[] = scopedIds.map(
    (id) => seedById.get(id) ?? { ...target, id },
  );

  const linkedFees =
    kind === "transfer"
      ? resolveLinkedTransferFeeRows({
          rows: mergeRowsById(rqRows, idbRows),
          transfers: removedTransfers,
          deleteScope,
          targetDate: target.date,
        })
      : [];

  const allPreview = mergeRowsById(removedTransfers, linkedFees);
  const allIds = allPreview.map((row) => row.id);

  // Ensure any siblings/fees discovered via IDB are also cleared from RQ.
  patchQueryCachesForDelete({
    queryClient,
    spaceId,
    removedIds: allIds,
    removedTransactions: allPreview,
  });

  for (const id of scopedIds) {
    if (id.startsWith("local:")) {
      await cancelPendingLocalCreate(id);
    }
  }

  const removed = await removeLocalIndexTransactionsByIds(spaceId, allIds);
  const removedTransactions =
    removed.length > 0 ? mergeRowsById(removed, allPreview) : allPreview;
  const removedIds = removedTransactions.map((row) => row.id);

  if (kind === "transaction") {
    await adjustSummariesForRemoved(spaceId, removedTransactions, "remove");
  } else if (kind === "transfer") {
    const feeRows = removedTransactions.filter(
      (row) => row.type === CombinedTransactionTypeEnum.EXPENSE,
    );
    await adjustSummariesForRemoved(spaceId, feeRows, "remove");
  }

  if (queryClient) {
    invalidateLocalInsightsQueries(queryClient);
  }

  if (transactionId.startsWith("local:")) {
    return resolvedDeleteResult({
      pendingSync: false,
      removedIds,
      removedTransactions,
    });
  }

  const clientMutationId = newClientMutationId();
  if (kind === "transfer") {
    await enqueueOutboxRecord({
      spaceId,
      commandType: OUTBOX_COMMAND_TRANSFER_DELETE,
      payload: { id: transactionId, deleteScope },
      clientMutationId,
    });
  } else {
    await enqueueOutboxRecord({
      spaceId,
      commandType: OUTBOX_COMMAND_TRANSACTION_DELETE,
      payload: {
        id: transactionId,
        deleteScope,
        removedTransactions,
      } satisfies TransactionDeleteOutboxPayload,
      clientMutationId,
    });
  }
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let syncPromise!: Promise<DeleteTransactionLocalFirstResult>;
  syncPromise = (async (): Promise<DeleteTransactionLocalFirstResult> => {
    try {
      const serverResponse =
        kind === "transfer"
          ? await deleteTransfer(api, {
              id: transactionId,
              deleteScope,
            })
          : await deleteTransaction(api, {
              id: transactionId,
              deleteScope,
            });
      await removeOutboxRecord(clientMutationId);
      return {
        pendingSync: false,
        removedIds,
        removedTransactions,
        serverResponse,
        syncPromise,
      };
    } catch (error) {
      if (isNetworkLikeDeleteError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error
              ? error.message
              : kind === "transfer"
                ? "Network error deleting transfer"
                : "Network error deleting transaction",
        });
        return {
          pendingSync: true,
          removedIds,
          removedTransactions,
          syncPromise,
        };
      }

      // Local delete already won for income/expense; treat hard server errors
      // (including not found) as reconciled. Transfers keep prior throw behavior
      // for unexpected validation failures.
      if (kind === "transaction") {
        await removeOutboxRecord(clientMutationId);
        return {
          pendingSync: false,
          removedIds,
          removedTransactions,
          syncPromise,
        };
      }
      throw error;
    }
  })();

  const optimistic: DeleteTransactionLocalFirstResult = {
    pendingSync: true,
    removedIds,
    removedTransactions,
    syncPromise,
  };

  if (waitForSync) {
    return syncPromise;
  }

  return optimistic;
};

/**
 * Local-first delete: React Query first, then IndexedDB (+ outbox), then DELETE.
 * Never-synced `local:` rows cancel the create outbox instead of calling the server.
 *
 * Pass `waitForSync: false` for instant UI (returns after RQ + IndexedDB).
 */
export const deleteTransactionLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    transactionId: string;
    deleteScope: DeleteScopeEnum;
    /** Optional list-row seed when local cache lookup is cold. */
    listRow?: IndexTransaction | null;
  },
  options: DeleteTransactionLocalFirstOptions = {},
): Promise<DeleteTransactionLocalFirstResult> => {
  const { spaceId, transactionId, deleteScope, listRow } = params;
  const { queryClient, waitForSync = true } = options;
  if (!spaceId) {
    throw new Error("spaceId is required to delete a local transaction");
  }

  // 1) Instant UI — drop the clicked row (+ visible series/fees from RQ)
  // before any IndexedDB await. One-time rows never expand by fingerprint.
  if (queryClient && listRow) {
    const rqRows = collectIndexTransactionsFromQueryCaches(
      queryClient,
      spaceId,
    );
    const effectiveDeleteScope = listRow.inSeries
      ? deleteScope
      : DeleteScopeEnum.THIS_ONLY;
    const seriesRows = resolveSeriesRowsForDeleteScope({
      rows: rqRows,
      target: listRow,
      deleteScope: effectiveDeleteScope,
    });
    const feeRows =
      listRow.type === CombinedTransactionTypeEnum.TRANSFER
        ? resolveLinkedTransferFeeRows({
            rows: rqRows,
            transfers: seriesRows,
            deleteScope: effectiveDeleteScope,
            targetDate: listRow.date,
          })
        : [];
    const instantRows = mergeRowsById(seriesRows, feeRows, [listRow]);
    patchQueryCachesForDelete({
      queryClient,
      spaceId,
      removedIds: instantRows.map((row) => row.id),
      removedTransactions: instantRows,
    });
  } else {
    patchQueryCachesForDelete({
      queryClient,
      spaceId,
      removedIds: [transactionId],
      removedTransactions: listRow ? [listRow] : [],
    });
  }

  const cached = await loadLocalIndexTransactionById(spaceId, transactionId);
  const target = listRow
    ? {
        ...(cached ?? listRow),
        ...listRow,
        // Prefer the clicked list row's series flag. Do not invent inSeries
        // from deleteScope — a stale all_in_series scope on a one-time row
        // would otherwise fingerprint-match unrelated identical expenses.
        inSeries: Boolean(listRow.inSeries || cached?.inSeries),
      }
    : cached
      ? {
          ...cached,
          inSeries: Boolean(cached.inSeries),
        }
      : null;

  if (!target) {
    // Still attempt server delete when we have a real id (cache miss).
    if (transactionId.startsWith("local:")) {
      await cancelPendingLocalCreate(transactionId);
      return resolvedDeleteResult({
        pendingSync: false,
        removedIds: [transactionId],
        removedTransactions: [],
      });
    }

    if (!waitForSync) {
      const clientMutationId = newClientMutationId();
      await enqueueOutboxRecord({
        spaceId,
        commandType: OUTBOX_COMMAND_TRANSACTION_DELETE,
        payload: {
          id: transactionId,
          deleteScope,
          removedTransactions: [],
        } satisfies TransactionDeleteOutboxPayload,
        clientMutationId,
      });
      await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

      let syncPromise!: Promise<DeleteTransactionLocalFirstResult>;
      syncPromise = (async (): Promise<DeleteTransactionLocalFirstResult> => {
        try {
          const serverResponse = await deleteTransaction(api, {
            id: transactionId,
            deleteScope,
          });
          await removeOutboxRecord(clientMutationId);
          return {
            pendingSync: false,
            removedIds: [transactionId],
            removedTransactions: [],
            serverResponse,
            syncPromise,
          };
        } catch (error) {
          if (isNetworkLikeDeleteError(error)) {
            await updateOutboxStatus({
              id: clientMutationId,
              status: "pending",
              lastError:
                error instanceof Error
                  ? error.message
                  : "Network error deleting transaction",
            });
            return {
              pendingSync: true,
              removedIds: [transactionId],
              removedTransactions: [],
              syncPromise,
            };
          }
          await removeOutboxRecord(clientMutationId);
          return {
            pendingSync: false,
            removedIds: [transactionId],
            removedTransactions: [],
            syncPromise,
          };
        }
      })();

      return {
        pendingSync: true,
        removedIds: [transactionId],
        removedTransactions: [],
        syncPromise,
      };
    }

    try {
      const serverResponse = await deleteTransaction(api, {
        id: transactionId,
        deleteScope,
      });
      return resolvedDeleteResult({
        pendingSync: false,
        removedIds: [transactionId],
        removedTransactions: [],
        serverResponse,
      });
    } catch (error) {
      if (isNetworkLikeDeleteError(error)) {
        const clientMutationId = newClientMutationId();
        await enqueueOutboxRecord({
          spaceId,
          commandType: OUTBOX_COMMAND_TRANSACTION_DELETE,
          payload: {
            id: transactionId,
            deleteScope,
            removedTransactions: [],
          } satisfies TransactionDeleteOutboxPayload,
          clientMutationId,
        });
        return resolvedDeleteResult({
          pendingSync: true,
          removedIds: [transactionId],
          removedTransactions: [],
        });
      }
      // Not found / other server errors: local intent already satisfied.
      return resolvedDeleteResult({
        pendingSync: false,
        removedIds: [transactionId],
        removedTransactions: [],
      });
    }
  }

  if (
    target.type === CombinedTransactionTypeEnum.TRANSFER ||
    target.type === CombinedTransactionTypeEnum.INCOME ||
    target.type === CombinedTransactionTypeEnum.EXPENSE
  ) {
    return deleteIndexRowsOptimistic({
      api,
      spaceId,
      transactionId,
      deleteScope,
      target,
      queryClient,
      waitForSync,
      kind:
        target.type === CombinedTransactionTypeEnum.TRANSFER
          ? "transfer"
          : "transaction",
    });
  }

  if (target.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT) {
    if (queryClient) {
      removeLoanFromQueryCaches(queryClient, transactionId);
    }
    void removeLoanFromCachedPages(spaceId, transactionId);

    const removed = await removeLocalIndexTransactionsByIds(spaceId, [
      transactionId,
    ]);
    const removedTransactions =
      removed.length > 0 ? removed : [target];
    const removedIds = removedTransactions.map((row) => row.id);

    if (transactionId.startsWith("local:")) {
      const clientMutationId = transactionId.slice("local:".length);
      const existing = await getLocalDb().outbox.get(clientMutationId);
      if (existing?.commandType === OUTBOX_COMMAND_LOAN_CREATE) {
        await removeOutboxRecord(clientMutationId);
      }

      return resolvedDeleteResult({
        pendingSync: false,
        removedIds,
        removedTransactions,
      });
    }

    const clientMutationId = newClientMutationId();
    await enqueueOutboxRecord({
      spaceId,
      commandType: OUTBOX_COMMAND_LOAN_DELETE,
      payload: { id: transactionId },
      clientMutationId,
    });
    await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

    let syncPromise!: Promise<DeleteTransactionLocalFirstResult>;
    syncPromise = (async (): Promise<DeleteTransactionLocalFirstResult> => {
      try {
        const serverResponse = await deleteLoan(api, transactionId);
        await removeOutboxRecord(clientMutationId);
        return {
          pendingSync: false,
          removedIds,
          removedTransactions,
          serverResponse,
          syncPromise,
        };
      } catch (error) {
        if (isNetworkLikeDeleteError(error)) {
          await updateOutboxStatus({
            id: clientMutationId,
            status: "pending",
            lastError:
              error instanceof Error
                ? error.message
                : "Network error deleting loan",
          });
          return {
            pendingSync: true,
            removedIds,
            removedTransactions,
            syncPromise,
          };
        }

        await removeOutboxRecord(clientMutationId);
        return {
          pendingSync: false,
          removedIds,
          removedTransactions,
          syncPromise,
        };
      }
    })();

    const optimistic: DeleteTransactionLocalFirstResult = {
      pendingSync: true,
      removedIds,
      removedTransactions,
      syncPromise,
    };

    if (waitForSync) {
      return syncPromise;
    }

    return optimistic;
  }

  if (target.type === CombinedTransactionTypeEnum.LOAN_PAYMENT) {
    const loanId = target.loanId;
    if (!loanId) {
      throw new Error("Loan payment delete requires loanId");
    }

    const removed = await removeLocalIndexTransactionsByIds(spaceId, [
      transactionId,
    ]);
    const removedTransactions =
      removed.length > 0 ? removed : [target];
    const removedIds = removedTransactions.map((row) => row.id);

    if (transactionId.startsWith("local:")) {
      const clientMutationId = transactionId.slice("local:".length);
      const existing = await getLocalDb().outbox.get(clientMutationId);
      if (existing?.commandType === OUTBOX_COMMAND_LOAN_PAYMENT_CREATE) {
        await removeOutboxRecord(clientMutationId);
      }

      return resolvedDeleteResult({
        pendingSync: false,
        removedIds,
        removedTransactions,
      });
    }

    const clientMutationId = newClientMutationId();
    await enqueueOutboxRecord({
      spaceId,
      commandType: OUTBOX_COMMAND_LOAN_PAYMENT_DELETE,
      payload: { loanId, paymentId: transactionId },
      clientMutationId,
    });
    await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

    let syncPromise!: Promise<DeleteTransactionLocalFirstResult>;
    syncPromise = (async (): Promise<DeleteTransactionLocalFirstResult> => {
      try {
        const serverResponse = await deleteLoanPayment(
          api,
          loanId,
          transactionId,
        );
        await removeOutboxRecord(clientMutationId);
        return {
          pendingSync: false,
          removedIds,
          removedTransactions,
          serverResponse,
          syncPromise,
        };
      } catch (error) {
        if (isNetworkLikeDeleteError(error)) {
          await updateOutboxStatus({
            id: clientMutationId,
            status: "pending",
            lastError:
              error instanceof Error
                ? error.message
                : "Network error deleting loan payment",
          });
          return {
            pendingSync: true,
            removedIds,
            removedTransactions,
            syncPromise,
          };
        }

        await removeOutboxRecord(clientMutationId);
        return {
          pendingSync: false,
          removedIds,
          removedTransactions,
          syncPromise,
        };
      }
    })();

    const optimistic: DeleteTransactionLocalFirstResult = {
      pendingSync: true,
      removedIds,
      removedTransactions,
      syncPromise,
    };

    if (waitForSync) {
      return syncPromise;
    }

    return optimistic;
  }

  // Fallback: treat unknown types as a plain transaction delete.
  return deleteIndexRowsOptimistic({
    api,
    spaceId,
    transactionId,
    deleteScope,
    target,
    queryClient,
    waitForSync,
    kind: "transaction",
  });
};
