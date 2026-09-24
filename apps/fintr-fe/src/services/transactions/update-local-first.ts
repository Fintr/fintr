import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  buildCreateOutboxPayload,
  attachmentOwnerTypeForTransaction,
} from "@/services/attachments/create-outbox";
import { purgeAttachmentsForOwner } from "@/services/attachments/local-store";
import {
  applyLocalTransactionToMonthlySummaries,
  setMonthlyFinancialSummariesQueryData,
} from "@/services/monthly-financial-summaries/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { ScheduleTypeEnum, UpdateScopeEnum } from "@/constants/transactionConstants";
import { applyInstallmentThisOnlyTotalDeltaCents } from "@fintr/domain";
import {
  indexRowLedgerAmountCents,
  resolvePlanTotalLedgerCents,
} from "@/utils/installmentRevisionLedger";
import { isTransactionCalculatedForDate } from "@/utils/transactionCalculated";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";
import { isUploadableFile } from "@/utils/formUtils";
import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TRANSACTION_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";

import {
  loadAllTransactionsFromLocalIndex,
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "./local-cache";
import {
  updateTransaction,
  type UpdateTransactionType as MutationUpdateType,
} from "./mutation";
import {
  optimisticIndexMoneyFromCreate,
} from "./create-local-first";
import {
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "./upsert-into-query-caches";
import { attachUpdateTransactionRelationIds } from "./relation-ids-local";
import { applyInstallmentPlanRevisionLocal } from "./apply-installment-revision-local";

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

const resolveSubmittedInstallmentPlanTotalInSpaceCurrency = ({
  installmentTotal,
  originalCurrency,
  exchangeRate,
  spaceCurrency,
}: {
  installmentTotal?: number | null;
  originalCurrency?: string | null;
  exchangeRate?: number | null;
  spaceCurrency?: string | null;
}): number | null => {
  const ledgerCents = resolvePlanTotalLedgerCents({
    planTotal: Number(installmentTotal),
    originalCurrency,
    exchangeRate,
    spaceCurrency,
  });

  if (ledgerCents <= 0) {
    return null;
  }

  return ledgerCents / 100;
};

export const buildUpdatedIndexTransaction = (params: {
  previous: IndexTransaction;
  data: UpdateTransactionType;
  amountCurrency?: string;
}): IndexTransactionWithCategoryIds => {
  const { previous, data, amountCurrency } = params;
  const transactionType = data.transactionType ?? toIncomeExpenseType(previous.type);
  const updateData = data as UpdateTransactionType & {
    original_currency?: string;
    exchange_rate?: number;
    exchange_rate_source?: "auto" | "manual" | "recent";
  };
  const entryCurrency =
    updateData.original_currency?.trim()
    || previous.currencyConversion?.originalCurrency
    || previous.bookedAmountCurrency
    || amountCurrency
    || previous.amountCurrency;
  const spaceCurrency =
    amountCurrency
    || previous.amountCurrency
    || previous.currencyConversion?.convertedCurrency
    || entryCurrency;
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
    entryCurrency,
    spaceCurrency,
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
    accountId:
      data.accountId
      ?? (transactionType === "income" ? previous.toAccountId : previous.fromAccountId)
      ?? previous.accountId
      ?? null,
    fromAccountId:
      transactionType === "expense"
        ? (data.accountId ?? previous.fromAccountId ?? previous.accountId ?? null)
        : previous.fromAccountId ?? null,
    toAccountId:
      transactionType === "income"
        ? (data.accountId ?? previous.toAccountId ?? previous.accountId ?? null)
        : previous.toAccountId ?? null,
    entityName: data.entityName ?? previous.entityName,
    entityId: data.entityId ?? previous.entityId ?? null,
    calculated: isTransactionCalculatedForDate(data.date || previous.date),
    hasImage: isUploadableFile(data.file)
      ? true
      : data.removeFile
        ? false
        : Boolean(previous.hasImage),
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

  const isThisOnlyInstallment =
    data.updateScope === UpdateScopeEnum.THIS_ONLY
    && (
      previous.scheduleType === ScheduleTypeEnum.INSTALLMENT
      || data.scheduleType === ScheduleTypeEnum.INSTALLMENT
    );

  if (isThisOnlyInstallment) {
    const submittedPlanTotal = resolveSubmittedInstallmentPlanTotalInSpaceCurrency({
      installmentTotal: data.installmentTotal,
      originalCurrency: updateData.original_currency,
      exchangeRate: updateData.exchange_rate,
      spaceCurrency: money.amountCurrency ?? spaceCurrency,
    });
    const previousPlanTotal = previous.installmentTotal;

    if (
      submittedPlanTotal != null
      && (
        previousPlanTotal == null
        || Math.abs(submittedPlanTotal - previousPlanTotal) > 0.005
      )
    ) {
      next.installmentTotal = submittedPlanTotal;
    } else {
      next.installmentTotal =
        applyInstallmentThisOnlyTotalDeltaCents({
          storedTotalCents:
            previous.installmentTotal != null
              ? Math.round(previous.installmentTotal * 100)
              : null,
          period:
            data.installmentPeriod
            ?? previous.installmentPeriod
            ?? 0,
          previousAmountCents: indexRowLedgerAmountCents(previous),
          nextAmountCents: Math.round(Math.abs(Number(money.amount) || 0) * 100),
        }) / 100;
    }
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
  const dataWithRelations = await attachUpdateTransactionRelationIds(
    spaceId,
    data,
    previous,
  );
  const allIndexRows = await loadAllTransactionsFromLocalIndex(spaceId);
  const seriesRootId =
    previous.rootParentId
    || previous.parentId
    || previous.id;
  const seriesIds = new Set<string>();
  allIndexRows.forEach((row) => {
    const rowRoot =
      row.rootParentId
      || row.parentId
      || row.id;
    if (rowRoot === seriesRootId || row.id === seriesRootId) {
      seriesIds.add(row.id);
    }
  });
  let addedChild = true;
  while (addedChild) {
    addedChild = false;
    allIndexRows.forEach((row) => {
      const parentId = row.parentId?.trim();
      if (
        !seriesIds.has(row.id)
        && parentId
        && seriesIds.has(parentId)
      ) {
        seriesIds.add(row.id);
        addedChild = true;
      }
    });
  }
  const seriesRows = allIndexRows.filter((row) => seriesIds.has(row.id));
  const revisionData = {
    ...dataWithRelations,
    updateScope: dataWithRelations.updateScope ?? UpdateScopeEnum.THIS_ONLY,
  };
  const localTransaction = buildUpdatedIndexTransaction({
    previous,
    data: revisionData,
    amountCurrency,
  });

  const isInstallmentPlanRevision =
    (
      revisionData.updateScope === UpdateScopeEnum.THIS_AND_FUTURE
      || revisionData.updateScope === UpdateScopeEnum.ALL_IN_SERIES
    )
    && (
      previous.scheduleType === ScheduleTypeEnum.INSTALLMENT
      || revisionData.scheduleType === ScheduleTypeEnum.INSTALLMENT
    )
    && revisionData.installmentTotal != null;

  if (!isInstallmentPlanRevision) {
    if (queryClient) {
      upsertIndexTransactionsIntoQueryCaches(queryClient, {
        spaceId,
        transactions: [localTransaction],
      });
    }

    await upsertLocalIndexTransaction(spaceId, localTransaction);
  }

  const seriesSnapshot = isInstallmentPlanRevision
    ? seriesRows.map((row) => ({ ...row }))
    : [];

  if (isInstallmentPlanRevision) {
    const revisedRows = await applyInstallmentPlanRevisionLocal({
      spaceId,
      target: previous,
      data: revisionData as MutationUpdateType & {
        original_currency?: string;
        exchange_rate?: number;
        exchange_rate_source?: "auto" | "manual" | "recent";
        installmentRevisionAnchor?: string;
      },
      spaceCurrency: amountCurrency ?? localTransaction.amountCurrency ?? "PHP",
      queryClient,
    });
    const anchorRow = revisedRows.find((row) => row.id === localTransaction.id);
    if (anchorRow) {
      Object.assign(localTransaction, anchorRow);
    }

    if (queryClient) {
      upsertIndexTransactionsIntoQueryCaches(queryClient, {
        spaceId,
        transactions: [localTransaction],
      });
    }

    await upsertLocalIndexTransaction(spaceId, localTransaction);
  }

  if (
    localTransaction.installmentTotal != null
    && revisionData.updateScope === UpdateScopeEnum.THIS_ONLY
    && (
      previous.scheduleType === ScheduleTypeEnum.INSTALLMENT
      || dataWithRelations.scheduleType === ScheduleTypeEnum.INSTALLMENT
    )
  ) {
    const seriesRootId =
      previous.rootParentId
      || previous.parentId
      || previous.id;
    const { loadAllTransactionsFromLocalIndex } = await import("./local-cache");
    const allRows = await loadAllTransactionsFromLocalIndex(spaceId);
    const seriesUpdates = allRows
      .filter((row) => {
        const rowRoot =
          row.rootParentId
          || row.parentId
          || row.id;
        return rowRoot === seriesRootId || row.id === seriesRootId;
      })
      .map((row) => ({
        ...row,
        installmentTotal: localTransaction.installmentTotal,
      }));

    for (const row of seriesUpdates) {
      await upsertLocalIndexTransaction(spaceId, row);
    }

    if (queryClient && seriesUpdates.length > 0) {
      upsertIndexTransactionsIntoQueryCaches(queryClient, {
        spaceId,
        transactions: seriesUpdates,
      });
    }
  }
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
    const { cacheEditDetailFromIndexRow } = await import("./detail-local");
    await cacheEditDetailFromIndexRow(spaceId, localTransaction);
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
    // Installment / recurring series detail reads IndexedDB via this key.
    // Without invalidation the page keeps stale totals and occurrence amounts.
    void queryClient.invalidateQueries({
      queryKey: ["recurringSeries", spaceId],
      exact: false,
      refetchType: "active",
    });
  }

  const clientMutationId = newClientMutationId();
  const ownerType = attachmentOwnerTypeForTransaction(localTransaction.type);

  if (data.removeFile) {
    await purgeAttachmentsForOwner({
      spaceId,
      ownerType,
      ownerId: previous.id,
    });
  }

  const payloadForOutbox = await buildCreateOutboxPayload({
    spaceId,
    ownerType,
    ownerId: previous.id,
    data: {
      ...data,
      updateScope: revisionData.updateScope,
    },
  });

  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_TRANSACTION_UPDATE,
    payload: {
      ...payloadForOutbox,
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
        updateScope: revisionData.updateScope,
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

      if (seriesSnapshot.length > 0) {
        for (const row of seriesSnapshot) {
          await upsertLocalIndexTransaction(spaceId, row);
        }
        if (queryClient) {
          upsertIndexTransactionsIntoQueryCaches(queryClient, {
            spaceId,
            transactions: seriesSnapshot,
          });
        }
      } else {
        await upsertLocalIndexTransaction(spaceId, previous);
        if (queryClient) {
          upsertIndexTransactionsIntoQueryCaches(queryClient, {
            spaceId,
            transactions: [previous],
          });
        }
      }
      await applySummaryDelta({
        spaceId,
        previous: localTransaction,
        next: previous,
        amountCurrency,
        queryClient,
      });
      if (queryClient) {
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
