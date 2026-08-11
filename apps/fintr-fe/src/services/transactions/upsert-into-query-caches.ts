import type { QueryClient } from "@tanstack/react-query";

import {
  computeLocalTransactionTotals,
  insertTransactionNewestFirst,
  LOCAL_TRANSACTIONS_PAGE_SIZE,
} from "@/services/transactions/local-cache";
import type {
  IndexTransaction,
  TransactionsPage,
  TransactionTotals,
} from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import {
  type IndexTransactionWithCategoryIds,
  parseTransactionListFilterFromQueryKey,
  transactionMatchesListFilter,
  type TransactionListFilter,
} from "@/utils/transactionListFilter";

type InfinitePageData<TPage> = {
  pages: TPage[];
  pageParams: unknown[];
};

export type { IndexTransactionWithCategoryIds, TransactionListFilter };

const isInfinitePageData = <TPage>(
  value: unknown,
): value is InfinitePageData<TPage> => {
  if (!value || typeof value !== "object") return false;
  const record = value as { pages?: unknown };
  return Array.isArray(record.pages);
};

export { transactionMatchesListFilter, parseTransactionListFilterFromQueryKey };

const transactionDateKey = (date: IndexTransaction["date"]): string => {
  if (typeof date === "string") {
    return date.slice(0, 10);
  }
  return String(date ?? "").slice(0, 10);
};

const toAmountNumber = (amount: IndexTransaction["amount"]): number => {
  if (typeof amount === "number") {
    return amount;
  }

  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : 0;
};

const adjustTotalsForUpsert = (
  totals: TransactionTotals,
  params: {
    previous: IndexTransaction | null;
    next: IndexTransaction;
    wasPresent: boolean;
  },
): TransactionTotals => {
  let income = totals.income;
  let expense = totals.expense;
  let transfer = totals.transfer ?? 0;

  const apply = (row: IndexTransaction, sign: 1 | -1) => {
    const amount = Math.abs(toAmountNumber(row.amount));
    if (row.type === CombinedTransactionTypeEnum.INCOME) income += sign * amount;
    if (row.type === CombinedTransactionTypeEnum.EXPENSE) expense += sign * amount;
    if (row.type === CombinedTransactionTypeEnum.TRANSFER) transfer += sign * amount;
  };

  if (params.wasPresent && params.previous) {
    apply(params.previous, -1);
  }
  apply(params.next, 1);

  return {
    income: Math.max(0, income),
    expense: Math.max(0, expense),
    transfer: Math.max(0, transfer),
  };
};

/** Keep null when empty (UI hides); once rows exist, expose computed totals. */
const resolveTotalsAfterUpsert = (
  previousTotals: TransactionTotals | null | undefined,
  nextFlat: IndexTransaction[],
  params: {
    previous: IndexTransaction | null;
    next: IndexTransaction;
    wasPresent: boolean;
  },
): TransactionTotals | null => {
  if (nextFlat.length === 0) {
    return null;
  }

  if (previousTotals == null) {
    return computeLocalTransactionTotals(nextFlat);
  }

  return adjustTotalsForUpsert(previousTotals, params);
};

const upsertSortedTransactions = (
  rows: IndexTransaction[],
  transaction: IndexTransaction,
): { rows: IndexTransaction[]; previous: IndexTransaction | null; wasPresent: boolean } => {
  const existingIndex = rows.findIndex((row) => row.id === transaction.id);
  const previous = existingIndex >= 0 ? rows[existingIndex] : null;

  // Same-id updates keep list position (avoids createdAt flip-flop jank after
  // optimistic → server reconcile). Re-sort only when the calendar day changes.
  if (existingIndex >= 0 && previous) {
    const dateChanged =
      transactionDateKey(previous.date) !== transactionDateKey(transaction.date);
    if (!dateChanged) {
      const next = [...rows];
      next[existingIndex] = transaction;
      return {
        rows: next,
        previous,
        wasPresent: true,
      };
    }
  }

  return {
    rows: insertTransactionNewestFirst(rows, transaction),
    previous,
    wasPresent: existingIndex >= 0,
  };
};

const rebuildTransactionPages = (
  pages: TransactionsPage[],
  nextFlat: IndexTransaction[],
  params: {
    previous: IndexTransaction | null;
    next: IndexTransaction;
    wasPresent: boolean;
  },
): TransactionsPage[] => {
  const pageSize =
    pages.length > 1
      ? Math.max(1, pages[0]?.transactions.length || LOCAL_TRANSACTIONS_PAGE_SIZE)
      : Math.max(nextFlat.length, 1);

  const first = pages[0];
  const deltaCount = params.wasPresent ? 0 : 1;
  const baseTotal =
    first?.totalCount ??
    pages.reduce((sum, page) => sum + page.transactions.length, 0);
  const totalCount = Math.max(0, baseTotal + deltaCount);
  const totals = resolveTotalsAfterUpsert(first?.totals, nextFlat, params);

  if (pages.length <= 1) {
    return [
      {
        transactions: nextFlat,
        nextPage: first?.nextPage ?? null,
        totalPages: first?.totalPages ?? 1,
        totalCount,
        totals,
      },
    ];
  }

  const rebuilt: TransactionsPage[] = [];
  for (let offset = 0, pageIndex = 0; offset < nextFlat.length || pageIndex < pages.length; pageIndex += 1) {
    const slice = nextFlat.slice(offset, offset + pageSize);
    offset += pageSize;
    const template = pages[pageIndex] ?? pages[pages.length - 1];
    rebuilt.push({
      ...template,
      transactions: slice,
      totalCount,
      totals: pageIndex === 0 ? totals : template.totals,
    });
    if (offset >= nextFlat.length && pageIndex >= pages.length - 1) {
      break;
    }
  }

  return rebuilt.length > 0 ? rebuilt : pages;
};

const applyUpsertsToCachedValue = (
  old: unknown,
  matching: IndexTransactionWithCategoryIds[],
): unknown => {
  if (matching.length === 0) return old;

  if (!isInfinitePageData<TransactionsPage>(old)) {
    if (Array.isArray(old)) {
      let rows = old as IndexTransaction[];
      for (const row of matching) {
        rows = upsertSortedTransactions(rows, row).rows;
      }
      return rows;
    }
    return old;
  }

  let pages = old.pages;
  for (const row of matching) {
    const flat = pages.flatMap((page) => page.transactions);
    const upserted = upsertSortedTransactions(flat, row);
    pages = rebuildTransactionPages(pages, upserted.rows, {
      previous: upserted.previous,
      next: row,
      wasPresent: upserted.wasPresent,
    });
  }

  return {
    ...old,
    pages,
  };
};

/**
 * Upsert created/updated index rows into matching React Query transaction lists
 * (filter match + date-desc order). Idempotent by id.
 */
export const upsertIndexTransactionsIntoQueryCaches = (
  queryClient: QueryClient,
  params: {
    spaceId: string;
    transactions: IndexTransactionWithCategoryIds[];
  },
): void => {
  const { spaceId, transactions } = params;
  if (!spaceId || transactions.length === 0) return;

  const entries = queryClient.getQueriesData<unknown>({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "transactions") return false;
      return key[1] === spaceId || key[2] === spaceId;
    },
  });

  for (const [queryKey, old] of entries) {
    const filter = parseTransactionListFilterFromQueryKey(queryKey);
    if (!filter) continue;

    const matching = transactions.filter((row) =>
      transactionMatchesListFilter(row, filter),
    );
    if (matching.length === 0) continue;

    const seeded =
      old ??
      ({
        pages: [
          {
            transactions: [],
            nextPage: null,
            totalPages: 1,
            totalCount: 0,
            totals: null,
          },
        ],
        pageParams: [1],
      } satisfies InfinitePageData<TransactionsPage>);

    queryClient.setQueryData(
      queryKey,
      applyUpsertsToCachedValue(seeded, matching),
    );
  }
};

const renameIdInCachedValue = (
  old: unknown,
  previousId: string,
  nextId: string,
): unknown => {
  if (!old) return old;

  if (!isInfinitePageData<TransactionsPage>(old)) {
    if (Array.isArray(old)) {
      const rows = old as IndexTransaction[];
      if (!rows.some((row) => row.id === previousId)) return old;
      const nextAlreadyPresent = rows.some((row) => row.id === nextId);
      if (nextAlreadyPresent) {
        return rows.filter((row) => row.id !== previousId);
      }
      return rows.map((row) =>
        row.id === previousId ? { ...row, id: nextId } : row,
      );
    }
    return old;
  }

  const present = old.pages.some((page) =>
    page.transactions.some((row) => row.id === previousId),
  );
  if (!present) return old;

  const nextAlreadyPresent = old.pages.some((page) =>
    page.transactions.some((row) => row.id === nextId),
  );

  return {
    ...old,
    pages: old.pages.map((page) => ({
      ...page,
      transactions: nextAlreadyPresent
        ? page.transactions.filter((row) => row.id !== previousId)
        : page.transactions.map((row) =>
            row.id === previousId ? { ...row, id: nextId } : row,
          ),
    })),
  };
};

/**
 * Rename a cached transaction id (e.g. local:… → server id) without reshuffling
 * or changing totals.
 */
export const replaceIndexTransactionIdInQueryCaches = (
  queryClient: QueryClient,
  params: {
    spaceId: string;
    previousId: string;
    nextId: string;
  },
): void => {
  const { spaceId, previousId, nextId } = params;
  if (!spaceId || !previousId || !nextId || previousId === nextId) return;

  const entries = queryClient.getQueriesData<unknown>({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "transactions") return false;
      return key[1] === spaceId || key[2] === spaceId;
    },
  });

  for (const [queryKey, old] of entries) {
    queryClient.setQueryData(
      queryKey,
      renameIdInCachedValue(old, previousId, nextId),
    );
  }
};
