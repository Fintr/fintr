import type { QueryClient } from "@tanstack/react-query";

import { ACCOUNT_DETAIL_ACTIVITIES_KEY } from "@/hooks/async/useAccountDetailActivities";
import { computeLocalTransactionTotals } from "@/services/transactions/local-cache";
import {
  parseTransactionListFilterFromQueryKey,
  transactionMatchesListFilter,
  type IndexTransactionWithCategoryIds,
} from "@/services/transactions/upsert-into-query-caches";
import type {
  ActivitiesPage,
  IndexActivity,
  IndexTransaction,
  TransactionsPage,
  TransactionTotals,
} from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

type InfinitePageData<TPage> = {
  pages: TPage[];
  pageParams: unknown[];
};

const isInfinitePageData = <TPage>(
  value: unknown,
): value is InfinitePageData<TPage> => {
  if (!value || typeof value !== "object") return false;
  const record = value as { pages?: unknown };
  return Array.isArray(record.pages);
};

const toAmountNumber = (amount: IndexTransaction["amount"]): number => {
  if (typeof amount === "number") return amount;
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : 0;
};

const subtractFromTotals = (
  totals: TransactionTotals | null | undefined,
  removed: IndexTransaction[],
): TransactionTotals | null => {
  if (!totals) {
    return null;
  }

  let income = totals.income;
  let expense = totals.expense;
  let transfer = totals.transfer ?? 0;

  for (const row of removed) {
    const amount = Math.abs(toAmountNumber(row.amount));
    if (row.type === CombinedTransactionTypeEnum.INCOME) income -= amount;
    if (row.type === CombinedTransactionTypeEnum.EXPENSE) expense -= amount;
    if (row.type === CombinedTransactionTypeEnum.TRANSFER) transfer -= amount;
  }

  return {
    income: Math.max(0, income),
    expense: Math.max(0, expense),
    transfer: Math.max(0, transfer),
  };
};

const removeFromTransactionsPages = (
  pages: TransactionsPage[],
  matchingRemoved: IndexTransaction[],
): TransactionsPage[] => {
  const idSet = new Set(matchingRemoved.map((row) => row.id));
  const first = pages[0];
  const removedFromLoaded = pages.flatMap((page) =>
    page.transactions.filter((row) => idSet.has(row.id)),
  );
  const nextPages = pages.map((page) => ({
    ...page,
    transactions: page.transactions.filter((row) => !idSet.has(row.id)),
  }));
  const remainingFlat = nextPages.flatMap((page) => page.transactions);
  const removedCount = matchingRemoved.length;
  const baseTotal = first?.totalCount ?? pages.reduce(
    (sum, page) => sum + page.transactions.length,
    0,
  );

  let totals: TransactionTotals | null;
  if (remainingFlat.length === 0) {
    totals = null;
  } else if (first?.totals == null) {
    totals = computeLocalTransactionTotals(remainingFlat);
  } else {
    // Prefer full removed set (filter-matched) so totals drop even if the row
    // was only represented in server-side totals, not the loaded page window.
    totals = subtractFromTotals(
      first.totals,
      matchingRemoved.length > 0 ? matchingRemoved : removedFromLoaded,
    );
  }

  return nextPages.map((page, pageIndex) => ({
    ...page,
    totalCount: Math.max(0, baseTotal - removedCount),
    totals: pageIndex === 0 ? totals : page.totals,
  }));
};

const filterActivitiesPage = (
  page: ActivitiesPage,
  removedIds: Set<string>,
): ActivitiesPage => {
  const activities = page.activities.filter(
    (row) => !removedIds.has(row.id) && !removedIds.has(row.activitableId ?? ""),
  );
  if (activities.length === page.activities.length) {
    return page;
  }

  const removed = page.activities.filter(
    (row) => removedIds.has(row.id) || removedIds.has(row.activitableId ?? ""),
  );
  return {
    ...page,
    activities,
    totalCount: Math.max(0, (page.totalCount ?? activities.length) - removed.length),
    totals: subtractFromTotals(page.totals, removed as IndexTransaction[]),
  };
};

/**
 * Remove deleted transactions from matching React Query caches.
 * Only updates `["transactions", …]` lists whose filter matches a removed row.
 */
export const removeIndexTransactionsFromQueryCaches = (
  queryClient: QueryClient,
  params: {
    spaceId: string;
    removedIds?: string[];
    removedTransactions?: IndexTransactionWithCategoryIds[];
  },
): void => {
  const { spaceId } = params;
  const removedTransactions = params.removedTransactions ?? [];
  const removedIds =
    params.removedIds ?? removedTransactions.map((row) => row.id);
  if (!spaceId || (removedIds.length === 0 && removedTransactions.length === 0)) {
    return;
  }

  const idSet = new Set(removedIds);
  const entries = queryClient.getQueriesData<unknown>({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "transactions") return false;
      return key[1] === spaceId || key[2] === spaceId;
    },
  });

  for (const [queryKey, old] of entries) {
    if (!old) continue;

    const filter = parseTransactionListFilterFromQueryKey(queryKey);
    if (!filter) continue;

    const matchingSeed = removedTransactions.filter((row) =>
      transactionMatchesListFilter(row, filter),
    );

    // Deletes must drop rows that are currently visible, even when the seed
    // preview fails filter matching (cold IDB / synthetic series siblings).
    if (!isInfinitePageData<TransactionsPage>(old)) {
      if (Array.isArray(old)) {
        const rows = old as IndexTransaction[];
        const present = rows.filter((row) => idSet.has(row.id));
        if (present.length === 0) continue;
        queryClient.setQueryData(
          queryKey,
          rows.filter((row) => !idSet.has(row.id)),
        );
      }
      continue;
    }

    const presentInCache = old.pages
      .flatMap((page) => page.transactions)
      .filter((row) => idSet.has(row.id));

    if (presentInCache.length === 0 && matchingSeed.length === 0) {
      continue;
    }

    const byId = new Map<string, IndexTransaction>();
    for (const row of [...presentInCache, ...matchingSeed]) {
      byId.set(row.id, row);
    }

    queryClient.setQueryData(queryKey, {
      ...old,
      pages: removeFromTransactionsPages(
        old.pages,
        Array.from(byId.values()),
      ),
    });
  }

  // Account activity feeds are account-scoped; still remove by id when present.
  queryClient.setQueriesData(
    {
      predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && key[0] === ACCOUNT_DETAIL_ACTIVITIES_KEY;
      },
    },
    (old) => {
      if (!isInfinitePageData<ActivitiesPage>(old)) {
        if (Array.isArray(old)) {
          return (old as IndexActivity[]).filter(
            (row) => !idSet.has(row.id) && !idSet.has(row.activitableId ?? ""),
          );
        }
        return old;
      }

      const present = old.pages.some((page) =>
        page.activities.some(
          (row) => idSet.has(row.id) || idSet.has(row.activitableId ?? ""),
        ),
      );
      if (!present) return old;

      return {
        ...old,
        pages: old.pages.map((page) => filterActivitiesPage(page, idSet)),
      };
    },
  );
};
