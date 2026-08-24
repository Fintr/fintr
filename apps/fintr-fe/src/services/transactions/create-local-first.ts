import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { cacheEditDetailFromIndexRow } from "@/services/transactions/detail-local";
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
import { attachCreateTransactionRelationIds } from "./relation-ids-local";

import {
  buildCreateOutboxPayload,
  rollbackCreateAttachments,
  syncAttachmentOwnerId,
} from "@/services/attachments/create-outbox";

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
  /** Currency the user entered in the amount picker (e.g. GBP). */
  entryCurrency?: string;
  /** Space / ledger currency used for converted list amounts (e.g. PHP). */
  spaceCurrency?: string;
}): Pick<
  IndexTransactionWithCategoryIds,
  "amount" | "amountCurrency" | "bookedAmount" | "bookedAmountCurrency"
> => {
  const {
    occurrenceAmount: originalAmount,
    data,
    entryCurrency,
    spaceCurrency,
  } = params;
  const originalCurrency = data.original_currency?.trim() || entryCurrency?.trim();
  const rate = Number(data.exchange_rate);
  const ledgerCurrency = spaceCurrency?.trim() || entryCurrency?.trim();

  if (
    originalCurrency &&
    ledgerCurrency &&
    Number.isFinite(rate) &&
    rate > 0 &&
    originalCurrency.toUpperCase() !== ledgerCurrency.toUpperCase()
  ) {
    return {
      amount: roundMoney(originalAmount * rate),
      amountCurrency: ledgerCurrency,
      bookedAmount: originalAmount,
      bookedAmountCurrency: originalCurrency,
    };
  }

  const displayCurrency = originalCurrency || ledgerCurrency;

  return {
    amount: originalAmount,
    amountCurrency: displayCurrency,
  };
};

export const buildOptimisticIndexTransaction = (params: {
  id: string;
  data: CreateTransactionType;
  entryCurrency?: string;
  spaceCurrency?: string;
  date?: string;
  amount?: number;
  parentId?: string | null;
  /** Override "today" for deterministic calculated state in tests. */
  today?: string;
}): IndexTransactionWithCategoryIds => {
  const { id, data, entryCurrency, spaceCurrency } = params;
  const isIncome = data.transactionType === "income";
  const rawAmount = params.amount ?? occurrenceAmount(data);
  const date = params.date ?? data.date;

  const money = optimisticIndexMoneyFromCreate({
    occurrenceAmount: rawAmount,
    data,
    entryCurrency,
    spaceCurrency,
  });
  const rate = Number(data.exchange_rate);
  const currencyConversion =
    money.bookedAmount != null
    && money.bookedAmountCurrency
    && money.amountCurrency
    && money.bookedAmountCurrency !== money.amountCurrency
    && Number.isFinite(rate)
    && rate > 0
      ? {
          originalAmount: money.bookedAmount,
          originalCurrency: money.bookedAmountCurrency,
          convertedAmount: money.amount,
          convertedCurrency: money.amountCurrency,
          exchangeRate: rate,
          source: data.exchange_rate_source ?? "manual",
        }
      : undefined;

  return {
    id,
    date,
    calculated: isTransactionCalculatedForDate(date, params.today),
    createdAt: new Date().toISOString(),
    description: data.description ?? "",
    ...money,
    ...(currencyConversion ? { currencyConversion } : {}),
    categoryName: data.categoryName,
    fromAccountName: isIncome ? "" : data.accountName,
    toAccountName: isIncome ? data.accountName : "",
    type: isIncome
      ? CombinedTransactionTypeEnum.INCOME
      : CombinedTransactionTypeEnum.EXPENSE,
    inSeries: data.scheduleType !== ScheduleTypeEnum.ONE_TIME,
    parentId: params.parentId ?? null,
    scheduleType: data.scheduleType,
    repeatInterval:
      data.scheduleType === ScheduleTypeEnum.REPEAT
        ? (data.repeatInterval ?? "")
        : undefined,
    installmentPeriod:
      data.scheduleType === ScheduleTypeEnum.INSTALLMENT
        ? (data.installmentPeriod ?? null)
        : undefined,
    rootParentId:
      data.scheduleType !== ScheduleTypeEnum.ONE_TIME
        ? (params.parentId ?? id)
        : null,
    hasImage: Boolean(data.file || data.fileId),
    categoryId: data.categoryId ?? null,
    subcategoryId: data.subcategoryId ?? null,
    entityName: data.entityName || undefined,
    entityId: data.entityId ?? null,
    accountId: data.accountId ?? null,
    fromAccountId: isIncome ? null : (data.accountId ?? null),
    toAccountId: isIncome ? (data.accountId ?? null) : null,
    tagIds: data.tagIds,
    tags: data.tags,
  };
};

export const buildOptimisticSeriesTransactions = (params: {
  clientMutationId: string;
  data: CreateTransactionType;
  entryCurrency?: string;
  spaceCurrency?: string;
  /** Override "today" for deterministic series expansion in tests. */
  today?: string;
}): IndexTransactionWithCategoryIds[] => {
  const amount = occurrenceAmount(params.data);
  const parent = buildOptimisticIndexTransaction({
    id: `local:${params.clientMutationId}`,
    data: params.data,
    entryCurrency: params.entryCurrency,
    spaceCurrency: params.spaceCurrency,
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
      entryCurrency: params.entryCurrency,
      spaceCurrency: params.spaceCurrency,
      date,
      amount,
      parentId: parent.id,
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
  summaryCurrency?: string;
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
      currency: row.amountCurrency ?? params.summaryCurrency,
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
  summaryCurrency?: string;
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
    summaryCurrency: params.summaryCurrency,
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
 * then POST. Repeat/installment schedules also write optimistic child rows.
 * Installments expand the full term; repeats use past through today + future +1 month.
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
    /** Currency shown in the amount picker (e.g. GBP). */
    entryCurrency?: string;
    /** Space / ledger currency for converted optimistic rows (e.g. PHP). */
    spaceCurrency?: string;
    /** @deprecated Prefer entryCurrency + spaceCurrency. */
    amountCurrency?: string;
  },
  options: CreateTransactionLocalFirstOptions = {},
): Promise<CreateTransactionLocalFirstResult> => {
  const { spaceId } = params;
  const entryCurrency = params.entryCurrency ?? params.amountCurrency;
  const spaceCurrency = params.spaceCurrency ?? params.amountCurrency;
  const { queryClient, waitForSync = true, today } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to create a local transaction");
  }

  const data = await attachCreateTransactionRelationIds(spaceId, params.data);

  assertCreateTransactionForOptimistic(data);

  const clientMutationId = newClientMutationId();
  const seriesRows = buildOptimisticSeriesTransactions({
    clientMutationId,
    data,
    entryCurrency,
    spaceCurrency,
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
    await cacheEditDetailFromIndexRow(spaceId, row);
  }
  await applySummariesForRows({
    spaceId,
    rows: seriesRows,
    transactionType: data.transactionType,
    mode: "add",
    summaryCurrency: spaceCurrency ?? entryCurrency,
    queryClient,
  });

  if (queryClient) {
    invalidateLocalInsightsQueries(queryClient);
    queryClient.invalidateQueries({
      queryKey: ["recurringSeries", spaceId],
      exact: false,
      refetchType: "active",
    });
  }

  // Persist attachment blob + JSON-safe outbox payload (file stripped).
  const payloadForOutbox = await buildCreateOutboxPayload({
    spaceId,
    ownerType: "transaction",
    ownerId: localTransaction.id,
    data,
  });
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
        await syncAttachmentOwnerId({
          spaceId,
          ownerType: "transaction",
          localOwnerId: localTransaction.id,
          serverOwnerId: serverId,
        });
        if (queryClient) {
          replaceIndexTransactionIdInQueryCaches(queryClient, {
            spaceId,
            previousId: localTransaction.id,
            nextId: serverId,
          });
        }
      }

      // Server expands the series. For installments, keep optimistic children
      // until realtime rows arrive (reconciled by date in apply-transaction-change).
      if (data.scheduleType !== ScheduleTypeEnum.INSTALLMENT) {
        await removeOptimisticSeriesChildren({
          spaceId,
          clientMutationId,
          childRows,
          transactionType: data.transactionType,
          summaryCurrency: spaceCurrency ?? entryCurrency,
          queryClient,
        });
      }

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
      await rollbackCreateAttachments({
        spaceId,
        ownerType: "transaction",
        ownerId: localTransaction.id,
      });
      await applySummariesForRows({
        spaceId,
        rows: seriesRows,
        transactionType: data.transactionType,
        mode: "remove",
        summaryCurrency: spaceCurrency ?? entryCurrency,
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
