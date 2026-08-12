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
  IndexTransaction,
  TransferUpdateTransactionType,
  UpdateTransactionType,
} from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { loadLocalIndexTransactionById } from "./local-cache";
import { fetchTransactionById } from "./queries";
import { resolveEditAttachmentFile } from "@/services/attachments/resolve";

const transactionDetailKey = (
  spaceId: string,
  transactionId: string,
): string => `transactionDetail:${spaceId}:${transactionId}`;

export const cacheTransactionDetail = async (
  spaceId: string,
  transactionId: string,
  payload: unknown,
): Promise<void> => {
  if (!spaceId || !transactionId) {
    return;
  }

  try {
    await putLocalResponseSnapshot(
      transactionDetailKey(spaceId, transactionId),
      payload,
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
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount) || 0,
    amountCurrency: row.amountCurrency,
    categoryName: row.categoryName ?? "",
    categoryId: categoryIds?.categoryId,
    subcategoryId: categoryIds?.subcategoryId,
    subcategoryName: row.subcategoryName ?? null,
    accountName,
    transactionType: isIncome ? "income" : "expense",
    type: row.type,
    scheduleType: row.inSeries
      ? ScheduleTypeEnum.REPEAT
      : ScheduleTypeEnum.ONE_TIME,
    repeatInterval: "",
    installmentPeriod: 0,
    file: null,
    entityName: row.entityName ?? "",
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
    return {
      ...base,
      fromAccountName: row.fromAccountName ?? "",
      toAccountName: row.toAccountName ?? "",
      transactionCost: 0,
    };
  }

  return base;
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

  return mapIndexTransactionToEditDataSync(row, categoryIds);
};

const normalizeDetailPayload = (
  payload: unknown,
): UpdateTransactionType | TransferUpdateTransactionType | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return payload as UpdateTransactionType | TransferUpdateTransactionType;
};

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

const listRowHasCrossCurrencyBooked = (listRow: IndexTransaction): boolean => {
  const bookedCurrency = listRow.bookedAmountCurrency?.trim().toUpperCase();
  const amountCurrency = listRow.amountCurrency?.trim().toUpperCase();
  return Boolean(
    listRow.bookedAmount != null
    && bookedCurrency
    && amountCurrency
    && bookedCurrency !== amountCurrency,
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
  const listAmount = toAmountNumber(listRow.amount);
  const next: UpdateTransactionType | TransferUpdateTransactionType = {
    ...detail,
    amount: listAmount,
    description: listRow.description ?? detail.description,
    date: listRow.date || detail.date,
    categoryName: listRow.categoryName || detail.categoryName,
    amountCurrency: listRow.amountCurrency ?? detail.amountCurrency,
  };

  if (listRow.tags?.length) {
    next.tags = listRow.tags;
    next.tagIds = listRow.tagIds ?? listRow.tags.map((tag) => tag.id);
  } else if (listRow.tagIds?.length) {
    next.tagIds = listRow.tagIds;
  }

  if (listRowHasCrossCurrencyBooked(listRow)) {
    const bookedAmount = toAmountNumber(listRow.bookedAmount);
    const bookedCurrency = listRow.bookedAmountCurrency!;
    next.amount = bookedAmount;
    (next as { original_display_amount?: number }).original_display_amount =
      bookedAmount;
    (next as { original_display_currency?: string }).original_display_currency =
      bookedCurrency;
    next.hasCurrencyConversion = true;
    next.currencyConversion = {
      originalAmount: bookedAmount,
      originalCurrency: bookedCurrency,
      convertedAmount: listAmount,
      convertedCurrency: listRow.amountCurrency ?? detail.amountCurrency ?? "PHP",
      exchangeRate: listAmount !== 0 ? listAmount / bookedAmount : 1,
      source: "manual",
    };
    return next;
  }

  // Same-currency (or no booked leg): drop stale conversion so Income/Expense
  // forms do not prefer an outdated original_display_amount over list amount.
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

/**
 * Background enrichment for the edit dialog after the seed is shown.
 */
export const enrichTransactionEditDetail = async (params: {
  api: AxiosInstance | null | undefined;
  spaceId: string;
  transaction: IndexTransaction;
  preferLocal: boolean;
}): Promise<TransactionEditSeed> => {
  const data = await resolveTransactionDetail({
    api: params.api,
    spaceId: params.spaceId,
    transactionId: params.transaction.id,
    type: params.transaction.type,
    listRow: params.transaction,
    preferLocal: params.preferLocal,
  });

  let nextData = data;

  if (params.preferLocal && params.transaction.hasImage && !nextData.file) {
    const localFile = await resolveEditAttachmentFile({
      spaceId: params.spaceId,
      transactionId: params.transaction.id,
      type: params.transaction.type,
    });

    if (localFile) {
      nextData = {
        ...nextData,
        file: localFile,
      };
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
        return listRow
          ? applyListRowMoneyToDetail(normalized, listRow)
          : normalized;
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
  void cacheTransactionDetail(spaceId, transactionId, data);
  return data;
};
