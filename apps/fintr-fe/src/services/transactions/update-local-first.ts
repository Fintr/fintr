import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TRANSACTION_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyLocalTransactionToMonthlySummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { isTransactionCalculatedForDate } from "@/utils/transactionCalculated";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";

import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "./local-cache";
import {
  updateTransaction,
  type UpdateTransactionType,
} from "./mutation";
import {
  optimisticIndexMoneyFromCreate,
} from "./create-local-first";
import {
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "./upsert-into-query-caches";

export type UpdateTransactionLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localTransaction: IndexTransactionWithCategoryIds;
  previousTransaction: IndexTransactionWithCategoryIds;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateTransactionLocalFirstResult>;
};

export type UpdateTransactionLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const toIncomeExpenseType = (
  type: IndexTransaction["type"] | UpdateTransactionType["transactionType"],
): "income" | "expense" => {
  if (type === "income" || type === CombinedTransactionTypeEnum.INCOME) {
    return "income";
  }
  return "expense";
};

const normalizeCurrency = (code: string): string => code.trim().toUpperCase();

const isNetworkLikeUpdateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      error.message === "Failed to create transaction"
      || message.includes("network")
      || message.includes("failed to fetch")
      || message.includes("offline")
      || message.includes("timeout")
      || message.includes("err_network")
      || message.includes("err_internet_disconnected")
    );
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      code?: unknown;
      details?: unknown;
      success?: unknown;
      response?: unknown;
    };

    // Axios offline / no-response errors should stay pending, not roll back.
    if (record.response == null) {
      const code =
        typeof record.code === "string" ? record.code.toLowerCase() : "";
      if (
        code === "err_network"
        || code === "econnaborted"
        || code === "etimedout"
      ) {
        return true;
      }
    }

    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return false;
};

export const buildUpdatedIndexTransaction = (params: {
  previous: IndexTransaction;
  data: UpdateTransactionType;
  amountCurrency?: string;
}): IndexTransactionWithCategoryIds => {
  const { previous, data, amountCurrency } = params;
  const transactionType = data.transactionType ?? toIncomeExpenseType(previous.type);
  const money = optimisticIndexMoneyFromCreate({
    occurrenceAmount: Math.abs(Number(data.amount) || 0),
    data: {
      ...data,
      transactionType,
      categoryName: data.categoryName || previous.categoryName || "",
      accountName:
        data.accountName
        || (transactionType === "income"
          ? previous.toAccountName
          : previous.fromAccountName)
        || "",
      date: data.date || previous.date,
      scheduleType: data.scheduleType,
    },
    amountCurrency: amountCurrency ?? previous.amountCurrency,
  });

  const nextType =
    transactionType === "income"
      ? CombinedTransactionTypeEnum.INCOME
      : CombinedTransactionTypeEnum.EXPENSE;

  const accountName =
    data.accountName
    || (transactionType === "income"
      ? previous.toAccountName
      : previous.fromAccountName)
    || "";

  const bookedAmount = Math.abs(
    money.bookedAmount ?? Math.abs(Number(money.amount) || 0),
  );
  const bookedAmountCurrency =
    money.bookedAmountCurrency
    ?? money.amountCurrency
    ?? previous.amountCurrency;

  const updateData = data as UpdateTransactionType & {
    original_currency?: string;
    exchange_rate?: number;
    exchange_rate_source?: "auto" | "manual" | "recent";
  };

  const previousConversion = (
    previous as IndexTransaction & {
      currencyConversion?: {
        originalAmount?: number;
        originalCurrency?: string;
        convertedAmount?: number;
        convertedCurrency?: string;
        exchangeRate?: number;
        source?: string;
        rateTimestamp?: string;
        note?: string | null;
        id?: string;
      };
    }
  ).currencyConversion;

  const next: IndexTransactionWithCategoryIds & {
    currencyConversion?: NonNullable<typeof previousConversion>;
  } = {
    ...previous,
    ...money,
    id: previous.id,
    description: data.description ?? previous.description,
    date: data.date || previous.date,
    categoryName: data.categoryName || previous.categoryName,
    categoryId: data.categoryId ?? previous.categoryId,
    subcategoryId: data.subcategoryId ?? previous.subcategoryId,
    subcategoryName: previous.subcategoryName,
    type: nextType,
    fromAccountName:
      transactionType === "expense" ? accountName : previous.fromAccountName,
    toAccountName:
      transactionType === "income" ? accountName : previous.toAccountName,
    calculated: isTransactionCalculatedForDate(data.date || previous.date),
    tagIds: data.tagIds ?? previous.tagIds,
    tags: data.tags ?? previous.tags,
    // Always refresh booked legs — spreading `previous` would leave a stale
    // bookedAmount and offline dashboard hybrid totals would ignore the edit.
    bookedAmount,
    bookedAmountCurrency,
  };

  const hasFxConversion =
    Boolean(updateData.original_currency?.trim())
    && Number(updateData.exchange_rate) > 0
    && bookedAmountCurrency
    && money.amountCurrency
    && normalizeCurrency(bookedAmountCurrency)
      !== normalizeCurrency(money.amountCurrency);

  if (hasFxConversion || previousConversion) {
    const exchangeRate = Number(updateData.exchange_rate) > 0
      ? Number(updateData.exchange_rate)
      : previousConversion?.exchangeRate
        ?? (
          bookedAmount !== 0
            ? Math.abs(Number(money.amount) || 0) / bookedAmount
            : 1
        );

    next.currencyConversion = {
      ...previousConversion,
      originalAmount: bookedAmount,
      originalCurrency:
        updateData.original_currency?.trim()
        ?? previousConversion?.originalCurrency
        ?? bookedAmountCurrency
        ?? "PHP",
      convertedAmount: Math.abs(Number(money.amount) || 0),
      convertedCurrency:
        previousConversion?.convertedCurrency
        ?? money.amountCurrency
        ?? bookedAmountCurrency
        ?? "PHP",
      exchangeRate,
      source:
        updateData.exchange_rate_source
        ?? previousConversion?.source
        ?? "manual",
    };
  }

  if (data.tagIds && data.tagIds.length === 0) {
    next.tagIds = [];
    next.tags = [];
  }

  return next;
};

const applySummaryDelta = async (params: {
  spaceId: string;
  previous: IndexTransaction;
  next: IndexTransaction;
  amountCurrency?: string;
  queryClient?: QueryClient;
}): Promise<void> => {
  const previousType = toIncomeExpenseType(params.previous.type);
  const nextType = toIncomeExpenseType(params.next.type);

  let nextSummaries = await applyLocalTransactionToMonthlySummaries({
    spaceCode: params.spaceId,
    date: params.previous.date,
    amount: Math.abs(Number(params.previous.amount) || 0),
    type: previousType,
    mode: "remove",
    currency: params.amountCurrency,
  });

  nextSummaries = await applyLocalTransactionToMonthlySummaries({
    spaceCode: params.spaceId,
    date: params.next.date,
    amount: Math.abs(Number(params.next.amount) || 0),
    type: nextType,
    mode: "add",
    currency: params.amountCurrency,
  });

  if (params.queryClient && nextSummaries) {
    setMonthlyFinancialSummariesQueryData(
      params.queryClient,
      params.spaceId,
      nextSummaries,
    );
  }
};

/**
 * Local-first update: patch RQ + IndexedDB + monthly buckets immediately,
 * enqueue outbox, then PUT. Offline edits survive reload and refresh tag/category
 * filtered insights from the same local rows.
 */
export const updateTransactionLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    data: UpdateTransactionType;
    previous?: IndexTransaction;
    amountCurrency?: string;
  },
  options: UpdateTransactionLocalFirstOptions = {},
): Promise<UpdateTransactionLocalFirstResult> => {
  const { spaceId, data, amountCurrency } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to update a local transaction");
  }
  if (!data?.id) {
    throw new Error("transaction id is required to update");
  }

  const stored =
    params.previous
    ?? (await loadLocalIndexTransactionById(spaceId, data.id));

  if (!stored) {
    throw new Error("Local transaction not found for update");
  }

  const previous = stored as IndexTransactionWithCategoryIds;
  const localTransaction = buildUpdatedIndexTransaction({
    previous,
    data,
    amountCurrency,
  });

  if (queryClient) {
    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [localTransaction],
    });
  }

  await upsertLocalIndexTransaction(spaceId, localTransaction);
  await applySummaryDelta({
    spaceId,
    previous,
    next: localTransaction,
    amountCurrency,
    queryClient,
  });

  // Keep edit-dialog detail cache aligned with the list amount (preferLocal
  // reads this even while online when space sync pull is enabled).
  try {
    const {
      cacheTransactionDetail,
      mapIndexTransactionToEditDataSync,
    } = await import("./detail-local");
    await cacheTransactionDetail(
      spaceId,
      localTransaction.id,
      mapIndexTransactionToEditDataSync(localTransaction),
    );
  } catch (error) {
    console.warn(
      "[transactions] Failed to refresh transaction detail cache after update",
      error,
    );
  }

  if (queryClient) {
    invalidateLocalInsightsQueries(queryClient);
    void queryClient.invalidateQueries({
      queryKey: ["dashboard", "transactions", spaceId],
      exact: false,
      refetchType: "active",
    });
    void queryClient.invalidateQueries({
      queryKey: ["dashboard", "local", spaceId],
      exact: false,
      refetchType: "active",
    });
  }

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_TRANSACTION_UPDATE,
    payload: {
      ...data,
      id: previous.id,
    },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateTransactionLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateTransactionLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateTransaction(api, {
        ...data,
        id: previous.id,
      });
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: previous.id },
        pendingSync: false,
        localTransaction,
        previousTransaction: previous,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeUpdateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on update",
        });

        resolveSync({
          data: { id: previous.id },
          pendingSync: true,
          localTransaction,
          previousTransaction: previous,
          syncPromise,
        });
        return;
      }

      await upsertLocalIndexTransaction(spaceId, previous);
      await applySummaryDelta({
        spaceId,
        previous: localTransaction,
        next: previous,
        amountCurrency,
        queryClient,
      });
      if (queryClient) {
        upsertIndexTransactionsIntoQueryCaches(queryClient, {
          spaceId,
          transactions: [previous],
        });
        invalidateLocalInsightsQueries(queryClient);
      }
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateTransactionLocalFirstResult = {
    data: { id: previous.id },
    pendingSync: true,
    localTransaction,
    previousTransaction: previous,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
