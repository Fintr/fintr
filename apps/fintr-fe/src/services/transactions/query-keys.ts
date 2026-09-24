import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionEntryTypeFilter } from "@/utils/transactionEntryTypeFilter";
import { parseTransactionListFilterFromQueryKey } from "@/utils/transactionListFilter";

import { buildTransactionsFilterKey } from "./local-cache";

export type TransactionsInfiniteQueryMode = "local" | "network";

export const buildTransactionsInfiniteQueryKey = (params: {
  spaceCode: string;
  categoriesSerialized: string;
  startDate: string;
  endDate: string;
  minAmount?: string;
  maxAmount?: string;
  searchQuery?: string;
  accountNamesSerialized: string;
  tagIdsSerialized: string;
  entryType?: TransactionEntryTypeFilter;
  mode: TransactionsInfiniteQueryMode;
}) =>
  [
    "transactions",
    params.spaceCode,
    params.categoriesSerialized,
    params.startDate,
    params.endDate,
    params.minAmount ?? "",
    params.maxAmount ?? "",
    params.searchQuery ?? "",
    params.accountNamesSerialized,
    params.tagIdsSerialized,
    params.entryType ?? "all",
    params.mode,
  ] as const;

/** Rebuild the IndexedDB filter key from an infinite-query key (includes entry type). */
export const buildTransactionsFilterKeyFromInfiniteQueryKey = (
  queryKey: readonly unknown[],
): string | null => {
  const filter = parseTransactionListFilterFromQueryKey(queryKey);
  if (!filter) {
    return null;
  }

  return buildTransactionsFilterKey({
    categoriesSerialized: serializeFilterValues(filter.categories),
    startDate: filter.startDate,
    endDate: filter.endDate,
    minAmount: filter.minAmount,
    maxAmount: filter.maxAmount,
    searchQuery: filter.searchQuery,
    accountNamesSerialized: serializeFilterValues(filter.accountNames),
    tagIdsSerialized: serializeFilterValues(filter.tagIds),
    entryType: filter.entryType,
  });
};

export const resolveTransactionsFilterKeyForQuery = (
  queryKey: readonly unknown[],
  fallbackFilterKey: string,
): string =>
  buildTransactionsFilterKeyFromInfiniteQueryKey(queryKey) ?? fallbackFilterKey;

export const buildDefaultTransactionsFilterKey = (
  spaceCode: string,
  startDate: string,
  endDate: string,
): string => {
  const categoriesSerialized = serializeFilterValues([]);
  const accountNamesSerialized = serializeFilterValues([]);
  const tagIdsSerialized = serializeFilterValues([]);

  return buildTransactionsFilterKey({
    categoriesSerialized,
    startDate,
    endDate,
    minAmount: "",
    maxAmount: "",
    searchQuery: "",
    accountNamesSerialized,
    tagIdsSerialized,
    entryType: "all",
  });
};
