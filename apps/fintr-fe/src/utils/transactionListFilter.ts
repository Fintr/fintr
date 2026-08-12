import {
  normalizeCategoryMatchKey,
  parseCategoryPickerValue,
  resolveTransactionCategoryAssignment,
  isCategoryPickerId,
  type CategoryTreeOption,
} from "@/types/categoryTreeTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import {
  transactionMatchesEntryTypeFilter,
  type TransactionEntryTypeFilter,
} from "@/utils/transactionEntryTypeFilter";
import { parseSerializedFilterValues } from "@/utils/transactionFilterValues";

export type IndexTransactionWithCategoryIds = IndexTransaction & {
  categoryId?: string | null;
  subcategoryId?: string | null;
  tagIds?: string[];
};

export type TransactionListFilter = {
  categories: string[];
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  searchQuery: string;
  accountNames: string[];
  tagIds: string[];
  entryType: TransactionEntryTypeFilter;
};

const parseEntryTypeFilter = (raw: unknown): TransactionEntryTypeFilter => {
  if (
    raw === "expense"
    || raw === "income"
    || raw === "transfers"
    || raw === "loans"
  ) {
    return raw;
  }

  return "all";
};

const transactionDateKey = (date: string): string => date.slice(0, 10);

const transactionInDateRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean => {
  if (!startDate && !endDate) {
    return true;
  }

  const key = transactionDateKey(date);
  if (startDate && key < startDate) {
    return false;
  }
  if (endDate && key > endDate) {
    return false;
  }

  return true;
};

const toAmountNumber = (amount: IndexTransaction["amount"]): number => {
  if (typeof amount === "number") {
    return amount;
  }

  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : 0;
};

const categoryMatchesFilter = (
  transaction: IndexTransactionWithCategoryIds,
  filterValue: string,
): boolean => {
  const assignment = parseCategoryPickerValue(filterValue);
  if (assignment) {
    if (!transaction.categoryId) {
      return false;
    }
    if (transaction.categoryId !== assignment.categoryId) {
      return false;
    }
    if (assignment.subcategoryId) {
      return transaction.subcategoryId === assignment.subcategoryId;
    }
    return true;
  }

  const key = normalizeCategoryMatchKey(filterValue);
  if (!key) {
    return false;
  }

  return (
    normalizeCategoryMatchKey(transaction.categoryName ?? "") === key
    || normalizeCategoryMatchKey(transaction.subcategoryName ?? "") === key
  );
};

export const transactionMatchesListFilter = (
  transaction: IndexTransactionWithCategoryIds,
  filter: TransactionListFilter,
): boolean => {
  if (!transactionInDateRange(transaction.date, filter.startDate, filter.endDate)) {
    return false;
  }

  const amount = Math.abs(toAmountNumber(transaction.amount));
  if (filter.minAmount !== "" && Number.isFinite(Number(filter.minAmount))) {
    if (amount < Number(filter.minAmount)) {
      return false;
    }
  }
  if (filter.maxAmount !== "" && Number.isFinite(Number(filter.maxAmount))) {
    if (amount > Number(filter.maxAmount)) {
      return false;
    }
  }

  const search = filter.searchQuery.trim().toLowerCase();
  if (search) {
    const haystack = `${transaction.description ?? ""}`.toLowerCase();
    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (filter.accountNames.length > 0) {
    const allowed = new Set(
      filter.accountNames.map((name) => name.trim().toLowerCase()).filter(Boolean),
    );
    const from = (transaction.fromAccountName ?? "").trim().toLowerCase();
    const to = (transaction.toAccountName ?? "").trim().toLowerCase();
    if (!allowed.has(from) && !allowed.has(to)) {
      return false;
    }
  }

  if (filter.categories.length > 0) {
    const matches = filter.categories.some((value) =>
      categoryMatchesFilter(transaction, value),
    );
    if (!matches) {
      return false;
    }
  }

  if (filter.tagIds.length > 0) {
    const transactionTagIds =
      transaction.tagIds ?? transaction.tags?.map((tag) => tag.id) ?? [];
    const allowed = new Set(filter.tagIds);
    const hasTag = transactionTagIds.some((tagId) => allowed.has(tagId));
    if (!hasTag) {
      return false;
    }
  }

  if (!transactionMatchesEntryTypeFilter(transaction.type, filter.entryType)) {
    return false;
  }

  return true;
};

export type InsightsCategoryFilter = {
  categoryName?: string;
  categoryId?: string;
  subcategoryId?: string;
  categoryOptions?: {
    expense: CategoryTreeOption[];
    income: CategoryTreeOption[];
  };
};

export const transactionMatchesInsightsCategoryFilter = (
  transaction: IndexTransactionWithCategoryIds,
  filter: InsightsCategoryFilter,
): boolean => {
  const hasIdFilter = Boolean(filter.categoryId);
  const hasNameFilter = Boolean(filter.categoryName?.trim());
  const { categoryOptions } = filter;

  if (!hasIdFilter && !hasNameFilter) {
    return true;
  }

  const filterNameKey =
    hasNameFilter && !isCategoryPickerId(filter.categoryName!)
      ? normalizeCategoryMatchKey(filter.categoryName!)
      : null;

  if (filterNameKey) {
    if (filter.subcategoryId) {
      if (normalizeCategoryMatchKey(transaction.subcategoryName ?? "") === filterNameKey) {
        return true;
      }
    } else if (
      normalizeCategoryMatchKey(transaction.categoryName ?? "") === filterNameKey
      || normalizeCategoryMatchKey(transaction.subcategoryName ?? "") === filterNameKey
    ) {
      return true;
    }
  }

  if (categoryOptions && filter.categoryId) {
    const assignment = resolveTransactionCategoryAssignment(
      transaction,
      categoryOptions.expense,
      categoryOptions.income,
    );

    if (assignment?.categoryId === filter.categoryId) {
      if (filter.subcategoryId) {
        return assignment.subcategoryId === filter.subcategoryId;
      }

      return true;
    }
  }

  if (hasIdFilter && filter.categoryId && transaction.categoryId === filter.categoryId) {
    if (filter.subcategoryId) {
      return transaction.subcategoryId === filter.subcategoryId;
    }

    return true;
  }

  if (hasNameFilter && filter.categoryName) {
    return categoryMatchesFilter(transaction, filter.categoryName);
  }

  if (hasIdFilter && filter.categoryId) {
    return categoryMatchesFilter(transaction, filter.categoryId);
  }

  return false;
};

export const filterTransactionsByInsightsCategory = (
  transactions: IndexTransactionWithCategoryIds[],
  filter: InsightsCategoryFilter,
): IndexTransactionWithCategoryIds[] =>
  transactions.filter((transaction) =>
    transactionMatchesInsightsCategoryFilter(transaction, filter),
  );

export const parseTransactionListFilterFromFilterKey = (
  filterKey: string,
): TransactionListFilter => {
  const parts = filterKey.split("|");

  return {
    categories: parseSerializedFilterValues(parts[0] ?? "[]"),
    startDate: parts[1] ?? "",
    endDate: parts[2] ?? "",
    minAmount: parts[3] ?? "",
    maxAmount: parts[4] ?? "",
    searchQuery: parts[5] ?? "",
    accountNames: parseSerializedFilterValues(parts[6] ?? "[]"),
    tagIds: parseSerializedFilterValues(parts[7] ?? "[]"),
    entryType: parseEntryTypeFilter(parts[8]),
  };
};

export const parseTransactionListFilterFromQueryKey = (
  queryKey: readonly unknown[],
): TransactionListFilter | null => {
  if (!Array.isArray(queryKey) || queryKey[0] !== "transactions") {
    return null;
  }

  if (queryKey[1] === "local" && typeof queryKey[3] === "string") {
    return parseTransactionListFilterFromFilterKey(queryKey[3]);
  }

  if (typeof queryKey[1] === "string" && queryKey[1] !== "local") {
    return {
      categories: parseSerializedFilterValues(queryKey[2]),
      startDate: typeof queryKey[3] === "string" ? queryKey[3] : "",
      endDate: typeof queryKey[4] === "string" ? queryKey[4] : "",
      minAmount: typeof queryKey[5] === "string" ? queryKey[5] : "",
      maxAmount: typeof queryKey[6] === "string" ? queryKey[6] : "",
      searchQuery: typeof queryKey[7] === "string" ? queryKey[7] : "",
      accountNames: parseSerializedFilterValues(queryKey[8]),
      tagIds: parseSerializedFilterValues(queryKey[9]),
      entryType: parseEntryTypeFilter(queryKey[10]),
    };
  }

  return null;
};
