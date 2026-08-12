import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  listPendingOutboxOrdered,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
} from "@/lib/local-db/outbox";
import {
  getOfflineSyncMeta,
  getUnsyncedSpaceCodes,
  markOfflineSyncComplete,
} from "@/lib/local-db/sync-state";
import {
  monthRangesForOfflineHydration,
  offlineBootstrapDateRange,
  isOfflineBootstrapDateRange,
} from "@/lib/local-sync/offline-bootstrap-dates";
import {
  isSpaceTransactionIndexComplete,
  markSpaceTransactionIndexComplete,
} from "@/lib/local-db/transactions";
import { drainAllOutboxes } from "@/services/local-sync/drain-outbox";
import { putLocalResponseSnapshot } from "@/lib/local-db/response-cache";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import {
  cacheAccountsResponse,
  loadCachedAccountsResponse,
} from "@/services/transactions/accounts/local-cache";
import {
  cacheDashboardResponse,
  loadCachedDashboardResponse,
} from "@/services/spaces/local-cache";
import { fetchMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/queries";
import {
  buildDashboardDataFromBuckets,
  cacheDashboardShell,
  cacheMonthlyFinancialSummaries,
  dashboardShellFromDashboard,
  loadCachedDashboardShell,
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import { fetchTransactionsPage } from "@/services/transactions/queries";
import {
  cacheTransactionCategoriesResponse,
  loadCachedTransactionCategoriesResponse,
} from "@/services/transactions/categories/local-cache";
import {
  cacheEntitiesResponse,
  loadCachedEntitiesResponse,
} from "@/services/entities/local-cache";
import {
  cacheTransactionTagsResponse,
  loadCachedTransactionTagsResponse,
} from "@/services/transactions/tags/local-cache";
import { fetchTransactionTags } from "@/services/transactions/tags/mutation";
import { fetchEntities } from "@/services/entities/mutation";
import {
  refreshSpaceExchangeRates,
  refreshSpaceExchangeRatesFromCache,
} from "@/services/exchangeRates/prefetch-space-rates";
import { fetchLoansPage, fetchLoanById } from "@/services/loans/queries";
import { fetchLoanPayments } from "@/services/loans/payments";
import {
  cacheLoanDetail,
  cacheLoanPayments,
  cacheLoansAllPages,
  loadCachedLoansInfiniteData,
} from "@/services/loans/local-cache";
import { fetchBudgetsPage } from "@/services/budgets/queries";
import {
  cacheBudgetsResponse,
  loadCachedBudgetsResponse,
} from "@/services/budgets/local-cache";
import {
  cacheTransferDetail,
} from "@/services/transactions/transfers/local-cache";
import {
  buildTransactionsFilterKey,
  cacheTransactionsAllPages,
  loadCachedTransactionsInfiniteData,
  loadLocalIndexTransactionById,
  mergeFetchedTransactionsIntoAllTimeCache,
  migrateLegacyTransactionSnapshotsIfNeeded,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import {
  buildTransactionsInfiniteQueryKey,
} from "@/services/transactions/query-keys";
import {
  cacheSpaceContext,
  cacheSpacesList,
  loadCachedSpaceContext,
  loadCachedSpacesList,
} from "@/services/spaces/spaces-list-cache";
import { spacesApi } from "@/services/spaces/api";
import { cacheCurrentUserResponse, loadCachedCurrentUserResponse } from "@/services/auth/local-cache";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { DashboardData } from "@/types/spaceTypes";
import type { Space } from "@/types/spaceTypes";
import type {
  IndexTransaction,
  TransactionsPage,
} from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { LoansPage } from "@/services/loans/queries";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";

export type LocalDataBootstrapParams = {
  spaceCode: string;
  startDate: string;
  endDate: string;
};

export type OfflineSyncPhase =
  | "preparing"
  | "listing-spaces"
  | "syncing-space"
  | "complete"
  | "error";

export type OfflineSyncProgress = {
  phase: OfflineSyncPhase;
  overallProgress: number;
  completedSpaces: number;
  totalSpaces: number;
  currentSpaceName?: string;
  currentSpaceCode?: string;
  currentStep?:
    | "dashboard"
    | "monthly-summaries"
    | "accounts"
    | "transactions"
    | "loans"
    | "categories"
    | "budgets"
    | "transfers"
    | "exchange-rates";
  spaceProgress: number;
  detailMessage: string;
};

export type OfflineSyncProgressHandler = (
  progress: OfflineSyncProgress,
) => void;

const bootstrapMetaKey = (spaceCode: string): string =>
  `bootstrapSyncedAt:${spaceCode}`;

const spaceRequestConfig = (spaceCode: string) => ({
  headers: {
    "X-Space-Code": spaceCode,
  },
});

export const collectPendingLocalCreateTransactions = async (
  spaceCode: string,
): Promise<IndexTransaction[]> => {
  const pending = await listPendingOutboxOrdered({ spaceId: spaceCode });
  const localIds = pending
    .filter((row) => row.commandType === OUTBOX_COMMAND_TRANSACTION_CREATE)
    .map((row) => `local:${row.clientMutationId}`);

  const preserved: IndexTransaction[] = [];
  for (const id of localIds) {
    const row = await loadLocalIndexTransactionById(spaceCode, id);
    if (row) {
      preserved.push(row);
    }
  }
  return preserved;
};

const invalidateOfflineReadQueries = (
  queryClient: QueryClient,
  spaceCode: string,
): void => {
  queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key)) return false;
      const root = key[0];
      if (
        root !== "transactions" &&
        root !== "dashboard" &&
        root !== "accounts" &&
        root !== "monthlyFinancialSummaries" &&
        root !== "insights" &&
        root !== "budgets" &&
        root !== "accountDetailActivities"
      ) {
        return false;
      }
      return key.includes(spaceCode);
    },
  });
};

/**
 * While online (after the offline-ready gate), push outbox then pull the active
 * workspace from the server into IndexedDB and refresh React Query.
 * Does not show the blocking sync screen — peers see each other's creates on reload.
 *
 * `startDate` / `endDate` are the **UI** month range. Peer refresh must use that
 * window — not the all-time bootstrap range — or every load re-paginates years of
 * `/transactions` history and looks like a half-second poll loop.
 */
export const refreshOnlineLocalCaches = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  params: LocalDataBootstrapParams,
): Promise<void> => {
  const { spaceCode, startDate, endDate } = params;
  if (!spaceCode) return;

  await drainAllOutboxes({ api, spaceIds: [spaceCode] });

  void refreshSpaceExchangeRatesFromCache(api, spaceCode, { force: false }).catch(
    (error) => {
      console.warn("[exchange-rates] Online refresh failed", spaceCode, error);
    },
  );

  if (isSpaceSyncPullEnabled()) {
    return;
  }

  void ensureSpaceTransactionIndex(api, spaceCode).catch((error) => {
    console.warn("[local-sync] Background transaction index hydration failed", error);
  });

  await syncLocalDataFromBackend(api, queryClient, {
    spaceCode,
    startDate,
    endDate,
  });

  await seedReactQueryFromLocalCache(queryClient, {
    spaceCode,
    startDate,
    endDate,
  });

  // UI infinite queries use month ranges + a "local" key suffix — invalidate so
  // they re-read the refreshed IndexedDB snapshot / refetch peer changes.
  invalidateOfflineReadQueries(queryClient, spaceCode);
};

export const defaultTransactionsQueryKey = (
  spaceCode: string,
  startDate: string,
  endDate: string,
) => {
  const categoriesSerialized = serializeFilterValues([]);
  const accountNamesSerialized = serializeFilterValues([]);
  const tagIdsSerialized = serializeFilterValues([]);

  return {
    categoriesSerialized,
    accountNamesSerialized,
    filterKey: buildTransactionsFilterKey({
      categoriesSerialized,
      startDate,
      endDate,
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized,
      tagIdsSerialized,
      entryType: "all",
    }),
    queryKey: buildTransactionsInfiniteQueryKey({
      spaceCode,
      categoriesSerialized,
      startDate,
      endDate,
      accountNamesSerialized,
      tagIdsSerialized,
      entryType: "all",
      mode: "local",
    }),
  };
};

export const fetchDashboardForSpace = async (
  api: AxiosInstance,
  spaceCode: string,
  startDate: string,
  endDate: string,
): Promise<DashboardData> => {
  const params: { start_date?: string; end_date?: string } = {};
  if (startDate) {
    params.start_date = startDate;
  }
  if (endDate) {
    params.end_date = endDate;
  }

  const response = await api.get(`/dashboard`, {
    params,
    ...spaceRequestConfig(spaceCode),
  });

  return response.data.data.dashboard;
};

const fetchAccountsForSpace = async (
  api: AxiosInstance,
  spaceCode: string,
): Promise<unknown> => {
  const response = await api.get("/transactions/accounts", spaceRequestConfig(spaceCode));
  return response.data;
};

const fetchAllLoansPagesForSpace = async (
  api: AxiosInstance,
  spaceCode: string,
): Promise<LoansPage[]> => {
  const pages: LoansPage[] = [];
  let pageParam = 1;

  while (true) {
    const page = await fetchLoansPage(api, {
      pageParam,
      requestConfig: spaceRequestConfig(spaceCode),
    });

    pages.push(page);

    if (!page.nextPage) {
      break;
    }

    pageParam = page.nextPage;
  }

  return pages;
};

const collectTransferIds = (pages: TransactionsPage[]): string[] => {
  const ids = new Set<string>();

  for (const page of pages) {
    for (const transaction of page.transactions) {
      if (
        transaction.type === CombinedTransactionTypeEnum.TRANSFER &&
        transaction.activitableId
      ) {
        ids.add(transaction.activitableId);
      }
    }
  }

  return Array.from(ids);
};

const SYNC_STEPS = [
  "accounts",
  "transactions",
  "monthly-summaries",
  "dashboard",
  "budgets",
  "loans",
  "categories",
  "transfers",
  "exchange-rates",
] as const;

export type SyncStep = (typeof SYNC_STEPS)[number];

const MAX_TRANSACTION_BOOTSTRAP_PAGES = 100;

const fetchAllTransactionPagesForSpace = async (
  api: AxiosInstance,
  spaceCode: string,
  queryKey: readonly unknown[],
): Promise<TransactionsPage[]> => {
  const pages: TransactionsPage[] = [];
  let pageParam = 1;

  while (pages.length < MAX_TRANSACTION_BOOTSTRAP_PAGES) {
    const page = await fetchTransactionsPage(api, {
      pageParam,
      queryKey,
      requestConfig: spaceRequestConfig(spaceCode),
    });

    pages.push(page);

    if (!page.nextPage || page.nextPage === pageParam) {
      break;
    }

    pageParam = page.nextPage;
  }

  if (pages.length >= MAX_TRANSACTION_BOOTSTRAP_PAGES) {
    console.warn(
      "[local-sync] Stopped transaction pagination at page cap",
      MAX_TRANSACTION_BOOTSTRAP_PAGES,
      spaceCode,
    );
  }

  return pages;
};

/**
 * Background hydration: pull full transaction history into the local IndexedDB
 * index when it has never been completed for this workspace. Users should never
 * need to browse the Transactions tab first to unlock offline insights.
 */
export const ensureSpaceTransactionIndex = async (
  api: AxiosInstance,
  spaceCode: string,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  if (isSpaceSyncPullEnabled()) {
    return;
  }

  await migrateLegacyTransactionSnapshotsIfNeeded(spaceCode);

  if (await isSpaceTransactionIndexComplete(spaceCode)) {
    return;
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }

  const bootstrapRange = offlineBootstrapDateRange();
  const { queryKey } = defaultTransactionsQueryKey(
    spaceCode,
    bootstrapRange.startDate,
    bootstrapRange.endDate,
  );

  const pages = await fetchAllTransactionPagesForSpace(
    api,
    spaceCode,
    queryKey,
  );

  if (pages.length > 0) {
    await mergeFetchedTransactionsIntoAllTimeCache(spaceCode, pages);
  }

  await markSpaceTransactionIndexComplete(spaceCode);
};

export const seedReactQueryFromLocalCache = async (
  queryClient: QueryClient,
  params: LocalDataBootstrapParams,
): Promise<boolean> => {
  const { spaceCode, startDate, endDate } = params;
  let seededAny = false;

  const cachedDashboard = await loadCachedDashboardResponse(
    spaceCode,
    startDate,
    endDate,
  );
  if (cachedDashboard) {
    queryClient.setQueryData(
      ["dashboard", "local", spaceCode, startDate, endDate],
      cachedDashboard,
    );
    queryClient.setQueryData(
      ["dashboard", spaceCode, startDate, endDate],
      cachedDashboard,
    );
    seededAny = true;
  }

  const cachedAccounts = await loadCachedAccountsResponse(spaceCode);
  if (cachedAccounts != null) {
    queryClient.setQueryData(["accounts", "local", spaceCode], cachedAccounts);
    queryClient.setQueryData(
      ["accounts", spaceCode || "default"],
      cachedAccounts,
    );
    seededAny = true;
  }

  const { filterKey, queryKey } = defaultTransactionsQueryKey(
    spaceCode,
    startDate,
    endDate,
  );
  const cachedTransactions = await loadCachedTransactionsInfiniteData(
    spaceCode,
    filterKey,
  );
  if (cachedTransactions) {
    queryClient.setQueryData(
      ["transactions", "local", spaceCode, filterKey],
      cachedTransactions,
    );
    queryClient.setQueryData(queryKey, cachedTransactions);
    seededAny = true;
  }

  const cachedSpaces = await loadCachedSpacesList();
  if (cachedSpaces?.length) {
    queryClient.setQueryData(["spaces", "local"], cachedSpaces);
    queryClient.setQueryData(["spaces"], cachedSpaces);
    seededAny = true;
  }

  const cachedCurrentUser = await loadCachedCurrentUserResponse();
  if (cachedCurrentUser) {
    queryClient.setQueryData(["currentUser", "local"], cachedCurrentUser);
    queryClient.setQueryData(["currentUser"], cachedCurrentUser);
    seededAny = true;
  }

  const cachedSpaceContext = await loadCachedSpaceContext(spaceCode);
  if (cachedSpaceContext) {
    queryClient.setQueryData(
      ["space-context", "local", spaceCode],
      cachedSpaceContext,
    );
    queryClient.setQueryData(
      ["space-context", spaceCode],
      cachedSpaceContext,
    );
    seededAny = true;
  }

  const cachedLoans = await loadCachedLoansInfiniteData(spaceCode);
  if (cachedLoans) {
    queryClient.setQueryData(["loans", "local", spaceCode], cachedLoans);
    queryClient.setQueryData(["loans"], cachedLoans);
    seededAny = true;
  }

  const cachedCategories = await loadCachedTransactionCategoriesResponse(spaceCode);
  if (cachedCategories) {
    queryClient.setQueryData(
      ["transactionCategories", "local", spaceCode],
      cachedCategories,
    );
    queryClient.setQueryData(
      ["transactionCategories", spaceCode],
      cachedCategories,
    );
    seededAny = true;
  }

  const cachedTags = await loadCachedTransactionTagsResponse(spaceCode);
  if (cachedTags) {
    queryClient.setQueryData(
      ["transactionTags", "local", spaceCode],
      cachedTags,
    );
    queryClient.setQueryData(["transactionTags", spaceCode], cachedTags);
    seededAny = true;
  }

  const cachedEntities = await loadCachedEntitiesResponse(spaceCode);
  if (cachedEntities) {
    queryClient.setQueryData(
      ["entities", "local", spaceCode],
      cachedEntities,
    );
    seededAny = true;
  }

  const cachedBudgets = await loadCachedBudgetsResponse(
    spaceCode,
    startDate,
    endDate,
  );
  if (cachedBudgets) {
    queryClient.setQueryData(
      ["budgets", "local", spaceCode, startDate, endDate],
      cachedBudgets,
    );
    queryClient.setQueryData(
      ["budgets", spaceCode, startDate, endDate],
      cachedBudgets,
    );
    seededAny = true;
  }

  const cachedSummaries = await loadCachedMonthlyFinancialSummaries(spaceCode);
  if (cachedSummaries) {
    queryClient.setQueryData(
      ["monthlyFinancialSummaries", "local", spaceCode],
      cachedSummaries,
    );
    queryClient.setQueryData(
      ["monthlyFinancialSummaries", spaceCode],
      cachedSummaries,
    );
    seededAny = true;
  }

  const cachedShell = await loadCachedDashboardShell(spaceCode);
  if (cachedShell) {
    queryClient.setQueryData(
      ["dashboard", "shell", "local", spaceCode],
      cachedShell,
    );
    queryClient.setQueryData(["dashboard", "shell", spaceCode], cachedShell);
    seededAny = true;
  }

  return seededAny;
};

type BootstrapNetworkResult = {
  dashboard: DashboardData | null;
  accounts: unknown | null;
  transactions: TransactionsPage | null;
  transactionPages: TransactionsPage[];
  errors: string[];
};

export const syncLocalDataFromBackend = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  params: LocalDataBootstrapParams,
  options?: {
    onStep?: (step: SyncStep) => void;
    onTierReady?: (tier: 0 | 1 | 2) => void;
  },
): Promise<BootstrapNetworkResult> => {
  if (isSpaceSyncPullEnabled()) {
    const { bootstrapSpaceV2 } = await import("./bootstrap-v2");
    const v2Result = await bootstrapSpaceV2(api, queryClient, params, {
      onStep: options?.onStep,
      onTierReady: options?.onTierReady,
    });

    return {
      dashboard: null,
      accounts: null,
      transactions: null,
      transactionPages: [],
      errors: v2Result.errors,
    };
  }

  return syncLocalDataFromBackendV1(api, queryClient, params, options);
};

const syncLocalDataFromBackendV1 = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  params: LocalDataBootstrapParams,
  options?: {
    onStep?: (step: SyncStep) => void;
  },
): Promise<BootstrapNetworkResult> => {
  const { spaceCode, startDate, endDate } = params;
  const { filterKey, queryKey } = defaultTransactionsQueryKey(
    spaceCode,
    startDate,
    endDate,
  );

  const result: BootstrapNetworkResult = {
    dashboard: null,
    accounts: null,
    transactions: null,
    transactionPages: [],
    errors: [],
  };

  try {
    const spaceContextResponse = await spacesApi.getSpace(api, spaceCode);
    await cacheSpaceContext(
      spaceCode,
      spaceContextResponse.data.data.space,
    );
  } catch (error) {
    result.errors.push("space-context");
    console.warn(
      "[local-sync] Space context bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("accounts");
  try {
    result.accounts = await fetchAccountsForSpace(api, spaceCode);
    await cacheAccountsResponse(spaceCode, result.accounts);
    queryClient.setQueryData(
      ["accounts", "local", spaceCode],
      result.accounts,
    );
    queryClient.setQueryData(
      ["accounts", spaceCode || "default"],
      result.accounts,
    );
  } catch (error) {
    result.errors.push("accounts");
    console.warn(
      "[local-sync] Accounts bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("transactions");
  try {
    // Keep never-synced creates across a full replace from the server.
    const pendingLocalCreates =
      await collectPendingLocalCreateTransactions(spaceCode);

    result.transactionPages = await fetchAllTransactionPagesForSpace(
      api,
      spaceCode,
      queryKey,
    );
    result.transactions = result.transactionPages[0] ?? null;

    if (result.transactions) {
      await cacheTransactionsAllPages(
        spaceCode,
        filterKey,
        result.transactionPages,
      );
      await mergeFetchedTransactionsIntoAllTimeCache(
        spaceCode,
        result.transactionPages,
      );

      if (isOfflineBootstrapDateRange(startDate, endDate)) {
        await markSpaceTransactionIndexComplete(spaceCode);
      }

      for (const row of pendingLocalCreates) {
        await upsertLocalIndexTransaction(spaceCode, row);
      }

      // Seed only the first UI page — scroll loads more from IndexedDB.
      const seededLocal = await loadCachedTransactionsInfiniteData(
        spaceCode,
        filterKey,
      );
      if (seededLocal) {
        queryClient.setQueryData(
          ["transactions", "local", spaceCode, filterKey],
          seededLocal,
        );
        queryClient.setQueryData(queryKey, seededLocal);
      }
    }
  } catch (error) {
    result.errors.push("transactions");
    console.warn(
      "[local-sync] Transactions bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  const monthRanges = monthRangesForOfflineHydration(result.transactionPages);
  const { firstDay: currentMonthStart, lastDay: currentMonthEnd } =
    getCurrentMonthDates();

  let syncedSummaries: Awaited<
    ReturnType<typeof fetchMonthlyFinancialSummaries>
  > = [];

  options?.onStep?.("monthly-summaries");
  try {
    syncedSummaries = await fetchMonthlyFinancialSummaries(api, {
      requestConfig: spaceRequestConfig(spaceCode),
    });
    await cacheMonthlyFinancialSummaries(spaceCode, syncedSummaries);
    queryClient.setQueryData(
      ["monthlyFinancialSummaries", "local", spaceCode],
      syncedSummaries,
    );
    queryClient.setQueryData(
      ["monthlyFinancialSummaries", spaceCode],
      syncedSummaries,
    );
  } catch (error) {
    result.errors.push("monthly-summaries");
    console.warn(
      "[local-sync] Monthly financial summaries bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("dashboard");
  try {
    // One dashboard fetch for category/account shell; financial totals come from
    // monthly summary buckets combined client-side for any month range.
    const shellDashboard = await fetchDashboardForSpace(
      api,
      spaceCode,
      currentMonthStart,
      currentMonthEnd,
    );
    const shell = dashboardShellFromDashboard(shellDashboard);
    await cacheDashboardShell(spaceCode, shell);
    queryClient.setQueryData(
      ["dashboard", "shell", "local", spaceCode],
      shell,
    );
    queryClient.setQueryData(["dashboard", "shell", spaceCode], shell);

    for (const range of monthRanges) {
      const composed = buildDashboardDataFromBuckets(
        shell,
        syncedSummaries,
        range.startDate,
        range.endDate,
      );

      await cacheDashboardResponse(
        spaceCode,
        composed,
        range.startDate,
        range.endDate,
      );
      queryClient.setQueryData(
        ["dashboard", "local", spaceCode, range.startDate, range.endDate],
        composed,
      );
      queryClient.setQueryData(
        ["dashboard", spaceCode, range.startDate, range.endDate],
        composed,
      );

      if (
        range.startDate === currentMonthStart &&
        range.endDate === currentMonthEnd
      ) {
        result.dashboard = composed;
      }
    }

    if (!result.dashboard) {
      result.dashboard = buildDashboardDataFromBuckets(
        shell,
        syncedSummaries,
        currentMonthStart,
        currentMonthEnd,
      );
      await cacheDashboardResponse(
        spaceCode,
        result.dashboard,
        currentMonthStart,
        currentMonthEnd,
      );
      queryClient.setQueryData(
        ["dashboard", "local", spaceCode, currentMonthStart, currentMonthEnd],
        result.dashboard,
      );
      queryClient.setQueryData(
        ["dashboard", spaceCode, currentMonthStart, currentMonthEnd],
        result.dashboard,
      );
    }
  } catch (error) {
    result.errors.push("dashboard");
    console.warn(
      "[local-sync] Dashboard shell bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("budgets");
  try {
    for (const range of monthRanges) {
      const budgetsPage = await fetchBudgetsPage(api, {
        pageParam: 1,
        queryKey: ["budgets", spaceCode, range.startDate, range.endDate],
        requestConfig: spaceRequestConfig(spaceCode),
      });
      await cacheBudgetsResponse(
        spaceCode,
        range.startDate,
        range.endDate,
        budgetsPage,
      );
      queryClient.setQueryData(
        ["budgets", "local", spaceCode, range.startDate, range.endDate],
        budgetsPage,
      );
      queryClient.setQueryData(
        ["budgets", spaceCode, range.startDate, range.endDate],
        budgetsPage,
      );
    }
  } catch (error) {
    result.errors.push("budgets");
    console.warn(
      "[local-sync] Budgets month bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("loans");
  try {
    const loanPages = await fetchAllLoansPagesForSpace(api, spaceCode);
    await cacheLoansAllPages(spaceCode, loanPages);
    queryClient.setQueryData(["loans", "local", spaceCode], {
      pages: loanPages,
      pageParams: loanPages.map((_, index) => index + 1),
    });
    queryClient.setQueryData(["loans"], {
      pages: loanPages,
      pageParams: loanPages.map((_, index) => index + 1),
    });

    for (const page of loanPages) {
      for (const loan of page.loans) {
        try {
          const loanDetail = await fetchLoanById(
            api,
            loan.id,
            spaceRequestConfig(spaceCode),
          );
          await cacheLoanDetail(spaceCode, loan.id, loanDetail);
          queryClient.setQueryData(
            ["loanDetail", loan.id],
            loanDetail,
          );

          try {
            const loanPayments = await fetchLoanPayments(
              api,
              loan.id,
            );
            await cacheLoanPayments(spaceCode, loan.id, loanPayments);
            queryClient.setQueryData(
              ["loanPayments", "local", spaceCode, loan.id],
              loanPayments,
            );
            queryClient.setQueryData(
              ["loanPayments", loan.id],
              loanPayments,
            );
          } catch (paymentsError) {
            console.warn(
              "[local-sync] Loan payments bootstrap fetch failed",
              spaceCode,
              loan.id,
              paymentsError,
            );
          }
        } catch (loanError) {
          console.warn(
            "[local-sync] Loan detail bootstrap fetch failed",
            spaceCode,
            loan.id,
            loanError,
          );
        }
      }
    }
  } catch (error) {
    result.errors.push("loans");
    console.warn(
      "[local-sync] Loans bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("categories");
  try {
    const categoriesResponse = await api.get(
      "/transactions/categories",
      spaceRequestConfig(spaceCode),
    );
    await cacheTransactionCategoriesResponse(
      spaceCode,
      categoriesResponse.data,
    );
    queryClient.setQueryData(
      ["transactionCategories", "local", spaceCode],
      categoriesResponse.data,
    );
    queryClient.setQueryData(
      ["transactionCategories", spaceCode],
      categoriesResponse.data,
    );
  } catch (error) {
    result.errors.push("categories");
    console.warn(
      "[local-sync] Categories bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  try {
    const tags = await fetchTransactionTags(api);
    await cacheTransactionTagsResponse(spaceCode, tags);
    queryClient.setQueryData(["transactionTags", "local", spaceCode], tags);
    queryClient.setQueryData(["transactionTags", spaceCode], tags);
  } catch (error) {
    result.errors.push("tags");
    console.warn(
      "[local-sync] Tags bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  try {
    const merchantsResponse = await fetchEntities(api, { entityType: "transaction" });
    const loanContactsResponse = await fetchEntities(api, { entityType: "loan" });
    const allEntities = [
      ...(merchantsResponse?.data ?? []),
      ...(loanContactsResponse?.data ?? []),
    ];
    await cacheEntitiesResponse(spaceCode, allEntities);
    queryClient.setQueryData(["entities", "local", spaceCode], allEntities);
  } catch (error) {
    result.errors.push("entities");
    console.warn(
      "[local-sync] Entities bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("transfers");
  try {
    const transferIds = collectTransferIds(result.transactionPages);

    for (const transferId of transferIds) {
      try {
        const transferResponse = await api.get(
          `/transactions/transfers/${transferId}`,
          spaceRequestConfig(spaceCode),
        );
        await cacheTransferDetail(
          spaceCode,
          transferId,
          transferResponse.data.data,
        );
      } catch (transferError) {
        console.warn(
          "[local-sync] Transfer detail bootstrap fetch failed",
          spaceCode,
          transferId,
          transferError,
        );
      }
    }
  } catch (error) {
    result.errors.push("transfers");
    console.warn(
      "[local-sync] Transfers bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  options?.onStep?.("exchange-rates");
  try {
    await refreshSpaceExchangeRates({
      api,
      spaceCode,
      accounts: result.accounts ?? { accounts: [] },
      transactionPages: result.transactionPages,
      requestConfig: spaceRequestConfig(spaceCode),
      force: true,
    });
  } catch (error) {
    result.errors.push("exchange-rates");
    console.warn(
      "[local-sync] Exchange rates bootstrap fetch failed",
      spaceCode,
      error,
    );
  }

  if (
    result.dashboard ||
    result.accounts ||
    result.transactions
  ) {
    await putLocalResponseSnapshot(bootstrapMetaKey(spaceCode), Date.now());
  }

  return result;
};

export const bootstrapLocalData = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  params: LocalDataBootstrapParams,
): Promise<BootstrapNetworkResult> => {
  await seedReactQueryFromLocalCache(queryClient, params);
  return syncLocalDataFromBackend(api, queryClient, params);
};

const reportProgress = (
  onProgress: OfflineSyncProgressHandler | undefined,
  progress: OfflineSyncProgress,
) => {
  onProgress?.(progress);
};

export type SyncAllWorkspacesResult = {
  spaces: Space[];
  syncedSpaceCodes: string[];
  failedSpaceCodes: string[];
};

export const syncAllWorkspacesLocalData = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  params: Pick<LocalDataBootstrapParams, "startDate" | "endDate">,
  options?: {
    activeSpaceCode?: string;
    /** When set, only these workspace codes are synced (still refreshes the full spaces list). */
    onlySpaceCodes?: string[];
    onProgress?: OfflineSyncProgressHandler;
    onTierReady?: (tier: 0 | 1 | 2) => void;
  },
): Promise<SyncAllWorkspacesResult> => {
  const { startDate, endDate } = params;
  const { activeSpaceCode, onlySpaceCodes, onProgress, onTierReady } = options ?? {};

  reportProgress(onProgress, {
    phase: "preparing",
    overallProgress: 0,
    completedSpaces: 0,
    totalSpaces: 0,
    spaceProgress: 0,
    detailMessage: "Preparing offline sync…",
  });

  reportProgress(onProgress, {
    phase: "listing-spaces",
    overallProgress: 2,
    completedSpaces: 0,
    totalSpaces: 0,
    spaceProgress: 0,
    detailMessage: "Finding your workspaces…",
  });

  try {
    const currentUserResponse = await api.get("/auth/private");
    await cacheCurrentUserResponse(currentUserResponse.data);
  } catch (error) {
    console.warn("[local-sync] Current user bootstrap fetch failed", error);
  }

  const spacesResponse = await spacesApi.getSpaces(api);
  const spaces = spacesResponse.data.data.spaces ?? [];
  await cacheSpacesList(spaces);

  const onlySet =
    onlySpaceCodes && onlySpaceCodes.length > 0
      ? new Set(onlySpaceCodes)
      : null;
  const spacesToSync = onlySet
    ? spaces.filter((space) => onlySet.has(space.code))
    : spaces;

  if (spacesToSync.length === 0) {
    reportProgress(onProgress, {
      phase: "complete",
      overallProgress: 100,
      completedSpaces: 0,
      totalSpaces: 0,
      spaceProgress: 100,
      detailMessage: onlySet
        ? "No new workspaces to sync."
        : "No workspaces to sync.",
    });

    return {
      spaces,
      syncedSpaceCodes: [],
      failedSpaceCodes: [],
    };
  }

  const syncedSpaceCodes: string[] = [];
  const failedSpaceCodes: string[] = [];

  for (let index = 0; index < spacesToSync.length; index += 1) {
    const space = spacesToSync[index];
    const spaceBaseProgress = (index / spacesToSync.length) * 100;
    const spaceSlice = 100 / spacesToSync.length;

    reportProgress(onProgress, {
      phase: "syncing-space",
      overallProgress: Math.round(spaceBaseProgress),
      completedSpaces: index,
      totalSpaces: spacesToSync.length,
      currentSpaceName: space.name,
      currentSpaceCode: space.code,
      spaceProgress: 0,
      detailMessage: `Syncing ${space.name}…`,
    });

    const spaceParams: LocalDataBootstrapParams = {
      spaceCode: space.code,
      startDate,
      endDate,
    };

    if (activeSpaceCode && space.code === activeSpaceCode) {
      await seedReactQueryFromLocalCache(queryClient, spaceParams);
    }

    const stepProgress = (step: SyncStep) => {
      const stepIndex = SYNC_STEPS.indexOf(step);
      const withinSpace = ((stepIndex + 1) / SYNC_STEPS.length) * 100;

      reportProgress(onProgress, {
        phase: "syncing-space",
        overallProgress: Math.round(spaceBaseProgress + (withinSpace / 100) * spaceSlice),
        completedSpaces: index,
        totalSpaces: spacesToSync.length,
        currentSpaceName: space.name,
        currentSpaceCode: space.code,
        currentStep: step,
        spaceProgress: Math.round(withinSpace),
        detailMessage: `Syncing ${space.name} — ${step}…`,
      });
    };

    try {
      const outcome = await syncLocalDataFromBackend(
        api,
        queryClient,
        spaceParams,
        { onStep: stepProgress, onTierReady },
      );

      const coreFailures = isSpaceSyncPullEnabled()
        ? outcome.errors.includes("tier-0")
        : ["dashboard", "accounts", "transactions"].every((step) =>
            outcome.errors.includes(step),
          );

      if (coreFailures) {
        failedSpaceCodes.push(space.code);
      } else {
        syncedSpaceCodes.push(space.code);
      }
    } catch (error) {
      failedSpaceCodes.push(space.code);
      console.warn("[local-sync] Workspace sync failed", space.code, error);
    }
  }

  // Only mark successfully synced workspaces so failed / new grants retry later.
  if (syncedSpaceCodes.length > 0) {
    await markOfflineSyncComplete(syncedSpaceCodes);
  }

  reportProgress(onProgress, {
    phase: "complete",
    overallProgress: 100,
    completedSpaces: spacesToSync.length,
    totalSpaces: spacesToSync.length,
    spaceProgress: 100,
    detailMessage: "Offline sync complete.",
  });

  return {
    spaces,
    syncedSpaceCodes,
    failedSpaceCodes,
  };
};

/**
 * Refresh the spaces membership list and offline-sync any newly accessible workspaces
 * (e.g. after being granted access to another space).
 */
export const syncNewlyAccessibleWorkspaces = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  params: Pick<LocalDataBootstrapParams, "startDate" | "endDate">,
  options?: {
    activeSpaceCode?: string;
    onProgress?: OfflineSyncProgressHandler;
  },
): Promise<SyncAllWorkspacesResult | null> => {
  const spacesResponse = await spacesApi.getSpaces(api);
  const spaces = spacesResponse.data.data.spaces ?? [];
  await cacheSpacesList(spaces);
  queryClient.setQueryData(["spaces"], spaces);
  queryClient.setQueryData(["spaces", "local"], spaces);

  const unsynced = await getUnsyncedSpaceCodes(spaces.map((space) => space.code));
  if (unsynced.length === 0) {
    return null;
  }

  return syncAllWorkspacesLocalData(api, queryClient, params, {
    activeSpaceCode: options?.activeSpaceCode,
    onlySpaceCodes: unsynced,
    onProgress: options?.onProgress,
  });
};

export const seedAllWorkspacesFromLocalCache = async (
  queryClient: QueryClient,
  params: Pick<LocalDataBootstrapParams, "startDate" | "endDate">,
): Promise<void> => {
  const meta = await getOfflineSyncMeta();
  if (!meta?.spaceCodes?.length) {
    return;
  }

  await Promise.all(
    meta.spaceCodes.map((spaceCode) =>
      seedReactQueryFromLocalCache(queryClient, {
        spaceCode,
        startDate: params.startDate,
        endDate: params.endDate,
      }),
    ),
  );
};
