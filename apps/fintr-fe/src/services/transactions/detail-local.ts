import type { AxiosInstance } from "axios";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { loadCachedTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
  deleteLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import {
  loadCachedTransferDetail,
  cacheTransferDetail,
} from "@/services/transactions/transfers/local-cache";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import type {
  CurrencyConversionType,
  IndexTransaction,
  TransferUpdateTransactionType,
  UpdateTransactionType,
} from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { positiveTransactionFormAmount } from "@/utils/transactionFormAmount";
import {
  conversionHasFx,
  moneyFieldsFromDetailPayload,
  reconcileFxConversion,
} from "@/utils/transactionViewMoney";

import { loadLocalIndexTransactionById } from "./local-cache";
import { fetchTransactionById } from "./queries";
import { attachmentOwnerTypeForTransaction } from "@/services/attachments/create-outbox";
import { cacheRemoteFilesForOwners } from "@/services/attachments/download-remote";
import { extractRemoteFiles } from "@/services/attachments/remote-files";
import { resolveEditAttachmentFile } from "@/services/attachments/resolve";
import {
  backfillIndexRowForOffline,
  indexRowHasStoredFx,
  listRowHasCrossCurrencyBooked,
} from "@/services/transactions/offline-fx-backfill";

const transactionDetailKey = (
  spaceId: string,
  transactionId: string,
): string => `transactionDetail:${spaceId}:${transactionId}`;

const positiveInstallmentPlanTotal = (
  value: number | null | undefined,
): number | null =>
  value != null && Number.isFinite(value) && value > 0 ? value : null;

/**
 * IndexedDB index rows are patched immediately on local-first edits; cached
 * detail snapshots (child or root) often still carry the pre-edit plan total.
 */
export const resolveInstallmentPlanTotal = ({
  listRowTotal,
  parentRowTotal,
  detailTotal,
  parentCachedTotal,
}: {
  listRowTotal?: number | null;
  parentRowTotal?: number | null;
  detailTotal?: number | null;
  parentCachedTotal?: number | null;
}): number | null => {
  const indexTotals = [
    positiveInstallmentPlanTotal(parentRowTotal),
    positiveInstallmentPlanTotal(listRowTotal),
  ].filter((value): value is number => value != null);

  if (indexTotals.length > 0) {
    return Math.max(...indexTotals);
  }

  return (
    positiveInstallmentPlanTotal(detailTotal)
    ?? positiveInstallmentPlanTotal(parentCachedTotal)
  );
};

export const cacheTransactionDetail = async (
  spaceId: string,
  transactionId: string,
  payload: unknown,
): Promise<void> => {
  if (!spaceId || !transactionId) {
    return;
  }

  try {
    const normalized = normalizeTransactionEditDetail(payload) ?? payload;
    await putLocalResponseSnapshot(
      transactionDetailKey(spaceId, transactionId),
      normalized,
    );
  } catch (error) {
    console.warn("[local-db] Failed to cache transaction detail", error);
  }
};

export const loadCachedTransactionDetail = async (
  spaceId: string,
  transactionId: string,
): Promise<unknown | undefined> => {
  if (!spaceId || !transactionId) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot(
      transactionDetailKey(spaceId, transactionId),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached transaction detail", error);
    return undefined;
  }
};

type CategoryNode = {
  id?: string;
  name?: string;
  children?: CategoryNode[];
  subcategories?: CategoryNode[];
};

const flattenCategoryNodes = (nodes: unknown): CategoryNode[] => {
  if (!Array.isArray(nodes)) {
    return [];
  }

  const out: CategoryNode[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      continue;
    }
    const record = node as CategoryNode;
    out.push(record);
    const nested = record.children ?? record.subcategories;
    if (nested?.length) {
      out.push(...flattenCategoryNodes(nested));
    }
  }
  return out;
};

const resolveCategoryIds = async (params: {
  spaceId: string;
  categoryName?: string | null;
  subcategoryName?: string | null;
  type: CombinedTransactionTypeEnum;
}): Promise<{ categoryId?: string; subcategoryId?: string | null }> => {
  const { spaceId, categoryName, subcategoryName, type } = params;
  if (!categoryName) {
    return {};
  }

  const cached = await loadCachedTransactionCategoriesResponse(spaceId);
  if (!cached || typeof cached !== "object") {
    return {};
  }

  const root = cached as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const expense =
    data.expenseCategories ?? data.expense_categories ?? data.expense;
  const income =
    data.incomeCategories ?? data.income_categories ?? data.income;
  const pool =
    type === CombinedTransactionTypeEnum.INCOME
      ? flattenCategoryNodes(income)
      : flattenCategoryNodes(expense);

  const category = pool.find(
    (node) =>
      node.name?.toLowerCase() === categoryName.toLowerCase() &&
      node.id,
  );
  if (!category?.id) {
    return {};
  }

  if (!subcategoryName) {
    return { categoryId: category.id, subcategoryId: null };
  }

  const children = flattenCategoryNodes(
    category.children ?? category.subcategories ?? [],
  );
  const subcategory = children.find(
    (node) =>
      node.name?.toLowerCase() === subcategoryName.toLowerCase() &&
      node.id,
  );

  return {
    categoryId: category.id,
    subcategoryId: subcategory?.id ?? null,
  };
};

/** Sync seed for opening the edit modal immediately from a list row. */
export const mapIndexTransactionToEditDataSync = (
  row: IndexTransaction,
  categoryIds?: { categoryId?: string; subcategoryId?: string | null },
): UpdateTransactionType | TransferUpdateTransactionType => {
  const isIncome = row.type === CombinedTransactionTypeEnum.INCOME;
  const isTransfer = row.type === CombinedTransactionTypeEnum.TRANSFER;
  const accountName = isIncome
    ? row.toAccountName || row.fromAccountName || ""
    : row.fromAccountName || row.toAccountName || "";

  const base: UpdateTransactionType = {
    id: row.id,
    date: row.date,
    description: row.description ?? "",
    amount: positiveTransactionFormAmount(row.amount),
    amountCurrency: row.amountCurrency,
    categoryName: row.categoryName ?? "",
    categoryId: categoryIds?.categoryId,
    subcategoryId: categoryIds?.subcategoryId,
    subcategoryName: row.subcategoryName ?? null,
    accountName,
    accountId:
      row.accountId
      ?? (isIncome ? row.toAccountId : row.fromAccountId)
      ?? undefined,
    transactionType: isIncome ? "income" : "expense",
    type: row.type,
    scheduleType: resolveScheduleTypeFromRow(row),
    repeatInterval: row.repeatInterval ?? "",
    installmentPeriod: row.installmentPeriod ?? 0,
    installmentTotal:
      row.installmentTotal != null && row.installmentTotal > 0
        ? row.installmentTotal
        : null,
    file: null,
    entityName: row.entityName ?? "",
    entityId: row.entityId ?? undefined,
    hasCurrencyConversion: Boolean(
      row.bookedAmountCurrency &&
        row.amountCurrency &&
        row.bookedAmountCurrency !== row.amountCurrency,
    ),
    ...(row.tags?.length
      ? {
          tags: row.tags,
          tagIds: row.tagIds ?? row.tags.map((tag) => tag.id),
        }
      : row.tagIds?.length
        ? { tagIds: row.tagIds }
        : {}),
  };

  if (isTransfer) {
    return applyListRowFxToEditDetail(
      {
        ...base,
        fromAccountName: row.fromAccountName ?? "",
        toAccountName: row.toAccountName ?? "",
        fromAccountId: row.fromAccountId ?? undefined,
        toAccountId: row.toAccountId ?? undefined,
        transactionCost: 0,
      },
      row,
    );
  }

  return applyListRowFxToEditDetail(base, row);
};

export const mapIndexTransactionToEditData = async (
  spaceId: string,
  row: IndexTransaction,
): Promise<UpdateTransactionType | TransferUpdateTransactionType> => {
  const categoryIds = await resolveCategoryIds({
    spaceId,
    categoryName: row.categoryName,
    subcategoryName: row.subcategoryName,
    type: row.type,
  });

  const sync = mapIndexTransactionToEditDataSync(row, categoryIds);
  return resolveSeriesScheduleFields(spaceId, row, sync);
};

const pickDetailField = (
  record: Record<string, unknown>,
  camel: string,
  snake: string,
): unknown => {
  if (record[camel] !== undefined && record[camel] !== null) {
    return record[camel];
  }
  if (record[snake] !== undefined && record[snake] !== null) {
    return record[snake];
  }
  return undefined;
};

const isRecurringScheduleType = (
  scheduleType?: ScheduleTypeEnum | string | null,
): boolean =>
  scheduleType === ScheduleTypeEnum.REPEAT
  || scheduleType === ScheduleTypeEnum.INSTALLMENT;

const resolveScheduleTypeFromRow = (row: IndexTransaction): ScheduleTypeEnum => {
  if (
    row.scheduleType === ScheduleTypeEnum.INSTALLMENT
    || row.scheduleType === "installment"
    || (row.installmentPeriod ?? 0) > 0
  ) {
    return ScheduleTypeEnum.INSTALLMENT;
  }

  if (row.scheduleType && row.scheduleType !== ScheduleTypeEnum.ONE_TIME) {
    return row.scheduleType as ScheduleTypeEnum;
  }

  if (row.parentId || row.inSeries) {
    return ScheduleTypeEnum.REPEAT;
  }

  return ScheduleTypeEnum.ONE_TIME;
};

const resolveSeriesRootId = (
  listRow?: IndexTransaction | null,
): string | null =>
  listRow?.rootParentId?.trim()
  ?? listRow?.parentId?.trim()
  ?? null;

export const normalizeTransactionEditDetail = (
  payload: unknown,
): UpdateTransactionType | TransferUpdateTransactionType | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const existing = payload as UpdateTransactionType | TransferUpdateTransactionType;
  const money = moneyFieldsFromDetailPayload(record);

  const scheduleTypeRaw = pickDetailField(record, "scheduleType", "schedule_type");
  const repeatIntervalRaw = pickDetailField(
    record,
    "repeatInterval",
    "repeat_interval",
  );
  const installmentPeriodRaw = pickDetailField(
    record,
    "installmentPeriod",
    "installment_period",
  );
  const installmentTotalRaw = pickDetailField(
    record,
    "installmentTotal",
    "installment_total",
  );

  const scheduleType = scheduleTypeRaw != null
    ? String(scheduleTypeRaw) as ScheduleTypeEnum
    : existing.scheduleType;

  const repeatInterval = repeatIntervalRaw != null
    ? String(repeatIntervalRaw)
    : existing.repeatInterval ?? "";

  const installmentPeriod = installmentPeriodRaw != null
    ? Number(installmentPeriodRaw)
    : existing.installmentPeriod ?? 0;

  const installmentTotal = installmentTotalRaw != null
    ? Number(installmentTotalRaw)
    : existing.installmentTotal ?? null;

  const conversion = money.currencyConversion;
  const hasFx = conversionHasFx(conversion);

  let next: UpdateTransactionType | TransferUpdateTransactionType = {
    ...existing,
    scheduleType,
    repeatInterval,
    installmentPeriod,
    installmentTotal,
    hasCurrencyConversion: hasFx,
    ...(hasFx && conversion
      ? {
          currencyConversion: conversion,
          originalDisplayAmount: conversion.originalAmount,
          originalDisplayCurrency: conversion.originalCurrency,
          original_display_amount: conversion.originalAmount,
          original_display_currency: conversion.originalCurrency,
        }
      : {}),
  };

  if (hasFx && conversion) {
    next = applyListRowFxToEditDetail(next, {
      id: String(record.id ?? existing.id ?? ""),
      date: String(record.date ?? existing.date ?? ""),
      description: String(record.description ?? existing.description ?? ""),
      amount: money.amount,
      amountCurrency: money.amountCurrency,
      bookedAmount: money.bookedAmount,
      bookedAmountCurrency: money.bookedAmountCurrency,
      currencyConversion: conversion,
      categoryName: String(record.categoryName ?? record.category_name ?? ""),
      fromAccountName: String(
        record.fromAccountName
        ?? record.from_account_name
        ?? record.accountName
        ?? record.account_name
        ?? "",
      ),
      toAccountName: String(record.toAccountName ?? record.to_account_name ?? ""),
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
  }

  return next;
};

const resolveSeriesScheduleFields = async (
  spaceId: string,
  listRow: IndexTransaction | null | undefined,
  detail: UpdateTransactionType | TransferUpdateTransactionType,
): Promise<UpdateTransactionType | TransferUpdateTransactionType> => {
  const inSeries =
    Boolean(listRow?.parentId)
    || Boolean(listRow?.inSeries)
    || isRecurringScheduleType(listRow?.scheduleType)
    || isRecurringScheduleType(detail.scheduleType);

  if (!inSeries) {
    return detail;
  }

  let repeatInterval = detail.repeatInterval?.trim() ?? "";
  let scheduleType = detail.scheduleType;
  let seriesParentDate = detail.seriesParentDate ?? detail.date;
  let installmentPeriod =
    detail.installmentPeriod && detail.installmentPeriod > 0
      ? detail.installmentPeriod
      : listRow?.installmentPeriod && listRow.installmentPeriod > 0
        ? listRow.installmentPeriod
        : 0;
  let installmentTotal = resolveInstallmentPlanTotal({
    listRowTotal: listRow?.installmentTotal,
    detailTotal: detail.installmentTotal,
  });

  const rootId = resolveSeriesRootId(listRow);
  const parentId = rootId;

  const needsSeriesScheduleLookup =
    !repeatInterval
    || scheduleType === ScheduleTypeEnum.ONE_TIME
    || installmentPeriod <= 0
    || installmentTotal == null
    || installmentTotal <= 0;

  if (needsSeriesScheduleLookup || parentId) {
    if (parentId) {
      const parentCached = await loadCachedTransactionDetail(spaceId, parentId);
      const parentNorm = normalizeTransactionEditDetail(parentCached);
      if (!repeatInterval && parentNorm?.repeatInterval?.trim()) {
        repeatInterval = parentNorm.repeatInterval.trim();
      }
      if (
        parentNorm?.scheduleType
        && parentNorm.scheduleType !== ScheduleTypeEnum.ONE_TIME
      ) {
        scheduleType = parentNorm.scheduleType;
      }
      if (installmentPeriod <= 0 && (parentNorm?.installmentPeriod ?? 0) > 0) {
        installmentPeriod = parentNorm.installmentPeriod;
      }

      const parentRow = await loadLocalIndexTransactionById(spaceId, parentId);
      if (!repeatInterval && parentRow?.repeatInterval?.trim()) {
        repeatInterval = parentRow.repeatInterval.trim();
      }
      if (
        parentRow?.scheduleType
        && parentRow.scheduleType !== ScheduleTypeEnum.ONE_TIME
      ) {
        scheduleType = parentRow.scheduleType as ScheduleTypeEnum;
      }
      if (installmentPeriod <= 0 && (parentRow?.installmentPeriod ?? 0) > 0) {
        installmentPeriod = parentRow.installmentPeriod ?? 0;
      }
      // Root plan total is source of truth — prefer live index rows over cached detail.
      installmentTotal = resolveInstallmentPlanTotal({
        listRowTotal: listRow?.installmentTotal,
        parentRowTotal: parentRow?.installmentTotal,
        detailTotal: installmentTotal,
        parentCachedTotal: parentNorm?.installmentTotal,
      });
      if (parentRow?.date) {
        seriesParentDate = parentRow.date;
      }
    } else if (listRow?.date) {
      seriesParentDate = listRow.date;
    }
  }

  if (!scheduleType || scheduleType === ScheduleTypeEnum.ONE_TIME) {
    scheduleType =
      installmentPeriod > 0
        ? ScheduleTypeEnum.INSTALLMENT
        : ScheduleTypeEnum.REPEAT;
  }

  return {
    ...detail,
    scheduleType,
    repeatInterval,
    installmentPeriod,
    installmentTotal,
    seriesParentDate,
  };
};

const normalizeDetailPayload = (
  payload: unknown,
): UpdateTransactionType | TransferUpdateTransactionType | null =>
  normalizeTransactionEditDetail(payload);

const toAmountNumber = (amount: unknown): number => {
  if (typeof amount === "number") {
    return Number.isFinite(amount) ? amount : 0;
  }
  if (typeof amount === "string" && amount.trim() !== "") {
    const parsed = Number.parseFloat(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export {
  indexRowHasStoredFx,
  listRowHasCrossCurrencyBooked,
} from "@/services/transactions/offline-fx-backfill";

const buildListRowFxConversion = (
  listRow: IndexTransaction,
  existing?: CurrencyConversionType | null,
): CurrencyConversionType => {
  const bookedAmount = positiveTransactionFormAmount(listRow.bookedAmount);
  const bookedCurrency = listRow.bookedAmountCurrency!;
  const listAmount = positiveTransactionFormAmount(listRow.amount);
  const convertedCurrency = listRow.amountCurrency ?? "PHP";
  const inferredRate =
    bookedAmount !== 0
    && !nearlyEqualMoney(listAmount, bookedAmount)
      ? listAmount / bookedAmount
      : null;

  return {
    originalAmount: bookedAmount,
    originalCurrency: bookedCurrency,
    convertedAmount: listAmount,
    convertedCurrency,
    exchangeRate:
      existing?.exchangeRate
      ?? inferredRate
      ?? 1,
    source: existing?.source ?? "manual",
    rateTimestamp: existing?.rateTimestamp,
    note: existing?.note ?? null,
  };
};

/** Persist `currency_conversion` on index rows that only carry booked/original legs. */
export const ensureIndexRowCurrencyConversion = (
  row: IndexTransaction,
): IndexTransaction => backfillIndexRowForOffline(row);

/** Write edit-ready detail (with FX metadata) into IndexedDB from an index row. */
export const cacheEditDetailFromIndexRow = async (
  spaceId: string,
  row: IndexTransaction,
): Promise<void> => {
  if (!spaceId || !row.id) {
    return;
  }

  const editData = mapIndexTransactionToEditDataSync(
    ensureIndexRowCurrencyConversion(row),
  );
  await cacheTransactionDetail(spaceId, row.id, editData);
};

const cachedDetailHasStoredFx = (
  detail: UpdateTransactionType | TransferUpdateTransactionType | null | undefined,
): boolean => conversionHasFx(conversionFromEditDetail(detail ?? ({} as UpdateTransactionType)));

const fxConversionForListRow = (
  listRow: IndexTransaction,
  existing?: CurrencyConversionType | null,
): CurrencyConversionType | null => {
  const storedConversion = listRow.currencyConversion ?? existing;

  if (listRowHasCrossCurrencyBooked(listRow)) {
    return reconcileFxConversion(
      buildListRowFxConversion(listRow, storedConversion),
      {
        amount: listRow.bookedAmount,
        currency: listRow.bookedAmountCurrency,
      },
    );
  }

  const raw = storedConversion;
  if (!conversionHasFx(raw)) {
    return null;
  }

  return reconcileFxConversion(raw, {
    amount: listRow.bookedAmount,
    currency: listRow.bookedAmountCurrency,
  });
};

/** Applies list-row booked/original FX legs onto edit-form detail payloads. */
export const applyListRowFxToEditDetail = <
  T extends UpdateTransactionType | TransferUpdateTransactionType,
>(
  detail: T,
  listRow: IndexTransaction,
): T => {
  const conversion = fxConversionForListRow(
    listRow,
    detail.currencyConversion,
  );
  if (!conversion) {
    return detail;
  }

  return {
    ...detail,
    amount: conversion.originalAmount,
    amountCurrency: conversion.originalCurrency,
    hasCurrencyConversion: true,
    original_display_amount: conversion.originalAmount,
    original_display_currency: conversion.originalCurrency,
    originalDisplayAmount: conversion.originalAmount,
    originalDisplayCurrency: conversion.originalCurrency,
    currencyConversion: conversion,
  };
};

const nearlyEqualMoney = (left: number, right: number): boolean => {
  if (left === right) {
    return true;
  }

  const scale = Math.max(Math.abs(left), Math.abs(right), 1);
  return Math.abs(left - right) < 0.05 || Math.abs(left - right) / scale < 0.002;
};

const isoCurrency = (value: unknown): string =>
  String(value ?? "").trim().toUpperCase();

const conversionFromEditDetail = (
  detail: UpdateTransactionType | TransferUpdateTransactionType,
): CurrencyConversionType | null => {
  const record = detail as Record<string, unknown>;
  const raw = (
    record.currencyConversion
    ?? record.currency_conversion
  ) as Record<string, unknown> | undefined;

  const originalAmount = Number(
    record.originalDisplayAmount
    ?? record.original_display_amount
    ?? raw?.originalAmount
    ?? raw?.original_amount,
  );
  const originalCurrency = isoCurrency(
    record.originalDisplayCurrency
    ?? record.original_display_currency
    ?? raw?.originalCurrency
    ?? raw?.original_currency,
  );
  const convertedAmount = Number(
    raw?.convertedAmount ?? raw?.converted_amount,
  );
  const convertedCurrency = isoCurrency(
    raw?.convertedCurrency ?? raw?.converted_currency,
  );

  if (!originalCurrency || !Number.isFinite(originalAmount)) {
    return null;
  }

  return {
    originalAmount,
    originalCurrency,
    convertedAmount: Number.isFinite(convertedAmount)
      ? convertedAmount
      : originalAmount,
    // Prefer a real ledger currency; never collapse to originalCurrency or FX
    // target matching treats GBP→GBP as "no conversion" and clears the snapshot.
    convertedCurrency:
      convertedCurrency
      || isoCurrency(
        (detail as { amountCurrency?: string }).amountCurrency,
      )
      || originalCurrency,
    exchangeRate: Number(raw?.exchangeRate ?? raw?.exchange_rate ?? 1),
    source: String(raw?.source ?? "manual"),
    rateTimestamp: (() => {
      const timestamp = raw?.rateTimestamp ?? raw?.rate_timestamp;
      return timestamp == null ? undefined : String(timestamp);
    })(),
    note: (raw?.note as string | null | undefined) ?? null,
  };
};

export const storedFxFingerprint = (
  detail: UpdateTransactionType | TransferUpdateTransactionType | null | undefined,
): string | null => {
  const conversion = detail ? conversionFromEditDetail(detail) : null;
  if (!conversionHasFx(conversion)) {
    return null;
  }

  return [
    conversion!.originalCurrency,
    conversion!.exchangeRate,
    conversion!.source ?? "",
  ].join(":");
};

const shouldPreserveDetailFx = (
  detail: UpdateTransactionType | TransferUpdateTransactionType,
  listRow: IndexTransaction,
): boolean => {
  const conversion = conversionFromEditDetail(detail);
  if (!conversion) {
    return false;
  }

  const originalCurrency = conversion.originalCurrency;
  const convertedCurrency = conversion.convertedCurrency;
  if (originalCurrency === convertedCurrency) {
    return false;
  }

  const listAmount = Math.abs(toAmountNumber(listRow.amount));
  const originalAmount = Math.abs(conversion.originalAmount);
  const convertedAmount = Math.abs(conversion.convertedAmount);
  const listCurrency = isoCurrency(listRow.amountCurrency);

  if (
    convertedAmount > 0
    && nearlyEqualMoney(listAmount, convertedAmount)
  ) {
    return true;
  }

  return (
    originalAmount > 0
    && nearlyEqualMoney(listAmount, originalAmount)
    && (!listCurrency || listCurrency === originalCurrency)
  );
};

/**
 * List / IndexedDB index rows are patched immediately on local-first edits.
 * Cached full detail payloads often still carry pre-edit amounts and FX
 * `original_display_*` fields — prefer the list money so reopen matches the list.
 */
export const applyListRowMoneyToDetail = (
  detail: UpdateTransactionType | TransferUpdateTransactionType,
  listRow: IndexTransaction,
): UpdateTransactionType | TransferUpdateTransactionType => {
  const next: UpdateTransactionType | TransferUpdateTransactionType = {
    ...detail,
    description: listRow.description ?? detail.description,
    date: listRow.date || detail.date,
    categoryName: listRow.categoryName || detail.categoryName,
    installmentPeriod:
      listRow.installmentPeriod && listRow.installmentPeriod > 0
        ? listRow.installmentPeriod
        : detail.installmentPeriod,
    // resolveSeriesScheduleFields already merged root/index totals — do not
    // downgrade to a stale child copy from the list row.
    installmentTotal:
      detail.installmentTotal != null && detail.installmentTotal > 0
        ? detail.installmentTotal
        : resolveInstallmentPlanTotal({
            listRowTotal: listRow.installmentTotal,
          }) ?? detail.installmentTotal,
  };

  if (listRow.tags?.length) {
    next.tags = listRow.tags;
    next.tagIds = listRow.tagIds ?? listRow.tags.map((tag) => tag.id);
  } else if (listRow.tagIds?.length) {
    next.tagIds = listRow.tagIds;
  }

  if (listRowHasCrossCurrencyBooked(listRow)) {
    return applyListRowFxToEditDetail(
      {
        ...next,
        amount: toAmountNumber(listRow.amount),
        amountCurrency: listRow.amountCurrency ?? detail.amountCurrency,
      },
      listRow,
    );
  }

  if (conversionHasFx(listRow.currencyConversion)) {
    return applyListRowFxToEditDetail(next, listRow);
  }

  if (shouldPreserveDetailFx(detail, listRow)) {
    const conversion = conversionFromEditDetail(detail)!;
    return {
      ...next,
      amount: conversion.originalAmount,
      amountCurrency: conversion.originalCurrency,
      hasCurrencyConversion: true,
      original_display_amount: conversion.originalAmount,
      original_display_currency: conversion.originalCurrency,
      originalDisplayAmount: conversion.originalAmount,
      originalDisplayCurrency: conversion.originalCurrency,
      currencyConversion: conversion,
    };
  }

  const detailConversion = conversionFromEditDetail(detail);
  if (conversionHasFx(detailConversion)) {
    return applyListRowFxToEditDetail(next, {
      ...listRow,
      bookedAmount:
        listRow.bookedAmount
        ?? detailConversion!.originalAmount,
      bookedAmountCurrency:
        listRow.bookedAmountCurrency
        ?? detailConversion!.originalCurrency,
      amount:
        listRow.amount != null
          ? listRow.amount
          : detailConversion!.convertedAmount,
      amountCurrency:
        listRow.amountCurrency
        ?? detailConversion!.convertedCurrency,
      currencyConversion: detailConversion!,
    });
  }

  const detailRecord = detail as Record<string, unknown>;
  const originalDisplayCurrency = isoCurrency(
    detailRecord.originalDisplayCurrency
    ?? detailRecord.original_display_currency,
  );
  const listAmountCurrency = isoCurrency(listRow.amountCurrency);
  const hasCrossCurrencyOriginalDisplay =
    originalDisplayCurrency !== ""
    && listAmountCurrency !== ""
    && originalDisplayCurrency !== listAmountCurrency;

  if (hasCrossCurrencyOriginalDisplay) {
    return next;
  }

  const listAmount = toAmountNumber(listRow.amount);
  next.amount = listAmount;
  next.amountCurrency = listRow.amountCurrency ?? detail.amountCurrency;

  // Same-currency rows with no persisted conversion: drop stale FX metadata.
  delete (next as { currencyConversion?: unknown }).currencyConversion;
  delete (next as { currency_conversion?: unknown }).currency_conversion;
  delete (next as { original_display_amount?: unknown }).original_display_amount;
  delete (next as { originalDisplayAmount?: unknown }).originalDisplayAmount;
  delete (next as { original_display_currency?: unknown }).original_display_currency;
  delete (next as { originalDisplayCurrency?: unknown }).originalDisplayCurrency;
  next.hasCurrencyConversion = false;
  (next as { has_currency_conversion?: boolean }).has_currency_conversion = false;

  return next;
};

export const clearCachedTransactionDetail = async (
  spaceId: string,
  transactionId: string,
): Promise<void> => {
  if (!spaceId || !transactionId) {
    return;
  }

  try {
    await deleteLocalResponseSnapshot(
      transactionDetailKey(spaceId, transactionId),
    );
  } catch (error) {
    console.warn("[local-db] Failed to clear transaction detail cache", error);
  }
};

export type TransactionEditSeed = {
  data: UpdateTransactionType | TransferUpdateTransactionType;
  date: Date | undefined;
};

const utcDateFromIso = (isoDate: string | undefined): Date | undefined => {
  if (!isoDate) {
    return undefined;
  }
  const dateObj = new Date(isoDate);
  return new Date(
    Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()),
  );
};

/**
 * Immediate edit-dialog seed from a list row (no I/O).
 * Keeps modal open orchestration out of the React component.
 */
export const seedTransactionEditFromListRow = (
  transaction: IndexTransaction,
): TransactionEditSeed => {
  const data = mapIndexTransactionToEditDataSync(transaction);
  return {
    data,
    date: utcDateFromIso(data.date),
  };
};

const canDownloadRemoteAttachments = (): boolean =>
  typeof navigator === "undefined" || navigator.onLine !== false;

const ownerIdsForTransaction = (transaction: IndexTransaction): string[] => {
  const ownerIds = [transaction.id];
  if (transaction.activitableId && !ownerIds.includes(transaction.activitableId)) {
    ownerIds.push(transaction.activitableId);
  }

  return ownerIds;
};

const attachLocalFileToDetail = async (params: {
  spaceId: string;
  transaction: IndexTransaction;
  data: UpdateTransactionType | TransferUpdateTransactionType;
}): Promise<UpdateTransactionType | TransferUpdateTransactionType> => {
  if (params.data.file) {
    return params.data;
  }

  const localFile = await resolveEditAttachmentFile({
    spaceId: params.spaceId,
    transactionId: params.transaction.id,
    type: params.transaction.type,
    listRow: params.transaction,
  });

  if (!localFile) {
    return params.data;
  }

  return {
    ...params.data,
    file: localFile,
  };
};

const cacheRemoteFilesIntoIndexedDb = async (params: {
  api: AxiosInstance | null | undefined;
  spaceId: string;
  transaction: IndexTransaction;
  detail: unknown;
}): Promise<void> => {
  const remoteFiles = extractRemoteFiles(params.detail);
  if (remoteFiles.length === 0 || !params.api || !canDownloadRemoteAttachments()) {
    return;
  }

  const ownerType = attachmentOwnerTypeForTransaction(params.transaction.type);
  await cacheRemoteFilesForOwners({
    spaceId: params.spaceId,
    ownerType,
    ownerIds: ownerIdsForTransaction(params.transaction),
    files: remoteFiles,
    api: params.api,
  });
};

/**
 * Background enrichment for the edit dialog after the seed is shown.
 */
export const enrichTransactionEditDetail = async (params: {
  api: AxiosInstance | null | undefined;
  spaceId: string;
  transaction: IndexTransaction;
  preferLocal: boolean;
}): Promise<TransactionEditSeed> => {
  const cached = await loadCachedTransactionDetail(
    params.spaceId,
    params.transaction.id,
  );
  const normalizedCached = normalizeDetailPayload(cached);
  const localHasFx =
    indexRowHasStoredFx(params.transaction)
    || cachedDetailHasStoredFx(normalizedCached ?? undefined);
  const needsNetworkFxBackfill =
    params.api != null
    && !localHasFx
    && (
      params.transaction.scheduleType === ScheduleTypeEnum.INSTALLMENT
      || Boolean(params.transaction.inSeries)
      || Boolean(params.transaction.parentId)
    );
  const usePreferLocal =
    params.preferLocal
    && !needsNetworkFxBackfill;

  const data = await resolveTransactionDetail({
    api: params.api,
    spaceId: params.spaceId,
    transactionId: params.transaction.id,
    type: params.transaction.type,
    listRow: params.transaction,
    preferLocal: usePreferLocal,
  });

  let nextData = await attachLocalFileToDetail({
    spaceId: params.spaceId,
    transaction: params.transaction,
    data,
  });

  if (!nextData.file) {
    await cacheRemoteFilesIntoIndexedDb({
      api: params.api,
      spaceId: params.spaceId,
      transaction: params.transaction,
      detail: nextData,
    });
    nextData = await attachLocalFileToDetail({
      spaceId: params.spaceId,
      transaction: params.transaction,
      data: nextData,
    });
  }

  const hasFiles = extractRemoteFiles(nextData).length > 0;
  if (
    !nextData.file
    && !hasFiles
    && params.transaction.hasImage
    && params.api
    && canDownloadRemoteAttachments()
    && !params.preferLocal
  ) {
    try {
      const fresh = await resolveTransactionDetail({
        api: params.api,
        spaceId: params.spaceId,
        transactionId: params.transaction.id,
        type: params.transaction.type,
        listRow: params.transaction,
        preferLocal: false,
      });
      nextData = {
        ...nextData,
        ...fresh,
        file: fresh.file ?? nextData.file,
      };
      await cacheRemoteFilesIntoIndexedDb({
        api: params.api,
        spaceId: params.spaceId,
        transaction: params.transaction,
        detail: nextData,
      });
      nextData = await attachLocalFileToDetail({
        spaceId: params.spaceId,
        transaction: params.transaction,
        data: nextData,
      });
    } catch {
      // Keep the cached seed when the file URL fetch fails.
    }
  }

  return {
    data: nextData,
    date: utcDateFromIso(nextData.date),
  };
};

/**
 * Resolve transaction/transfer detail for the edit dialog.
 * When preferLocal is true, never hits the network.
 */
export const resolveTransactionDetail = async (params: {
  api: AxiosInstance | null | undefined;
  spaceId: string;
  transactionId: string;
  type: CombinedTransactionTypeEnum;
  listRow?: IndexTransaction | null;
  preferLocal: boolean;
}): Promise<UpdateTransactionType | TransferUpdateTransactionType> => {
  const {
    api,
    spaceId,
    transactionId,
    type,
    listRow,
    preferLocal,
  } = params;

  const isTransfer = type === CombinedTransactionTypeEnum.TRANSFER;

  if (preferLocal) {
    if (isTransfer) {
      const transferId = listRow?.activitableId ?? transactionId;
      const cachedTransfer = await loadCachedTransferDetail(
        spaceId,
        transferId,
      );
      const normalized = normalizeDetailPayload(cachedTransfer);
      if (normalized) {
        return listRow
          ? applyListRowMoneyToDetail(normalized, listRow)
          : normalized;
      }
    } else {
      const cached = await loadCachedTransactionDetail(spaceId, transactionId);
      const normalized = normalizeDetailPayload(cached);
      if (normalized) {
        const withSchedule = await resolveSeriesScheduleFields(
          spaceId,
          listRow,
          normalized,
        );
        if (listRow) {
          if (
            indexRowHasStoredFx(listRow)
            && !cachedDetailHasStoredFx(withSchedule)
          ) {
            return applyListRowMoneyToDetail(
              applyListRowFxToEditDetail(withSchedule, listRow),
              listRow,
            );
          }

          return applyListRowMoneyToDetail(withSchedule, listRow);
        }

        return withSchedule;
      }
    }

    const row =
      listRow
      ?? (await loadLocalIndexTransactionById(spaceId, transactionId));
    if (!row) {
      throw new Error("Transaction not found in local DB");
    }
    return mapIndexTransactionToEditData(spaceId, row);
  }

  if (!api) {
    throw new Error("API client is required for online transaction detail");
  }

  if (isTransfer) {
    const transferId = listRow?.activitableId ?? transactionId;
    const data = await fetchTransferById(api, transferId);
    void cacheTransferDetail(spaceId, transferId, data);
    return data;
  }

  const data = await fetchTransactionById(api, transactionId);
  const normalized = normalizeTransactionEditDetail(data) ?? data;
  void cacheTransactionDetail(spaceId, transactionId, normalized);
  const withSchedule = await resolveSeriesScheduleFields(
    spaceId,
    listRow,
    normalized,
  );
  return listRow
    ? applyListRowMoneyToDetail(withSchedule, listRow)
    : withSchedule;
};
