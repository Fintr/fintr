import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TRANSFER_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyLocalTransactionToMonthlySummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { isTransactionCalculatedForDate } from "@/utils/transactionCalculated";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";

import {
  removeLocalIndexTransaction,
  removeLocalIndexTransactionsByIds,
  removeLocalSeriesChildrenForMutation,
  replaceLocalIndexTransactionId,
  upsertLocalIndexTransaction,
} from "../local-cache";
import { removeIndexTransactionsFromQueryCaches } from "../remove-from-query-caches";
import {
  expandLocalSeriesOccurrenceDates,
  localSeriesChildId,
} from "../schedule-occurrence-dates";
import {
  replaceIndexTransactionIdInQueryCaches,
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "../upsert-into-query-caches";
import {
  buildTransferFeeDescription,
  localSeriesChildTransferFeeId,
  localTransferFeeId,
  TRANSFER_FEE_CATEGORY_NAME,
} from "./fee-description";
import { assertCreateTransferForOptimistic } from "@fintr/domain";

import {
  buildCreateOutboxPayload,
  rollbackCreateAttachments,
  syncAttachmentOwnerId,
} from "@/services/attachments/create-outbox";

import {
  createTransfer,
  type CreateTransferType,
} from "./mutation";

export type CreateTransferLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localTransaction: IndexTransactionWithCategoryIds;
  localFeeTransaction: IndexTransactionWithCategoryIds | null;
  localSeriesTransactions: IndexTransactionWithCategoryIds[];
  localSeriesFeeTransactions: IndexTransactionWithCategoryIds[];
  serverResponse?: unknown;
  syncPromise: Promise<CreateTransferLocalFirstResult>;
};

export type CreateTransferLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
  /** Override "today" for deterministic series expansion and calculated state in tests. */
  today?: string;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const buildOptimisticTransferIndexTransaction = (params: {
  id: string;
  data: CreateTransferType;
  amountCurrency?: string;
  date?: string;
  /** Override "today" for deterministic calculated state in tests. */
  today?: string;
}): IndexTransactionWithCategoryIds => {
  const { id, data, amountCurrency } = params;
  const date = params.date ?? data.date;

  return {
    id,
    date,
    calculated: isTransactionCalculatedForDate(date, params.today),
    createdAt: new Date().toISOString(),
    description: data.description ?? "",
    amount: Math.abs(Number(data.amount) || 0),
    amountCurrency,
    // Combined list rows use a null/empty category for transfers — keep the
    // optimistic parent fingerprint-compatible with server series children.
    categoryName: "",
    fromAccountName: data.fromAccountName,
    toAccountName: data.toAccountName,
    type: CombinedTransactionTypeEnum.TRANSFER,
    inSeries: data.scheduleType !== ScheduleTypeEnum.ONE_TIME,
    hasImage: Boolean(data.file),
  };
};

export const buildOptimisticTransferFeeIndexTransaction = (params: {
  id: string;
  data: CreateTransferType;
  amountCurrency?: string;
  date?: string;
  /** Override "today" for deterministic calculated state in tests. */
  today?: string;
}): IndexTransactionWithCategoryIds | null => {
  const { id, data, amountCurrency } = params;
  const feeAmount = Math.abs(Number(data.transactionCost) || 0);
  if (feeAmount <= 0) {
    return null;
  }

  const transferAmount = Math.abs(Number(data.amount) || 0);
  const date = params.date ?? data.date;

  return {
    id,
    date,
    calculated: isTransactionCalculatedForDate(date, params.today),
    createdAt: new Date().toISOString(),
    description: buildTransferFeeDescription({
      description: data.description,
      transferAmount,
    }),
    amount: feeAmount,
    amountCurrency,
    categoryName: TRANSFER_FEE_CATEGORY_NAME,
    fromAccountName: data.fromAccountName,
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: data.scheduleType !== ScheduleTypeEnum.ONE_TIME,
    hasImage: false,
  };
};

export const buildOptimisticSeriesTransfers = (params: {
  clientMutationId: string;
  data: CreateTransferType;
  amountCurrency?: string;
  /** Override "today" for deterministic series expansion in tests. */
  today?: string;
}): {
  parent: IndexTransactionWithCategoryIds;
  parentFee: IndexTransactionWithCategoryIds | null;
  childTransfers: IndexTransactionWithCategoryIds[];
  childFees: IndexTransactionWithCategoryIds[];
  allRows: IndexTransactionWithCategoryIds[];
} => {
  const parent = buildOptimisticTransferIndexTransaction({
    id: `local:${params.clientMutationId}`,
    data: params.data,
    amountCurrency: params.amountCurrency,
    today: params.today,
  });
  const parentFee = buildOptimisticTransferFeeIndexTransaction({
    id: localTransferFeeId(params.clientMutationId),
    data: params.data,
    amountCurrency: params.amountCurrency,
    today: params.today,
  });

  const childDates = expandLocalSeriesOccurrenceDates({
    parentDate: params.data.date,
    scheduleType: params.data.scheduleType,
    repeatInterval: params.data.repeatInterval,
    today: params.today,
  });

  const childTransfers = childDates.map((date, index) =>
    buildOptimisticTransferIndexTransaction({
      id: localSeriesChildId(params.clientMutationId, index),
      data: params.data,
      amountCurrency: params.amountCurrency,
      date,
      today: params.today,
    }),
  );

  const childFees = childDates.flatMap((date, index) => {
    const fee = buildOptimisticTransferFeeIndexTransaction({
      id: localSeriesChildTransferFeeId(params.clientMutationId, index),
      data: params.data,
      amountCurrency: params.amountCurrency,
      date,
      today: params.today,
    });
    return fee ? [fee] : [];
  });

  const allRows = [
    parent,
    ...(parentFee ? [parentFee] : []),
    ...childTransfers,
    ...childFees,
  ];

  return {
    parent,
    parentFee,
    childTransfers,
    childFees,
    allRows,
  };
};

const extractCreatedId = (response: unknown): string | undefined => {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const root = response as Record<string, unknown>;
  const data = root.data;

  if (typeof root.id === "string" && root.id) {
    return root.id;
  }

  if (data && typeof data === "object") {
    const nestedId = (data as { id?: unknown }).id;
    if (typeof nestedId === "string" && nestedId) {
      return nestedId;
    }
  }

  return undefined;
};

const isNetworkLikeCreateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to create transfer" ||
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

const applyFeeSummary = async (params: {
  spaceId: string;
  fee: IndexTransactionWithCategoryIds;
  mode: "add" | "remove";
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, fee, mode, queryClient } = params;
  const nextSummaries = await applyLocalTransactionToMonthlySummaries({
    spaceCode: spaceId,
    date: fee.date,
    amount: Math.abs(Number(fee.amount) || 0),
    type: "expense",
    mode,
    currency: fee.amountCurrency,
  });
  if (queryClient && nextSummaries) {
    setMonthlyFinancialSummariesQueryData(queryClient, spaceId, nextSummaries);
  }
};

const removeFeePlaceholders = async (params: {
  spaceId: string;
  fees: Array<IndexTransactionWithCategoryIds | null | undefined>;
  queryClient?: QueryClient;
}): Promise<void> => {
  const fees = params.fees.filter(
    (fee): fee is IndexTransactionWithCategoryIds => Boolean(fee),
  );
  if (fees.length === 0) return;

  await removeLocalIndexTransactionsByIds(
    params.spaceId,
    fees.map((fee) => fee.id),
  );
  for (const fee of fees) {
    await applyFeeSummary({
      spaceId: params.spaceId,
      fee,
      mode: "remove",
      queryClient: params.queryClient,
    });
  }
  if (params.queryClient) {
    removeIndexTransactionsFromQueryCaches(params.queryClient, {
      spaceId: params.spaceId,
      removedTransactions: fees,
    });
  }
};

const removeOptimisticSeriesChildren = async (params: {
  spaceId: string;
  clientMutationId: string;
  childTransfers: IndexTransactionWithCategoryIds[];
  childFees: IndexTransactionWithCategoryIds[];
  queryClient?: QueryClient;
}): Promise<void> => {
  const childRows = [...params.childTransfers, ...params.childFees];
  if (childRows.length === 0) {
    return;
  }

  await removeLocalSeriesChildrenForMutation(
    params.spaceId,
    params.clientMutationId,
  );

  for (const fee of params.childFees) {
    await applyFeeSummary({
      spaceId: params.spaceId,
      fee,
      mode: "remove",
      queryClient: params.queryClient,
    });
  }

  if (params.queryClient) {
    removeIndexTransactionsFromQueryCaches(params.queryClient, {
      spaceId: params.spaceId,
      removedTransactions: childRows,
    });
  }
};

/**
 * Local-first transfer create: IndexedDB + RQ first (including fee expense),
 * expands near-term series children + fees (same window as income/expense),
 * then POST.
 */
export const createTransferLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    data: CreateTransferType;
    amountCurrency?: string;
  },
  options: CreateTransferLocalFirstOptions = {},
): Promise<CreateTransferLocalFirstResult> => {
  const { spaceId, data, amountCurrency } = params;
  const { queryClient, waitForSync = true, today } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to create a local transfer");
  }

  assertCreateTransferForOptimistic(data);

  const clientMutationId = newClientMutationId();
  const {
    parent: localTransaction,
    parentFee: localFeeTransaction,
    childTransfers,
    childFees,
    allRows: optimisticRows,
  } = buildOptimisticSeriesTransfers({
    clientMutationId,
    data,
    amountCurrency,
    today,
  });
  const localId = localTransaction.id;
  const localSeriesTransactions = [localTransaction, ...childTransfers];
  const localSeriesFeeTransactions = [
    ...(localFeeTransaction ? [localFeeTransaction] : []),
    ...childFees,
  ];

  // 1) Instant UI — show transfer(s) + fee(s) before IndexedDB / network.
  if (queryClient) {
    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: optimisticRows,
    });
  }

  // 2) Persist IndexedDB + outbox.
  for (const row of optimisticRows) {
    await upsertLocalIndexTransaction(spaceId, row);
  }
  for (const fee of localSeriesFeeTransactions) {
    await applyFeeSummary({
      spaceId,
      fee,
      mode: "add",
      queryClient,
    });
  }

  if (queryClient) {
    invalidateLocalInsightsQueries(queryClient);
  }

  const payloadForOutbox = await buildCreateOutboxPayload({
    spaceId,
    ownerType: "transfer",
    ownerId: localId,
    data,
  });
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_TRANSFER_CREATE,
    payload: payloadForOutbox,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  const syncPromise = (async (): Promise<CreateTransferLocalFirstResult> => {
    try {
      const serverResponse = await createTransfer(api, data);
      const serverId = extractCreatedId(serverResponse) ?? localId;

      if (serverId !== localId) {
        await replaceLocalIndexTransactionId(spaceId, localId, serverId);
        await syncAttachmentOwnerId({
          spaceId,
          ownerType: "transfer",
          localOwnerId: localId,
          serverOwnerId: serverId,
        });
        if (queryClient) {
          replaceIndexTransactionIdInQueryCaches(queryClient, {
            spaceId,
            previousId: localId,
            nextId: serverId,
          });
        }
      }

      // Server expands the series; drop optimistic children (+ child fees) so
      // realtime/server rows do not duplicate. Keep parent fee until realtime.
      await removeOptimisticSeriesChildren({
        spaceId,
        clientMutationId,
        childTransfers,
        childFees,
        queryClient,
      });

      // Re-assert parent (+ fee) after sync — remount refetch can race the POST.
      if (queryClient) {
        upsertIndexTransactionsIntoQueryCaches(queryClient, {
          spaceId,
          transactions: localFeeTransaction
            ? [
                {
                  ...localTransaction,
                  id: serverId,
                },
                localFeeTransaction,
              ]
            : [
                {
                  ...localTransaction,
                  id: serverId,
                },
              ],
        });
      }

      await removeOutboxRecord(clientMutationId);

      return {
        data: { id: serverId },
        pendingSync: false,
        localTransaction: {
          ...localTransaction,
          id: serverId,
        },
        localFeeTransaction,
        localSeriesTransactions: [
          {
            ...localTransaction,
            id: serverId,
          },
        ],
        localSeriesFeeTransactions: localFeeTransaction
          ? [localFeeTransaction]
          : [],
        serverResponse,
        syncPromise,
      };
    } catch (error) {
      if (isNetworkLikeCreateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error
              ? error.message
              : "Network error creating transfer",
        });

        return {
          data: { id: localId },
          pendingSync: true,
          localTransaction,
          localFeeTransaction,
          localSeriesTransactions,
          localSeriesFeeTransactions,
          syncPromise,
        };
      }

      await removeLocalIndexTransaction(spaceId, localId);
      await rollbackCreateAttachments({
        spaceId,
        ownerType: "transfer",
        ownerId: localId,
      });
      await removeOptimisticSeriesChildren({
        spaceId,
        clientMutationId,
        childTransfers,
        childFees,
        queryClient,
      });
      await removeFeePlaceholders({
        spaceId,
        fees: [localFeeTransaction],
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);

      if (queryClient) {
        removeIndexTransactionsFromQueryCaches(queryClient, {
          spaceId,
          removedTransactions: [localTransaction],
        });
      }

      throw error;
    }
  })();

  const optimisticResult: CreateTransferLocalFirstResult = {
    data: { id: localId },
    pendingSync: true,
    localTransaction,
    localFeeTransaction,
    localSeriesTransactions,
    localSeriesFeeTransactions,
    syncPromise,
  };

  if (waitForSync) {
    return syncPromise;
  }

  return optimisticResult;
};
