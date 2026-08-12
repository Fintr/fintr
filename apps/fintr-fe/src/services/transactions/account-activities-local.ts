import {
  buildTransactionsFilterKey,
  loadCachedTransactionsPageAt,
} from "@/services/transactions/local-cache";
import type {
  ActivitiesPage,
  IndexActivity,
  IndexTransaction,
  TransactionsPage,
} from "@/types/transactionTypes";
import { serializeFilterValues } from "@/utils/transactionFilterValues";

import type { FetchAccountActivitiesPageParams } from "./accountActivities";

const mapTransactionToActivity = (
  transaction: IndexTransaction,
): IndexActivity => ({
  ...transaction,
  type: transaction.type,
});

export const loadCachedAccountActivitiesPage = async (
  spaceId: string,
  accountName: string,
  params: FetchAccountActivitiesPageParams,
): Promise<ActivitiesPage | undefined> => {
  if (!spaceId || !accountName) {
    return undefined;
  }

  const categoriesSerialized = serializeFilterValues(params.categoryFilters);
  const accountNamesSerialized = serializeFilterValues([accountName]);

  const filterKey = buildTransactionsFilterKey({
    categoriesSerialized,
    startDate: params.startDate,
    endDate: params.endDate,
    minAmount: params.minAmount !== undefined ? String(params.minAmount) : "",
    maxAmount: params.maxAmount !== undefined ? String(params.maxAmount) : "",
    searchQuery: params.searchQuery,
    accountNamesSerialized,
    tagIdsSerialized: serializeFilterValues([]),
  });

  const page = await loadCachedTransactionsPageAt(
    spaceId,
    filterKey,
    params.page,
  );

  if (!page) {
    return undefined;
  }

  return {
    activities: page.transactions.map(mapTransactionToActivity),
    nextPage: page.nextPage,
    totalPages: page.totalPages,
    totalCount: page.totalCount,
    totals: page.totals,
  };
};

export const buildAccountActivitiesLocalQueryKey = (
  spaceId: string,
  accountId: string,
  accountName: string,
  params: Omit<FetchAccountActivitiesPageParams, "page">,
): string[] => {
  const categoriesSerialized = serializeFilterValues(params.categoryFilters);
  const accountNamesSerialized = serializeFilterValues([accountName]);

  const filterKey = buildTransactionsFilterKey({
    categoriesSerialized,
    startDate: params.startDate,
    endDate: params.endDate,
    minAmount: params.minAmount !== undefined ? String(params.minAmount) : "",
    maxAmount: params.maxAmount !== undefined ? String(params.maxAmount) : "",
    searchQuery: params.searchQuery,
    accountNamesSerialized,
    tagIdsSerialized: serializeFilterValues([]),
  });

  return [
    ACCOUNT_DETAIL_ACTIVITIES_LOCAL_KEY,
    spaceId,
    accountId,
    filterKey,
  ];
};

export const ACCOUNT_DETAIL_ACTIVITIES_LOCAL_KEY =
  "accountDetailActivitiesLocal" as const;

export const loadCachedAccountActivitiesInfiniteData = async (
  spaceId: string,
  accountName: string,
  params: Omit<FetchAccountActivitiesPageParams, "page">,
): Promise<{ pages: ActivitiesPage[]; pageParams: number[] } | null> => {
  const firstPage = await loadCachedAccountActivitiesPage(
    spaceId,
    accountName,
    { ...params, page: 1 },
  );

  if (!firstPage) {
    return null;
  }

  const pages: ActivitiesPage[] = [firstPage];
  const pageParams: number[] = [1];

  let nextPage = firstPage.nextPage;

  while (nextPage != null) {
    const page = await loadCachedAccountActivitiesPage(
      spaceId,
      accountName,
      { ...params, page: nextPage },
    );

    if (!page) {
      break;
    }

    pages.push(page);
    pageParams.push(nextPage);
    nextPage = page.nextPage;
  }

  return { pages, pageParams };
};

export const loadCachedAccountDetailTransactionsPage = async (
  spaceId: string,
  accountName: string,
  params: {
    startDate: string;
    endDate: string;
    categoryFilter: string;
    searchQuery: string;
    page: number;
    minAmount?: number;
    maxAmount?: number;
  },
): Promise<TransactionsPage | undefined> => {
  const categoryFilters =
    params.categoryFilter && params.categoryFilter !== "all"
      ? [params.categoryFilter]
      : [];

  const page = await loadCachedAccountActivitiesPage(
    spaceId,
    accountName,
    {
      accountId: "",
      startDate: params.startDate,
      endDate: params.endDate,
      categoryFilters,
      searchQuery: params.searchQuery,
      page: params.page,
      ...(params.minAmount !== undefined ? { minAmount: params.minAmount } : {}),
      ...(params.maxAmount !== undefined ? { maxAmount: params.maxAmount } : {}),
    },
  );

  if (!page) {
    return undefined;
  }

  return {
    transactions: page.activities as IndexTransaction[],
    nextPage: page.nextPage,
    totalPages: page.totalPages,
    totalCount: page.totalCount,
    totals: page.totals,
  };
};
