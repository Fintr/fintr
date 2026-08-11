import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionEntryTypeFilter } from "@/utils/transactionEntryTypeFilter";

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
