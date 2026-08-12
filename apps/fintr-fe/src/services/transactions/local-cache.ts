import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { normalizeRealtimeIndexTransaction } from "@/hooks/useTransactionsRealtime";
import { getLocalDb } from "@/lib/local-db/db";
import {
  countSpaceTransactions,
  deleteSpaceTransactions,
  getSpaceTransaction,
  listSpaceTransactions,
  listSpaceTransactionsInDateRange,
  putSpaceTransactions,
} from "@/lib/local-db/transactions";
import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import {
  OFFLINE_BOOTSTRAP_END_DATE,
  OFFLINE_BOOTSTRAP_START_DATE,
} from "@/lib/local-sync/offline-bootstrap-dates";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionEntryTypeFilter } from "@/utils/transactionEntryTypeFilter";
import {
  parseTransactionListFilterFromFilterKey,
  transactionMatchesListFilter,
} from "@/utils/transactionListFilter";
import { resolveIndexTransactionTagIds } from "@/utils/resolveIndexTransactionTagIds";
import type {
  IndexTransaction,
  TransactionTotals,
  TransactionsPage,
} from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  resolveSeriesRowsForDeleteScope,
  sameSeriesFingerprint,
} from "./resolve-delete-scope";

/** UI page size when reading from IndexedDB (keeps the list snappy). */
export const LOCAL_TRANSACTIONS_PAGE_SIZE = 25;

/** Prefetch the next page once this item (1-based) of the latest page is visible. */
export const LOCAL_TRANSACTIONS_PREFETCH_AT_ITEM = 11;

/** Index in the flat list where the infinite-scroll sentinel should attach. */
export const getLocalTransactionsPrefetchIndex = (
  loadedCount: number,
  lastPageCount: number,
  hasNextPage: boolean,
): number | null => {
  if (!hasNextPage || loadedCount === 0) {
    return null;
  }

  const lastPageStart = Math.max(0, loadedCount - lastPageCount);
  const target =
    lastPageStart + (LOCAL_TRANSACTIONS_PREFETCH_AT_ITEM - 1);

  return Math.min(target, loadedCount - 1);
};

export const transactionsPageCacheKey = (
  spaceId: string,
  filterKey: string
): string => `transactionsPage1:${spaceId}:${filterKey}`;

export const transactionsAllPagesCacheKey = (
  spaceId: string,
  filterKey: string,
): string => `transactionsAllPages:${spaceId}:${filterKey}`;

export const buildTransactionsFilterKey = (parts: {
  categoriesSerialized: string;
  startDate: string;
  endDate: string;
  minAmount: string;
  maxAmount: string;
  searchQuery: string;
  accountNamesSerialized: string;
  tagIdsSerialized: string;
  entryType?: TransactionEntryTypeFilter;
}): string =>
  [
    parts.categoriesSerialized,
    parts.startDate,
    parts.endDate,
    parts.minAmount,
    parts.maxAmount,
    parts.searchQuery,
    parts.accountNamesSerialized,
    parts.tagIdsSerialized,
    parts.entryType ?? "all",
  ].join("|");

const parseFilterKeyParts = (filterKey: string) => {
  const parts = filterKey.split("|");

  return {
    categoriesSerialized: parts[0] ?? "[]",
    startDate: parts[1] ?? "",
    endDate: parts[2] ?? "",
    minAmount: parts[3] ?? "",
    maxAmount: parts[4] ?? "",
    searchQuery: parts[5] ?? "",
    accountNamesSerialized: parts[6] ?? "[]",
    tagIdsSerialized: parts[7] ?? "[]",
    entryType: parts[8] ?? "all",
  };
};

/** Same filters and date range as `filterKey`, but entry type is `all`. */
export const buildUnfilteredEntryTypeFilterKey = (filterKey: string): string => {
  const parts = parseFilterKeyParts(filterKey);

  return buildTransactionsFilterKey({
    categoriesSerialized: parts.categoriesSerialized,
    startDate: parts.startDate,
    endDate: parts.endDate,
    minAmount: parts.minAmount,
    maxAmount: parts.maxAmount,
    searchQuery: parts.searchQuery,
    accountNamesSerialized: parts.accountNamesSerialized,
    tagIdsSerialized: parts.tagIdsSerialized,
    entryType: "all",
  });
};

const parseFilterKeyDates = (
  filterKey: string,
): { startDate: string; endDate: string } => {
  const { startDate, endDate } = parseFilterKeyParts(filterKey);

  return { startDate, endDate };
};

const transactionDateKey = (date: string): string => date.slice(0, 10);

const transactionInDateRange = (
  date: string,
  startDate: string,
  endDate: string,
): boolean => {
  const key = transactionDateKey(date);
  return key >= startDate && key <= endDate;
};

export const buildAllTimeTransactionsFilterKey = (parts: {
  categoriesSerialized: string;
  minAmount: string;
  maxAmount: string;
  searchQuery: string;
  accountNamesSerialized: string;
  tagIdsSerialized: string;
}): string =>
  buildTransactionsFilterKey({
    ...parts,
    startDate: OFFLINE_BOOTSTRAP_START_DATE,
    endDate: OFFLINE_BOOTSTRAP_END_DATE,
  });

const emptyTransactionsPage = (): TransactionsPage => ({
  transactions: [],
  nextPage: null,
  totalPages: 1,
  totalCount: 0,
  totals: {
    income: 0,
    expense: 0,
    transfer: 0,
  },
});

const toAmountNumber = (amount: IndexTransaction["amount"]): number => {
  if (typeof amount === "number") {
    return amount;
  }

  const parsed = Number(amount);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const computeLocalTransactionTotals = (
  transactions: IndexTransaction[],
): TransactionTotals => {
  return transactions.reduce(
    (totals, transaction) => {
      const amount = toAmountNumber(transaction.amount);

      if (transaction.type === CombinedTransactionTypeEnum.INCOME) {
        totals.income += amount;
      } else if (transaction.type === CombinedTransactionTypeEnum.EXPENSE) {
        totals.expense += amount;
      } else if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
        totals.transfer += amount;
      }

      return totals;
    },
    { income: 0, expense: 0, transfer: 0 },
  );
};

export const paginateTransactions = (
  transactions: IndexTransaction[],
  pageParam: number,
  options?: {
    pageSize?: number;
    totals?: TransactionTotals | null;
  },
): TransactionsPage => {
  const pageSize = options?.pageSize ?? LOCAL_TRANSACTIONS_PAGE_SIZE;
  const safePage = Math.max(1, pageParam);
  const totalCount = transactions.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
  const start = (safePage - 1) * pageSize;
  const slice = transactions.slice(start, start + pageSize);

  return {
    transactions: slice,
    nextPage: safePage < totalPages ? safePage + 1 : null,
    totalPages,
    totalCount,
    totals:
      options?.totals ??
      (safePage === 1 ? computeLocalTransactionTotals(transactions) : null),
  };
};

const loadRawCachedTransactionsPages = async (
  spaceId: string,
  filterKey: string,
): Promise<TransactionsPage[] | undefined> => {
  const allPages = await getLocalResponseSnapshot<unknown>(
    transactionsAllPagesCacheKey(spaceId, filterKey),
  );

  if (Array.isArray(allPages) && allPages.length > 0) {
    return allPages as TransactionsPage[];
  }

  const singlePage = allPages as TransactionsPage | undefined;
  if (singlePage?.transactions?.length) {
    return [singlePage];
  }

  const infiniteShape = allPages as { pages?: TransactionsPage[] } | undefined;
  if (Array.isArray(infiniteShape?.pages) && infiniteShape.pages.length > 0) {
    return infiniteShape.pages;
  }

  const firstPage = await loadCachedTransactionsPage(spaceId, filterKey);
  if (!firstPage) {
    return undefined;
  }

  return [firstPage];
};

const resolveSourcePagesForFilter = async (
  spaceId: string,
  filterKey: string,
): Promise<{
  sourcePages: TransactionsPage[];
  startDate: string;
  endDate: string;
} | undefined> => {
  const { startDate, endDate } = parseFilterKeyDates(filterKey);
  const filterParts = parseFilterKeyParts(filterKey);
  const allTimeFilterKey = buildAllTimeTransactionsFilterKey({
    categoriesSerialized: filterParts.categoriesSerialized,
    minAmount: filterParts.minAmount,
    maxAmount: filterParts.maxAmount,
    searchQuery: filterParts.searchQuery,
    accountNamesSerialized: filterParts.accountNamesSerialized,
    tagIdsSerialized: filterParts.tagIdsSerialized,
  });

  const allTimePages = await loadRawCachedTransactionsPages(
    spaceId,
    allTimeFilterKey,
  );

  if (allTimePages?.length) {
    return { sourcePages: allTimePages, startDate, endDate };
  }

  if (filterParts.entryType !== "all") {
    // Entry-type pills filter client-side; reuse the cached "all" snapshot for this range.
    const rangeAllPages = await loadRawCachedTransactionsPages(
      spaceId,
      buildUnfilteredEntryTypeFilterKey(filterKey),
    );

    if (rangeAllPages?.length) {
      return { sourcePages: rangeAllPages, startDate, endDate };
    }
  }

  const bootstrapPages = await loadRawCachedTransactionsPages(
    spaceId,
    unfilteredAllTimeTransactionsFilterKey(),
  );
  if (bootstrapPages?.length) {
    return { sourcePages: bootstrapPages, startDate, endDate };
  }

  const exactPages = await loadRawCachedTransactionsPages(spaceId, filterKey);
  if (exactPages?.length) {
    return { sourcePages: exactPages, startDate, endDate };
  }

  const scattered = await loadScatteredCachedTransactions(spaceId);
  if (scattered.length > 0) {
    return {
      sourcePages: [
        {
          transactions: scattered,
          nextPage: null,
          totalPages: 1,
          totalCount: scattered.length,
          totals: null,
        },
      ],
      startDate,
      endDate,
    };
  }

  return undefined;
};

const filterTransactionsForRange = (
  sourcePages: TransactionsPage[],
  filterKey: string,
): IndexTransaction[] => {
  const filter = parseTransactionListFilterFromFilterKey(filterKey);

  return sourcePages
    .flatMap((page) => page.transactions ?? [])
    .filter((transaction) => transactionMatchesListFilter(transaction, filter));
};

export const cacheTransactionsPage = async (
  spaceId: string,
  filterKey: string,
  page: TransactionsPage
): Promise<void> => {
  if (!spaceId || !filterKey) {
    return;
  }

  try {
    await putLocalResponseSnapshot(
      transactionsPageCacheKey(spaceId, filterKey),
      page
    );
  } catch (error) {
    console.warn("[local-db] Failed to cache transactions page", error);
  }
};

export const loadCachedTransactionsPage = async (
  spaceId: string,
  filterKey: string
): Promise<TransactionsPage | undefined> => {
  if (!spaceId || !filterKey) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot<TransactionsPage>(
      transactionsPageCacheKey(spaceId, filterKey)
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached transactions page", error);
    return undefined;
  }
};

export const cacheTransactionsAllPages = async (
  spaceId: string,
  filterKey: string,
  pages: TransactionsPage[],
): Promise<void> => {
  if (!spaceId || !filterKey || pages.length === 0) {
    return;
  }

  try {
    // Merge tag/category metadata from Dexie only (no legacy migrate) so a
    // re-sync that writes sparse list rows cannot wipe filter metadata from
    // meta snapshots, and partial month caches are not promoted early.
    const existingById = new Map(
      (await listSpaceTransactions(spaceId)).map((row) => [row.id, row]),
    );
    const pagesWithMetadata = pages.map((page) => ({
      ...page,
      transactions: page.transactions.map((row) => {
        const existing = existingById.get(row.id);
        if (!existing) {
          return row;
        }

        return mergeIndexTransactionMetadata(
          existing as IndexTransactionWithMetadata,
          row as IndexTransactionWithMetadata,
        ) as IndexTransaction;
      }),
    }));

    await putLocalResponseSnapshot(
      transactionsAllPagesCacheKey(spaceId, filterKey),
      pagesWithMetadata,
    );
    await cacheTransactionsPage(spaceId, filterKey, pagesWithMetadata[0]);
  } catch (error) {
    console.warn("[local-db] Failed to cache transactions pages", error);
  }
};

const loadLegacyTransactionSnapshotsFromMeta = async (
  spaceId: string,
): Promise<IndexTransaction[]> => {
  const filterKey = unfilteredAllTimeTransactionsFilterKey();

  try {
    const pages = await loadRawCachedTransactionsPages(spaceId, filterKey);
    if (!pages?.length) {
      return [];
    }

    return pages.flatMap((page) => page.transactions ?? []);
  } catch (error) {
    console.warn("[local-db] Failed to load legacy transaction snapshots", error);
    return [];
  }
};

const normalizeCachedIndexTransaction = (
  raw: IndexTransaction,
): IndexTransaction => {
  const normalized = normalizeRealtimeIndexTransaction(
    raw as unknown as Record<string, unknown>,
  );

  if (!normalized) {
    return raw;
  }

  const merged = {
    ...raw,
    ...normalized,
  };

  const tagIds = resolveTransactionTagIds(merged);
  if (tagIds.length === 0) {
    delete (merged as IndexTransactionWithTagIds).tags;
    delete (merged as IndexTransactionWithTagIds).tagIds;
  }

  return merged;
};

const mergeTransactionRowsIntoMap = (
  byId: Map<string, IndexTransaction>,
  rows: IndexTransaction[],
): void => {
  for (const row of rows) {
    if (!row?.id) {
      continue;
    }

    const existing = byId.get(row.id);
    const merged = existing
      ? mergeIndexTransactionMetadata(
          existing,
          row as IndexTransactionWithMetadata,
        )
      : row;

    byId.set(row.id, normalizeCachedIndexTransaction(merged));
  }
};

const extractTransactionsFromMetaRow = (
  key: string,
  value: unknown,
): IndexTransaction[] => {
  if (key.startsWith("transactionsPage1:")) {
    const page = value as TransactionsPage | undefined;
    return page?.transactions ?? [];
  }

  if (!key.startsWith("transactionsAllPages:")) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((page) => {
      const row = page as TransactionsPage;
      return row?.transactions ?? [];
    });
  }

  const singlePage = value as TransactionsPage | undefined;
  if (singlePage?.transactions?.length) {
    return singlePage.transactions;
  }

  const infiniteShape = value as { pages?: TransactionsPage[] } | undefined;
  if (Array.isArray(infiniteShape?.pages)) {
    return infiniteShape.pages.flatMap((page) => page.transactions ?? []);
  }

  return [];
};

/**
 * Merge every month-scoped transactionsAllPages snapshot and online page-1
 * snapshots for this space. Bootstrap writes full pages; online browsing often
 * only caches page 1 under transactionsPage1 — insights must read both.
 */
const loadScatteredCachedTransactions = async (
  spaceId: string,
): Promise<IndexTransaction[]> => {
  const allPagesPrefix = `transactionsAllPages:${spaceId}:`;
  const pageOnePrefix = `transactionsPage1:${spaceId}:`;

  try {
    const rows = await getLocalDb()
      .meta
      .filter(
        (row) =>
          row.key.startsWith(allPagesPrefix)
          || row.key.startsWith(pageOnePrefix),
      )
      .toArray();

    const byId = new Map<string, IndexTransaction>();

    for (const row of rows) {
      mergeTransactionRowsIntoMap(
        byId,
        extractTransactionsFromMetaRow(row.key, row.value),
      );
    }

    return Array.from(byId.values());
  } catch (error) {
    console.warn("[local-db] Failed to load scattered transaction caches", error);
    return [];
  }
};

/** Meta snapshots from bootstrap / online page-1 caches (not always in Dexie). */
export const loadScatteredTransactionSnapshotsFromMeta = async (
  spaceId: string,
): Promise<IndexTransaction[]> => loadScatteredCachedTransactions(spaceId);

/** Load every cached transaction row for a space (meta snapshots + Dexie index). */
export const loadAllCachedTransactionsForInsights = async (
  spaceId: string,
): Promise<IndexTransaction[]> => {
  if (!spaceId) {
    return [];
  }

  // Only migrate/rewrite when the index is empty. Re-merging meta into Dexie on
  // every insights open was loading + writing the full history and froze the UI.
  const existingCount = await countSpaceTransactions(spaceId);
  if (existingCount === 0) {
    await mergeMetaTransactionSnapshotsIntoIndex(spaceId);
  }

  const byId = new Map<string, IndexTransaction>();

  const mergeRows = (rows: IndexTransaction[]): void => {
    for (const row of rows) {
      if (!row?.id) {
        continue;
      }

      const existing = byId.get(row.id);
      byId.set(
        row.id,
        existing
          ? (mergeIndexTransactionMetadata(
              existing as IndexTransactionWithMetadata,
              row as IndexTransactionWithMetadata,
            ) as IndexTransaction)
          : row,
      );
    }
  };

  // Meta first (bootstrap often has full tags), then Dexie — merge metadata
  // instead of blind overwrite so list rows without tags cannot wipe them.
  mergeRows(await loadScatteredCachedTransactions(spaceId));
  mergeRows(await loadAllTransactionsFromLocalIndex(spaceId));

  if (byId.size > 0) {
    return Array.from(byId.values());
  }

  return await listSpaceTransactions(spaceId);
};

const legacyMigrationPromises = new Map<string, Promise<void>>();

/**
 * One-time import from legacy response snapshots into the normalized
 * `transactions` IndexedDB table (schema v2).
 */
export const migrateLegacyTransactionSnapshotsIfNeeded = async (
  spaceId: string,
): Promise<void> => {
  if (!spaceId) {
    return;
  }

  const inFlight = legacyMigrationPromises.get(spaceId);
  if (inFlight) {
    await inFlight;
    return;
  }

  const migration = (async () => {
    const existingCount = await countSpaceTransactions(spaceId);
    if (existingCount > 0) {
      return;
    }

    const byId = new Map<string, IndexTransaction>();
    mergeTransactionRowsIntoMap(
      byId,
      await loadLegacyTransactionSnapshotsFromMeta(spaceId),
    );
    mergeTransactionRowsIntoMap(
      byId,
      await loadScatteredCachedTransactions(spaceId),
    );

    if (byId.size === 0) {
      return;
    }

    await putSpaceTransactions(spaceId, Array.from(byId.values()));
  })();

  legacyMigrationPromises.set(spaceId, migration);

  try {
    await migration;
  } finally {
    legacyMigrationPromises.delete(spaceId);
  }
};

const loadAllTimeTransactionsFlat = async (
  spaceId: string,
): Promise<IndexTransaction[]> => {
  try {
    await migrateLegacyTransactionSnapshotsIfNeeded(spaceId);
    const rows = await listSpaceTransactions(spaceId);
    return [...rows].sort(compareTransactionsNewestFirst);
  } catch (error) {
    console.warn("[local-db] Failed to load all-time transactions", error);
    return [];
  }
};

const loadAllCachedTransactionsForSpace = async (
  spaceId: string,
): Promise<IndexTransaction[]> => loadAllTimeTransactionsFlat(spaceId);

/** All transactions in the local Dexie index (after legacy migration). */
export const loadAllTransactionsFromLocalIndex = async (
  spaceId: string,
): Promise<IndexTransaction[]> => loadAllCachedTransactionsForSpace(spaceId);

/** Merge meta transaction snapshots into Dexie even when the index is partially populated. */
export const mergeMetaTransactionSnapshotsIntoIndex = async (
  spaceId: string,
): Promise<void> => {
  if (!spaceId) {
    return;
  }

  try {
    await migrateLegacyTransactionSnapshotsIfNeeded(spaceId);

    const byId = new Map<string, IndexTransaction>();
    mergeTransactionRowsIntoMap(
      byId,
      await listSpaceTransactions(spaceId),
    );
    mergeTransactionRowsIntoMap(
      byId,
      await loadScatteredCachedTransactions(spaceId),
    );
    mergeTransactionRowsIntoMap(
      byId,
      await loadLegacyTransactionSnapshotsFromMeta(spaceId),
    );

    if (byId.size === 0) {
      return;
    }

    await putSpaceTransactions(spaceId, Array.from(byId.values()));
  } catch (error) {
    console.warn(
      "[local-db] Failed to merge meta transaction snapshots into index",
      spaceId,
      error,
    );
  }
};

const loadFlatTransactionRowsForFilterKey = async (
  spaceId: string,
  filterKey: string,
): Promise<IndexTransaction[]> => {
  const filter = parseTransactionListFilterFromFilterKey(filterKey);
  const { startDate, endDate } = filter;

  if (startDate && endDate) {
    const rows = await listSpaceTransactionsInDateRange(
      spaceId,
      startDate,
      endDate,
    );

    return rows;
  }

  return [];
};

/**
 * All cached transactions in a date range (from the local transaction index).
 */
export const loadCachedTransactionsInRange = async (
  spaceId: string,
  startDate: string,
  endDate: string,
): Promise<IndexTransaction[]> => {
  if (!spaceId || !startDate || !endDate) {
    return [];
  }

  const rangeFilterKey = buildUnfilteredRangeFilterKey(startDate, endDate);

  try {
    await migrateLegacyTransactionSnapshotsIfNeeded(spaceId);
    const rows = await loadFlatTransactionRowsForFilterKey(
      spaceId,
      rangeFilterKey,
    );

    if (rows.length > 0) {
      const filtered = filterTransactionsForRange(
        [{ transactions: rows }],
        rangeFilterKey,
      );

      if (filtered.length > 0) {
        return filtered.sort(compareTransactionsNewestFirst);
      }
    }

    const resolved = await resolveSourcePagesForFilter(spaceId, rangeFilterKey);
    if (resolved) {
      const fromPages = filterTransactionsForRange(
        resolved.sourcePages,
        rangeFilterKey,
      );

      if (fromPages.length > 0) {
        return fromPages.sort(compareTransactionsNewestFirst);
      }
    }

    return [];
  } catch (error) {
    console.warn("[local-db] Failed to load cached transactions in range", error);
    return [];
  }
};

const buildUnfilteredRangeFilterKey = (
  startDate: string,
  endDate: string,
): string => {
  const emptyFilters = serializeFilterValues([]);

  return buildTransactionsFilterKey({
    categoriesSerialized: emptyFilters,
    startDate,
    endDate,
    minAmount: "",
    maxAmount: "",
    searchQuery: "",
    accountNamesSerialized: emptyFilters,
    tagIdsSerialized: emptyFilters,
  });
};

/**
 * Load a single UI page from IndexedDB (for local infinite scroll).
 * Prefer the flat transaction index (updated by local-first create/delete)
 * over page-1 response snapshots, which go stale under space-sync pull mode
 * when the list skips the network and reloads from IndexedDB.
 */
export const loadCachedTransactionsPageAt = async (
  spaceId: string,
  filterKey: string,
  pageParam: number = 1,
): Promise<TransactionsPage | undefined> => {
  if (!spaceId || !filterKey) {
    return undefined;
  }

  try {
    await migrateLegacyTransactionSnapshotsIfNeeded(spaceId);

    const flatRows = await loadFlatTransactionRowsForFilterKey(spaceId, filterKey);

    if (flatRows.length > 0) {
      const transactions = filterTransactionsForRange(
        [{ transactions: flatRows }],
        filterKey,
      ).sort(compareTransactionsNewestFirst);
      if (transactions.length === 0) {
        return pageParam <= 1 ? emptyTransactionsPage() : undefined;
      }

      const totals = computeLocalTransactionTotals(transactions);
      return paginateTransactions(transactions, pageParam, { totals });
    }

    const resolved = await resolveSourcePagesForFilter(spaceId, filterKey);
    if (!resolved) {
      return undefined;
    }

    const transactions = filterTransactionsForRange(
      resolved.sourcePages,
      filterKey,
    ).sort(compareTransactionsNewestFirst);

    if (transactions.length === 0) {
      return pageParam <= 1 ? emptyTransactionsPage() : undefined;
    }

    const totals = computeLocalTransactionTotals(transactions);
    return paginateTransactions(transactions, pageParam, { totals });
  } catch (error) {
    console.warn("[local-db] Failed to load cached transactions page at", error);
    return undefined;
  }
};

/**
 * Initial infinite-query seed: first local page only (not the full history).
 */
export const loadCachedTransactionsInfiniteData = async (
  spaceId: string,
  filterKey: string,
): Promise<
  | {
      pages: TransactionsPage[];
      pageParams: number[];
    }
  | undefined
> => {
  if (!spaceId || !filterKey) {
    return undefined;
  }

  try {
    const firstPage = await loadCachedTransactionsPageAt(spaceId, filterKey, 1);
    if (!firstPage) {
      return undefined;
    }

    return {
      pages: [firstPage],
      pageParams: [1],
    };
  } catch (error) {
    console.warn("[local-db] Failed to load cached transactions pages", error);
    return undefined;
  }
};

const emptySerializedFilters = (): string => serializeFilterValues([]);

/** Unfiltered all-time bootstrap key used as the write-through source of truth. */
export const unfilteredAllTimeTransactionsFilterKey = (): string =>
  buildAllTimeTransactionsFilterKey({
    categoriesSerialized: emptySerializedFilters(),
    minAmount: "",
    maxAmount: "",
    searchQuery: "",
    accountNamesSerialized: emptySerializedFilters(),
    tagIdsSerialized: emptySerializedFilters(),
  });

/**
 * Same order as BE FilteredCombined: date desc, created_at desc, then id desc.
 * Rows without createdAt sort after same-date rows that have one (stable for
 * older cached rows), except we treat missing as oldest among that date.
 */
export const compareTransactionsNewestFirst = (
  left: IndexTransaction,
  right: IndexTransaction,
): number => {
  const dateCompare = transactionDateKey(right.date).localeCompare(
    transactionDateKey(left.date),
  );
  if (dateCompare !== 0) {
    return dateCompare;
  }

  const leftCreated = left.createdAt ?? "";
  const rightCreated = right.createdAt ?? "";
  if (leftCreated !== rightCreated) {
    // ISO timestamps compare lexicographically; empty sorts last (oldest).
    return rightCreated.localeCompare(leftCreated);
  }

  return String(right.id).localeCompare(String(left.id));
};

/** Insert `transaction` into a date-desc list at the correct index (no full re-shuffle of unrelated rows beyond the splice). */
export const insertTransactionNewestFirst = (
  rows: IndexTransaction[],
  transaction: IndexTransaction,
): IndexTransaction[] => {
  const without = rows.filter((row) => row.id !== transaction.id);
  const insertAt = without.findIndex(
    (row) => compareTransactionsNewestFirst(transaction, row) < 0,
  );
  if (insertAt === -1) {
    return [...without, transaction];
  }
  return [
    ...without.slice(0, insertAt),
    transaction,
    ...without.slice(insertAt),
  ];
};

/**
 * Re-attach never-synced `local:` rows (income/expense/transfer + fees) after a
 * network page fetch so a refetch cannot wipe optimistic creates.
 */
export const mergePendingLocalIndexRowsIntoPage = async (
  spaceId: string,
  page: TransactionsPage,
  filterKey?: string,
): Promise<TransactionsPage> => {
  if (!spaceId || !page) {
    return page;
  }

  const listFilter = filterKey
    ? parseTransactionListFilterFromFilterKey(filterKey)
    : null;

  try {
    const allRows = await loadAllTimeTransactionsFlat(spaceId);
    const pending = allRows.filter((row) => row.id.startsWith("local:"));
    if (pending.length === 0) {
      return page;
    }

    const presentIds = new Set(page.transactions.map((row) => row.id));
    let nextRows = page.transactions;
    let added = 0;
    for (const row of pending) {
      if (presentIds.has(row.id)) continue;
      if (
        listFilter
        && !transactionMatchesListFilter(row, listFilter)
      ) {
        continue;
      }
      nextRows = insertTransactionNewestFirst(nextRows, row);
      presentIds.add(row.id);
      added += 1;
    }

    if (added === 0) {
      return page;
    }

    return {
      ...page,
      transactions: nextRows,
      totalCount: Math.max(page.totalCount ?? nextRows.length, nextRows.length),
      totals:
        page.totals == null
          ? computeLocalTransactionTotals(nextRows)
          : computeLocalTransactionTotals(nextRows),
    };
  } catch (error) {
    console.warn(
      "[local-db] Failed to merge pending local rows into page",
      error,
    );
    return page;
  }
};

export const loadLocalIndexTransactionById = async (
  spaceId: string,
  transactionId: string,
): Promise<IndexTransaction | undefined> => {
  if (!spaceId || !transactionId) {
    return undefined;
  }

  try {
    const rows = await loadAllTimeTransactionsFlat(spaceId);
    return rows.find((row) => row.id === transactionId);
  } catch (error) {
    console.warn("[local-db] Failed to load local transaction by id", error);
    return undefined;
  }
};

/**
 * Resolve which local index ids to remove for a delete scope.
 * Index rows do not carry seriesId, so series scopes use a fingerprint heuristic
 * (type/description/category/accounts/amount). Sibling `inSeries` flags may be
 * stale, so they are not required when the delete scope is series-wide.
 */
export const loadAllTimeTransactionsForDeleteScope = async (params: {
  spaceId: string;
  target: IndexTransaction;
  deleteScope: DeleteScopeEnum;
  /** Extra rows (e.g. from React Query) merged into the search set. */
  extraRows?: IndexTransaction[];
}): Promise<string[]> => {
  const { spaceId, target, deleteScope, extraRows = [] } = params;
  if (!spaceId || !target?.id) {
    return [];
  }

  // Honor the user's delete scope. Do not downgrade series deletes when the
  // clicked row has a stale `inSeries: false` (common on the series parent).
  if (deleteScope === DeleteScopeEnum.THIS_ONLY) {
    return [target.id];
  }

  try {
    const idbRows = await loadAllTimeTransactionsFlat(spaceId);
    const byId = new Map<string, IndexTransaction>();
    for (const row of [...idbRows, ...extraRows, target]) {
      if (row?.id) byId.set(row.id, row);
    }
    const matches = resolveSeriesRowsForDeleteScope({
      rows: Array.from(byId.values()),
      target,
      deleteScope,
    });
    return matches.map((row) => row.id);
  } catch (error) {
    console.warn("[local-db] Failed to resolve delete-scope ids", error);
    return [target.id];
  }
};

export { sameSeriesFingerprint };

export { resolveIndexTransactionTagIds };

type IndexTransactionWithTagIds = IndexTransaction & { tagIds?: string[] };

type IndexTransactionWithMetadata = IndexTransactionWithTagIds & {
  categoryId?: string;
  subcategoryId?: string;
  subcategoryName?: string;
};

const resolveTransactionTagIds = resolveIndexTransactionTagIds;

/**
 * Keep tag metadata when a server/realtime upsert omits tags (common on create sync).
 * List rows often include `tags: []` for untagged expenses — that is not an explicit
 * clear. Only `tagIds: []` on the payload means the user removed all tags.
 */
export const mergeIndexTransactionTags = (
  existing: IndexTransactionWithTagIds | undefined,
  incoming: IndexTransactionWithTagIds,
): IndexTransactionWithTagIds => {
  const incomingTagIds = resolveTransactionTagIds(incoming);
  if (incomingTagIds.length > 0) {
    // Keep existing row fields (amounts, etc.) and only refresh tag metadata.
    return {
      ...(existing ?? {}),
      ...incoming,
      tags: incoming.tags?.length ? incoming.tags : existing?.tags,
      tagIds: incomingTagIds,
    };
  }

  const explicitlyCleared =
    Object.prototype.hasOwnProperty.call(incoming, "tagIds")
    && Array.isArray(incoming.tagIds)
    && incoming.tagIds.length === 0
    // Inconsistent payloads (`tagIds: []` + non-empty `tags`) keep tags.
    && !(Array.isArray(incoming.tags) && incoming.tags.length > 0);
  if (explicitlyCleared) {
    return {
      ...(existing ?? {}),
      ...incoming,
      tags: [],
      tagIds: [],
    };
  }

  const existingTagIds = resolveTransactionTagIds(existing ?? {});
  if (existing && existingTagIds.length > 0) {
    return {
      ...incoming,
      tags: existing.tags,
      tagIds: existing.tagIds ?? existingTagIds,
    };
  }

  return incoming;
};

/**
 * Keep category metadata when a server/realtime upsert omits category fields.
 */
export const mergeIndexTransactionCategory = (
  existing: IndexTransactionWithMetadata | undefined,
  incoming: IndexTransactionWithMetadata,
): IndexTransactionWithMetadata => {
  if (!existing) {
    return incoming;
  }

  const merged = { ...incoming };

  if (!merged.categoryId && existing.categoryId) {
    merged.categoryId = existing.categoryId;
  }

  if (!merged.subcategoryId && existing.subcategoryId) {
    merged.subcategoryId = existing.subcategoryId;
  }

  if ((!merged.categoryName || !merged.categoryName.trim()) && existing.categoryName) {
    merged.categoryName = existing.categoryName;
  }

  if (!merged.subcategoryName && existing.subcategoryName) {
    merged.subcategoryName = existing.subcategoryName;
  }

  return merged;
};

export const mergeIndexTransactionMetadata = (
  existing: IndexTransactionWithMetadata | undefined,
  incoming: IndexTransactionWithMetadata,
): IndexTransactionWithMetadata =>
  mergeIndexTransactionCategory(
    existing,
    mergeIndexTransactionTags(existing, incoming),
  );

/**
 * Merge server-fetched transaction pages into the all-time IndexedDB store.
 * Online refresh only caches the active UI month under a range key; insights
 * category filters read from all-time, so every fetch must upsert here too.
 */
export const mergeFetchedTransactionsIntoAllTimeCache = async (
  spaceId: string,
  pages: TransactionsPage[],
): Promise<void> => {
  if (!spaceId || pages.length === 0) {
    return;
  }

  const incoming = pages.flatMap((page) => page.transactions);
  if (incoming.length === 0) {
    return;
  }

  try {
    const existing = await loadAllTimeTransactionsFlat(spaceId);
    const byId = new Map(existing.map((row) => [row.id, row]));

    for (const row of incoming) {
      const current = byId.get(row.id);
      byId.set(row.id, mergeIndexTransactionMetadata(current, row));
    }

    await putSpaceTransactions(spaceId, Array.from(byId.values()));
  } catch (error) {
    console.warn(
      "[local-db] Failed to merge fetched transactions into all-time cache",
      error,
    );
  }
};

/**
 * Insert or replace a transaction in the all-time IndexedDB cache.
 */
export const upsertLocalIndexTransaction = async (
  spaceId: string,
  transaction: IndexTransaction,
): Promise<void> => {
  if (!spaceId || !transaction?.id) {
    return;
  }

  try {
    const current = await getSpaceTransaction(spaceId, transaction.id);
    const merged = mergeIndexTransactionMetadata(
      current,
      transaction as IndexTransactionWithMetadata,
    );
    await putSpaceTransactions(spaceId, [merged]);
  } catch (error) {
    console.warn("[local-db] Failed to upsert local transaction", error);
  }
};

/**
 * Replace a temporary local id with the server id after a successful create.
 * If realtime already upserted the server id, keep that row's money fields —
 * otherwise sync would wipe the converted amount and re-write the optimistic
 * original FX magnitude under the space currency.
 */
export const replaceLocalIndexTransactionId = async (
  spaceId: string,
  localId: string,
  serverId: string,
  patch?: Partial<IndexTransaction>,
): Promise<void> => {
  if (!spaceId || !localId || !serverId) {
    return;
  }

  try {
    const current = await getSpaceTransaction(spaceId, localId);
    const existingServer =
      localId === serverId
        ? null
        : await getSpaceTransaction(spaceId, serverId);

    if (!current) {
      if (patch) {
        await upsertLocalIndexTransaction(spaceId, {
          ...(existingServer ?? {}),
          ...(patch as IndexTransaction),
          id: serverId,
        });
      }
      return;
    }

    const authoritativeMoney =
      existingServer != null
        ? {
            amount: existingServer.amount,
            amountCurrency: existingServer.amountCurrency,
            bookedAmount: existingServer.bookedAmount,
            bookedAmountCurrency: existingServer.bookedAmountCurrency,
          }
        : {};

    await deleteSpaceTransactions(spaceId, [localId, serverId]);
    const nextRow = mergeIndexTransactionMetadata(current, {
      ...current,
      ...authoritativeMoney,
      ...patch,
      id: serverId,
    });
    await putSpaceTransactions(spaceId, [nextRow]);
  } catch (error) {
    console.warn("[local-db] Failed to replace local transaction id", error);
  }
};

export const removeLocalIndexTransaction = async (
  spaceId: string,
  transactionId: string,
): Promise<void> => {
  if (!spaceId || !transactionId) {
    return;
  }

  try {
    const current = await getSpaceTransaction(spaceId, transactionId);
    if (!current) {
      return;
    }

    await deleteSpaceTransactions(spaceId, [transactionId]);
  } catch (error) {
    console.warn("[local-db] Failed to remove local transaction", error);
  }
};

/**
 * Remove many index rows by id. Returns the rows that were removed (for rollback).
 */
export const removeLocalIndexTransactionsByIds = async (
  spaceId: string,
  transactionIds: string[],
): Promise<IndexTransaction[]> => {
  if (!spaceId || transactionIds.length === 0) {
    return [];
  }

  const idSet = new Set(transactionIds.filter(Boolean));
  if (idSet.size === 0) {
    return [];
  }

  try {
    const removed: IndexTransaction[] = [];

    for (const id of idSet) {
      const current = await getSpaceTransaction(spaceId, id);
      if (current) {
        removed.push(current);
      }
    }

    if (removed.length === 0) {
      return [];
    }

    await deleteSpaceTransactions(spaceId, removed.map((row) => row.id));
    return removed;
  } catch (error) {
    console.warn("[local-db] Failed to remove local transactions", error);
    return [];
  }
};

/**
 * Remove optimistic repeat/installment children for a local-first create
 * (`local:{clientMutationId}:*`), leaving the parent row intact.
 * Also keeps the parent transfer-fee placeholder (`local:{cid}:fee`).
 */
export const removeLocalSeriesChildrenForMutation = async (
  spaceId: string,
  clientMutationId: string,
): Promise<IndexTransaction[]> => {
  if (!spaceId || !clientMutationId) {
    return [];
  }

  const prefix = `local:${clientMutationId}:`;
  const parentFeeId = `local:${clientMutationId}:fee`;
  try {
    const existing = await loadAllTimeTransactionsFlat(spaceId);
    const removed = existing.filter(
      (row) => row.id.startsWith(prefix) && row.id !== parentFeeId,
    );
    if (removed.length === 0) {
      return [];
    }

    await deleteSpaceTransactions(
      spaceId,
      removed.map((row) => row.id),
    );
    return removed;
  } catch (error) {
    console.warn(
      "[local-db] Failed to remove local series children for mutation",
      error,
    );
    return [];
  }
};

/**
 * Restore previously removed index rows (validation rollback).
 */
export const restoreLocalIndexTransactions = async (
  spaceId: string,
  transactions: IndexTransaction[],
): Promise<void> => {
  if (!spaceId || transactions.length === 0) {
    return;
  }

  try {
    await putSpaceTransactions(spaceId, transactions);
  } catch (error) {
    console.warn("[local-db] Failed to restore local transactions", error);
  }
};
