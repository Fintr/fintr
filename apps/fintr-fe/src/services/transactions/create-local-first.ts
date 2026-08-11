import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyLocalTransactionToMonthlySummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { isTransactionCalculatedForDate } from "@/utils/transactionCalculated";

import {
  loadLocalIndexTransactionById,
  removeLocalIndexTransactionsByIds,
  removeLocalSeriesChildrenForMutation,
  replaceLocalIndexTransactionId,
  upsertLocalIndexTransaction,
} from "./local-cache";
import {
  createTransaction,
  type CreateTransactionType,
} from "./mutation";
import { removeIndexTransactionsFromQueryCaches } from "./remove-from-query-caches";
import {
  expandLocalSeriesOccurrenceDates,
  localSeriesChildId,
} from "./schedule-occurrence-dates";
import {
  replaceIndexTransactionIdInQueryCaches,
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "./upsert-into-query-caches";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";
import { assertCreateTransactionForOptimistic } from "@fintr/domain";

export type CreateTransactionLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localTransaction: IndexTransactionWithCategoryIds;
  localSeriesTransactions: IndexTransactionWithCategoryIds[];
  /** Original API payload when the backend responded. */
  serverResponse?: unknown;
  /** Settles when the network attempt finishes (success, offline keep, or validation throw). */
  syncPromise: Promise<CreateTransactionLocalFirstResult>;
};

export type CreateTransactionLocalFirstOptions = {
  queryClient?: QueryClient;
  /**
   * When false, return as soon as the local optimistic write (and RQ patch) completes.
   * Defaults to true so existing callers/tests keep awaiting the network.
   */
  waitForSync?: boolean;
  /** Override "today" for deterministic series expansion in tests. */
  today?: string;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const occurrenceAmount = (data: CreateTransactionType): number => {
  const amount = Math.abs(Number(data.amount) || 0);
  if (
    data.scheduleType === ScheduleTypeEnum.INSTALLMENT &&
    data.installmentPeriod != null &&
    Number(data.installmentPeriod) > 0
  ) {
    return amount / Number(data.installmentPeriod);
  }
  return amount;
};

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/**
 * Index rows show space/ledger-normalized `amount`. Create payloads send the
 * original FX amount plus `exchange_rate` — mirror backend
 * PrepareCurrencyConversion (`converted = original * rate`) so optimistic
 * lists do not render e.g. 200 GBP as ₱200.
 */
export const optimisticIndexMoneyFromCreate = (params: {
  occurrenceAmount: number;
  data: CreateTransactionType;
  amountCurrency?: string;
}): Pick<
  IndexTransactionWithCategoryIds,
  "amount" | "amountCurrency" | "bookedAmount" | "bookedAmountCurrency"
> => {
  const { occurrenceAmount: originalAmount, data, amountCurrency } = params;
  const originalCurrency = data.original_currency?.trim();
  const rate = Number(data.exchange_rate);

  if (
    originalCurrency &&
    Number.isFinite(rate) &&
    rate > 0 &&
    (!amountCurrency ||
      originalCurrency.toUpperCase() !== amountCurrency.toUpperCase())
  ) {
    return {
      amount: roundMoney(originalAmount * rate),
      amountCurrency,
      bookedAmount: originalAmount,
      bookedAmountCurrency: originalCurrency,
    };
  }

  return {
    amount: originalAmount,
    amountCurrency,
  };
};

export const buildOptimisticIndexTransaction = (params: {
  id: string;
  data: CreateTransactionType;
  amountCurrency?: string;
  date?: string;
  amount?: number;
  /** Override "today" for deterministic calculated state in tests. */
  today?: string;
}): IndexTransactionWithCategoryIds => {
  const { id, data, amountCurrency } = params;
  const isIncome = data.transactionType === "income";
  const rawAmount = params.amount ?? occurrenceAmount(data);
  const money = optimisticIndexMoneyFromCreate({
    occurrenceAmount: rawAmount,
    data,
    amountCurrency,
  });
  const date = params.date ?? data.date;

  return {
    id,
    date,
    calculated: isTransactionCalculatedForDate(date, params.today),
    createdAt: new Date().toISOString(),
    description: data.description ?? "",
    ...money,
    categoryName: data.categoryName,
    fromAccountName: isIncome ? "" : data.accountName,
    toAccountName: isIncome ? data.accountName : "",
    type: isIncome
      ? CombinedTransactionTypeEnum.INCOME
      : CombinedTransactionTypeEnum.EXPENSE,
    inSeries: data.scheduleType !== ScheduleTypeEnum.ONE_TIME,
    hasImage: Boolean(data.file || data.fileId),
    categoryId: data.categoryId ?? null,
    subcategoryId: data.subcategoryId ?? null,
    entityName: data.entityName || undefined,
    tagIds: data.tagIds,
    tags: data.tags,
  };
};

export const buildOptimisticSeriesTransactions = (params: {
  clientMutationId: string;
  data: CreateTransactionType;
  amountCurrency?: string;
  /** Override "today" for deterministic series expansion in tests. */
  today?: string;
}): IndexTransactionWithCategoryIds[] => {
  const amount = occurrenceAmount(params.data);
  const parent = buildOptimisticIndexTransaction({
    id: `local:${params.clientMutationId}`,
    data: params.data,
    amountCurrency: params.amountCurrency,
    amount,
    today: params.today,
  });

  const childDates = expandLocalSeriesOccurrenceDates({
    parentDate: params.data.date,
    scheduleType: params.data.scheduleType,
    repeatInterval: params.data.repeatInterval,
    installmentPeriod: params.data.installmentPeriod,
    today: params.today,
  });

  const children = childDates.map((date, index) =>
    buildOptimisticIndexTransaction({
      id: localSeriesChildId(params.clientMutationId, index),
      data: params.data,
      amountCurrency: params.amountCurrency,
      date,
      amount,
      today: params.today,
    }),
  );

  return [parent, ...children];
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
      error.message === "Failed to create transaction" ||
      error.message.toLowerCase().includes("network")
    );
  }

  // Structured API validation errors are plain objects with message/details.
  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; success?: unknown };
    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return false;
};

const applySummariesForRows = async (params: {
  spaceId: string;
  rows: IndexTransactionWithCategoryIds[];
  transactionType: "income" | "expense";
  mode: "add" | "remove";
  amountCurrency?: string;
  queryClient?: QueryClient;
}): Promise<void> => {
  let nextSummaries = null;
  for (const row of params.rows) {
    nextSummaries = await applyLocalTransactionToMonthlySummaries({
      spaceCode: params.spaceId,
      date: row.date,
      amount: row.amount,
      type: params.transactionType,
      mode: params.mode,
      currency: params.amountCurrency,
    });
  }

  if (params.queryClient && nextSummaries) {
    setMonthlyFinancialSummariesQueryData(
      params.queryClient,
      params.spaceId,
      nextSummaries,
    );
  }
};

const patchQueryCachesForCreate = (params: {
  queryClient?: QueryClient;
  spaceId: string;
  rows: IndexTransactionWithCategoryIds[];
}): void => {
  const { queryClient, spaceId, rows } = params;
  if (!queryClient || rows.length === 0) return;

  upsertIndexTransactionsIntoQueryCaches(queryClient, {
    spaceId,
    transactions: rows,
  });
};

const rollbackQueryCachesForCreate = (params: {
  queryClient?: QueryClient;
  spaceId: string;
  rows: IndexTransactionWithCategoryIds[];
}): void => {
  const { queryClient, spaceId, rows } = params;
  if (!queryClient || rows.length === 0) return;

  removeIndexTransactionsFromQueryCaches(queryClient, {
    spaceId,
    removedTransactions: rows,
  });
};

const removeOptimisticSeriesChildren = async (params: {
  spaceId: string;
  clientMutationId: string;
  childRows: IndexTransactionWithCategoryIds[];
  transactionType: "income" | "expense";
  amountCurrency?: string;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { childRows } = params;
  if (childRows.length === 0) {
    return;
  }

  await removeLocalSeriesChildrenForMutation(
    params.spaceId,
    params.clientMutationId,
  );
  await applySummariesForRows({
    spaceId: params.spaceId,
    rows: childRows,
    transactionType: params.transactionType,
    mode: "remove",
    amountCurrency: params.amountCurrency,
    queryClient: params.queryClient,
  });
  rollbackQueryCachesForCreate({
    queryClient: params.queryClient,
    spaceId: params.spaceId,
    rows: childRows,
  });
};

/**
 * Local-first create: React Query first (instant UI), then IndexedDB + outbox,
 * then POST. Repeat/installment schedules also write the same near-term child
 * rows the server creates (past through today + future through +1 month).
 * On network failure the local series stays and an outbox entry remains pending.
 * On API validation errors the local write is rolled back and the error is rethrown.
 *
 * Pass `waitForSync: false` to return immediately after the optimistic RQ/IDB write.
 */
export const createTransactionLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    data: CreateTransactionType;
    amountCurrency?: string;
  },
  options: CreateTransactionLocalFirstOptions = {},
): Promise<CreateTransactionLocalFirstResult> => {
  const { spaceId, data, amountCurrency } = params;
  const { queryClient, waitForSync = true, today } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to create a local transaction");
  }

  assertCreateTransactionForOptimistic(data);

  const clientMutationId = newClientMutationId();
  const seriesRows = buildOptimisticSeriesTransactions({
    clientMutationId,
    data,
    amountCurrency,
    today,
  });
  const localTransaction = seriesRows[0]!;
  const childRows = seriesRows.slice(1);

  // 1) Instant UI — show parent (+ series children) before IndexedDB / network.
  patchQueryCachesForCreate({
    queryClient,
    spaceId,
    rows: seriesRows,
  });

  // 2) Persist IndexedDB + monthly summaries + outbox.
  for (const row of seriesRows) {
    await upsertLocalIndexTransaction(spaceId, row);
  }
  await applySummariesForRows({
    spaceId,
    rows: seriesRows,
    transactionType: data.transactionType,
    mode: "add",
    amountCurrency,
    queryClient,
  });

  if (queryClient) {
    invalidateLocalInsightsQueries(queryClient);
  }

  // Strip File from outbox payload (not structured-clone friendly / not for later drain yet).
  const { file: _file, ...payloadForOutbox } = data;
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
    payload: payloadForOutbox,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  const syncPromise = (async (): Promise<CreateTransactionLocalFirstResult> => {
    try {
      const serverResponse = await createTransaction(api, {
        ...data,
        clientMutationId,
      });
      const serverId = extractCreatedId(serverResponse) ?? localTransaction.id;

      if (serverId !== localTransaction.id) {
        await replaceLocalIndexTransactionId(
          spaceId,
          localTransaction.id,
          serverId,
        );
        if (queryClient) {
          replaceIndexTransactionIdInQueryCaches(queryClient, {
            spaceId,
            previousId: localTransaction.id,
            nextId: serverId,
          });
        }
      }

      // Server expands the series; drop optimistic children so realtime/server
      // rows do not duplicate local placeholders.
      await removeOptimisticSeriesChildren({
        spaceId,
        clientMutationId,
        childRows,
        transactionType: data.transactionType,
        amountCurrency,
        queryClient,
      });

      // Prefer the IndexedDB row after id replace — realtime may have already
      // written the server-converted amount under serverId.
      const reconciledParent = (await loadLocalIndexTransactionById(
        spaceId,
        serverId,
      )) ?? {
        ...localTransaction,
        id: serverId,
      };
      const reconciledRow = {
        ...localTransaction,
        ...reconciledParent,
        id: serverId,
      } as IndexTransactionWithCategoryIds;

      // Re-assert parent after sync — do not invalidate active lists (refetch can
      // race and drop the optimistic/server parent before realtime children land).
      if (queryClient) {
        upsertIndexTransactionsIntoQueryCaches(queryClient, {
          spaceId,
          transactions: [reconciledRow],
        });
      }

      await removeOutboxRecord(clientMutationId);

      const synced: CreateTransactionLocalFirstResult = {
        data: { id: serverId },
        pendingSync: false,
        localTransaction: reconciledRow,
        localSeriesTransactions: [reconciledRow],
        serverResponse,
        syncPromise,
      };
      return synced;
    } catch (error) {
      if (isNetworkLikeCreateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error
              ? error.message
              : "Network error creating transaction",
        });

        return {
          data: { id: localTransaction.id },
          pendingSync: true,
          localTransaction,
          localSeriesTransactions: seriesRows,
          syncPromise,
        };
      }

      await removeLocalIndexTransactionsByIds(
        spaceId,
        seriesRows.map((row) => row.id),
      );
      await applySummariesForRows({
        spaceId,
        rows: seriesRows,
        transactionType: data.transactionType,
        mode: "remove",
        amountCurrency,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);

      rollbackQueryCachesForCreate({
        queryClient,
        spaceId,
        rows: seriesRows,
      });

      throw error;
    }
  })();

  // Attach the same promise onto the optimistic result for callers.
  const optimisticResult: CreateTransactionLocalFirstResult = {
    data: { id: localTransaction.id },
    pendingSync: true,
    localTransaction,
    localSeriesTransactions: seriesRows,
    syncPromise,
  };

  if (waitForSync) {
    return syncPromise;
  }

  return optimisticResult;
};
