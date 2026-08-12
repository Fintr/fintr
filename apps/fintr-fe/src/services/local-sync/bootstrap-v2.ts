import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { setSyncCursor } from "@/lib/local-db/sync-cursor";
import {
  isOfflineBootstrapDateRange,
} from "@/lib/local-sync/offline-bootstrap-dates";
import { markSpaceTransactionIndexComplete } from "@/lib/local-db/transactions";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import {
  cacheAccountsResponse,
} from "@/services/transactions/accounts/local-cache";
import {
  refreshSpaceExchangeRates,
} from "@/services/exchangeRates/prefetch-space-rates";
import {
  buildDashboardDataFromBuckets,
  cacheDashboardShell,
  cacheMonthlyFinancialSummaries,
  dashboardShellFromDashboard,
  ensureMonthlyFinancialSummariesCached,
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import { dashboardShellFromBootstrap } from "@/services/monthly-financial-summaries/dashboard-shell-from-bootstrap";
import {
  hydrateMonthlyFinancialSummariesFromLocalTransactions,
  summariesNeedLocalHydration,
} from "@/services/monthly-financial-summaries/hydrate-from-local-transactions";
import { filterInsightsTransactions } from "@/services/insights/filter-insights-transactions";
import {
  cacheTransactionCategoriesResponse,
} from "@/services/transactions/categories/local-cache";
import {
  cacheEntitiesResponse,
} from "@/services/entities/local-cache";
import {
  cacheTransactionTagsResponse,
  normalizeTransactionTags,
} from "@/services/transactions/tags/local-cache";
import {
  cacheLoanDetail,
  cacheLoanPayments,
  cacheLoansAllPages,
} from "@/services/loans/local-cache";
import {
  cacheBudgetsResponse,
} from "@/services/budgets/local-cache";
import {
  cacheTransferDetail,
} from "@/services/transactions/transfers/local-cache";
import {
  cacheTransactionsAllPages,
  mergeFetchedTransactionsIntoAllTimeCache,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import {
  cacheSpaceContext,
} from "@/services/spaces/spaces-list-cache";
import { cacheDashboardResponse } from "@/services/spaces/local-cache";
import { normalizeRealtimeIndexTransaction } from "@/hooks/useTransactionsRealtime";
import type { Loan, LoansPage } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import type { BootstrapV2Result, SyncBootstrapResponse } from "@/types/syncTypes";
import type {
  IndexTransaction,
  TransactionsPage,
} from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  collectPendingLocalCreateTransactions,
  defaultTransactionsQueryKey,
  fetchDashboardForSpace,
  type LocalDataBootstrapParams,
  type SyncStep,
} from "./bootstrap-local-data";
import {
  cacheTransactionDetailsFromIndexPages,
  prefetchRemoteAttachmentsForTransactions,
} from "./cache-bootstrap-details";
import {
  resolveBootstrapMonthlySummaries,
  verifyBootstrapTotals,
} from "./bootstrap-v2-helpers";

const spaceRequestConfig = (spaceCode: string) => ({
  headers: {
    "X-Space-Code": spaceCode,
  },
});

export const fetchSpaceBootstrap = async (
  api: AxiosInstance,
  spaceCode: string,
): Promise<SyncBootstrapResponse> => {
  const response = await api.get(
    "/spaces/sync/bootstrap",
    spaceRequestConfig(spaceCode),
  );

  return response.data.data as SyncBootstrapResponse;
};

const normalizeBootstrapTransactions = (
  rows: SyncBootstrapResponse["transactions"],
): IndexTransaction[] =>
  rows
    .map((row) =>
      normalizeRealtimeIndexTransaction(
        row as unknown as Record<string, unknown>,
      ),
    )
    .filter((row): row is IndexTransaction => Boolean(row));

const transactionsToPages = (
  transactions: IndexTransaction[],
): TransactionsPage[] => {
  if (transactions.length === 0) {
    return [];
  }

  return [
    {
      transactions,
      nextPage: null,
      totalPages: 1,
      totalCount: transactions.length,
    },
  ];
};

const collectTransferIds = (pages: TransactionsPage[]): string[] => {
  const ids = new Set<string>();

  for (const page of pages) {
    for (const transaction of page.transactions) {
      if (transaction.type !== CombinedTransactionTypeEnum.TRANSFER) {
        continue;
      }

      const activitableId = transaction.activitableId ?? transaction.id;
      if (activitableId) {
        ids.add(activitableId);
      }
    }
  }

  return Array.from(ids);
};

const parseBudgetMonthKey = (
  key: string,
): { startDate: string; endDate: string } | null => {
  const [startDate, endDate] = key.split("|");
  if (!startDate || !endDate) {
    return null;
  }

  return { startDate, endDate };
};

const normalizeLoanPayments = (
  loan: Loan,
): LoanPayment[] => {
  if (!Array.isArray(loan.loanPayments)) {
    return [];
  }

  return loan.loanPayments.map((payment) => ({
    id: payment.id,
    loanId: loan.id,
    accountId: "",
    accountName: "",
    date: payment.date,
    principalPayment: payment.principalPayment,
    interestPayment: payment.interestPayment,
    totalPayment: payment.totalPayment,
    currency: payment.currency,
    adjustsAccountBalance: payment.adjustsAccountBalance,
  }));
};

const applyBootstrapTier0 = async (params: {
  api: AxiosInstance;
  bundle: SyncBootstrapResponse;
  spaceCode: string;
  startDate: string;
  endDate: string;
  queryClient: QueryClient;
}): Promise<void> => {
  const { bundle, spaceCode, queryClient } = params;
  const { firstDay: currentMonthStart, lastDay: currentMonthEnd } =
    getCurrentMonthDates();
  const monthlySummaries = resolveBootstrapMonthlySummaries(bundle);

  await cacheSpaceContext(spaceCode, { space: bundle.space as never });

  const shellFromBundle = dashboardShellFromBootstrap(bundle, spaceCode);

  try {
    const shell =
      shellFromBundle ??
      dashboardShellFromDashboard(
        await fetchDashboardForSpace(
          params.api,
          spaceCode,
          currentMonthStart,
          currentMonthEnd,
        ),
      );

    await cacheDashboardShell(spaceCode, shell);
    queryClient.setQueryData(["dashboard", "shell", "local", spaceCode], shell);
    queryClient.setQueryData(["dashboard", "shell", spaceCode], shell);

    const composed = buildDashboardDataFromBuckets(
      shell,
      monthlySummaries as never,
      currentMonthStart,
      currentMonthEnd,
    );

    await cacheDashboardResponse(
      spaceCode,
      composed,
      currentMonthStart,
      currentMonthEnd,
    );
    queryClient.setQueryData(
      ["dashboard", "local", spaceCode, currentMonthStart, currentMonthEnd],
      composed,
    );
    queryClient.setQueryData(
      ["dashboard", spaceCode, currentMonthStart, currentMonthEnd],
      composed,
    );
  } catch (error) {
    console.warn("[sync] Bootstrap v2 dashboard shell build failed", error);
  }

  await cacheAccountsResponse(spaceCode, bundle.accounts);
  queryClient.setQueryData(["accounts", "local", spaceCode], bundle.accounts);
  queryClient.setQueryData(
    ["accounts", spaceCode || "default"],
    bundle.accounts,
  );

  await cacheTransactionCategoriesResponse(spaceCode, bundle.categories);
  queryClient.setQueryData(
    ["transactionCategories", "local", spaceCode],
    bundle.categories,
  );
  queryClient.setQueryData(
    ["transactionCategories", spaceCode],
    bundle.categories,
  );

  const normalizedTags = normalizeTransactionTags(bundle.tags ?? []);
  await cacheTransactionTagsResponse(spaceCode, normalizedTags);
  queryClient.setQueryData(
    ["transactionTags", "local", spaceCode],
    normalizedTags,
  );
  queryClient.setQueryData(["transactionTags", spaceCode], normalizedTags);

  await cacheEntitiesResponse(spaceCode, bundle.entities ?? []);
  queryClient.setQueryData(
    ["entities", "local", spaceCode],
    bundle.entities ?? [],
  );

  await cacheMonthlyFinancialSummaries(spaceCode, monthlySummaries);
  queryClient.setQueryData(
    ["monthlyFinancialSummaries", "local", spaceCode],
    monthlySummaries,
  );
  queryClient.setQueryData(
    ["monthlyFinancialSummaries", spaceCode],
    monthlySummaries,
  );

  const normalizedTransactions = normalizeBootstrapTransactions(bundle.transactions);
  const currentMonthRows = normalizedTransactions.filter((row) => {
    const date = row.date.slice(0, 10);
    return date >= currentMonthStart && date <= currentMonthEnd;
  });

  const { filterKey, queryKey } = defaultTransactionsQueryKey(
    spaceCode,
    params.startDate,
    params.endDate,
  );

  if (currentMonthRows.length > 0) {
    const currentMonthPages = transactionsToPages(currentMonthRows);
    await cacheTransactionsAllPages(spaceCode, filterKey, currentMonthPages);
    await mergeFetchedTransactionsIntoAllTimeCache(spaceCode, currentMonthPages);
    const seededLocal = {
      pages: currentMonthPages,
      pageParams: [1],
    };
    queryClient.setQueryData(
      ["transactions", "local", spaceCode, filterKey],
      seededLocal,
    );
    queryClient.setQueryData(queryKey, seededLocal);
  }
};

const applyBootstrapTier1 = async (params: {
  bundle: SyncBootstrapResponse;
  spaceCode: string;
  startDate: string;
  endDate: string;
  queryClient: QueryClient;
}): Promise<void> => {
  const { bundle, spaceCode, startDate, endDate } = params;
  const pendingLocalCreates = await collectPendingLocalCreateTransactions(spaceCode);
  const normalizedTransactions = normalizeBootstrapTransactions(bundle.transactions);
  const transactionPages = transactionsToPages(normalizedTransactions);
  const { filterKey, queryKey } = defaultTransactionsQueryKey(
    spaceCode,
    startDate,
    endDate,
  );

  if (transactionPages.length > 0) {
    await cacheTransactionsAllPages(spaceCode, filterKey, transactionPages);
    await mergeFetchedTransactionsIntoAllTimeCache(spaceCode, transactionPages);

    if (isOfflineBootstrapDateRange(startDate, endDate)) {
      await markSpaceTransactionIndexComplete(spaceCode);
    }

    for (const row of pendingLocalCreates) {
      await upsertLocalIndexTransaction(spaceCode, row);
    }

    const seededLocal = {
      pages: transactionPages,
      pageParams: [1],
    };
    params.queryClient.setQueryData(
      ["transactions", "local", spaceCode, filterKey],
      seededLocal,
    );
    params.queryClient.setQueryData(queryKey, seededLocal);
  }
};

const applyBootstrapTier2 = async (params: {
  api: AxiosInstance;
  bundle: SyncBootstrapResponse;
  spaceCode: string;
  queryClient: QueryClient;
  transactionPages: TransactionsPage[];
}): Promise<void> => {
  const { api, bundle, spaceCode, queryClient, transactionPages } = params;

  for (const [monthKey, budgetsPage] of Object.entries(bundle.budgetsByMonth)) {
    const range = parseBudgetMonthKey(monthKey);
    if (!range) {
      continue;
    }

    await cacheBudgetsResponse(
      spaceCode,
      range.startDate,
      range.endDate,
      budgetsPage as never,
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

  const loans = (bundle.loans ?? []) as Loan[];
  const loanPages: LoansPage[] = loans.length
    ? [
        {
          loans,
          nextPage: null,
          totalPages: 1,
          totalCount: loans.length,
        },
      ]
    : [];

  if (loanPages.length > 0) {
    await cacheLoansAllPages(spaceCode, loanPages);
    queryClient.setQueryData(["loans", "local", spaceCode], {
      pages: loanPages,
      pageParams: [1],
    });
    queryClient.setQueryData(["loans"], {
      pages: loanPages,
      pageParams: [1],
    });
  }

  for (const loan of loans) {
    await cacheLoanDetail(spaceCode, loan.id, loan);
    queryClient.setQueryData(["loanDetail", loan.id], loan);

    const payments = normalizeLoanPayments(loan);
    await cacheLoanPayments(spaceCode, loan.id, payments);
    queryClient.setQueryData(
      ["loanPayments", "local", spaceCode, loan.id],
      payments,
    );
    queryClient.setQueryData(["loanPayments", loan.id], payments);
  }

  await cacheTransactionDetailsFromIndexPages(spaceCode, transactionPages);

  const transferIds = collectTransferIds(transactionPages);
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
        "[sync] Bootstrap v2 transfer detail fetch failed",
        spaceCode,
        transferId,
        transferError,
      );
    }
  }

  const flatTransactions = transactionPages.flatMap((page) => page.transactions);
  await prefetchRemoteAttachmentsForTransactions({
    api,
    spaceId: spaceCode,
    transactions: flatTransactions,
  });

  const spaceCurrency =
    (bundle.space as { currency?: string }).currency ?? "PHP";

  await refreshSpaceExchangeRates({
    api,
    spaceCode,
    accounts: bundle.accounts,
    transactionPages,
    spaceCurrency,
    requestConfig: spaceRequestConfig(spaceCode),
    force: true,
  });
};

export const bootstrapSpaceV2 = async (
  api: AxiosInstance,
  queryClient: QueryClient,
  params: LocalDataBootstrapParams,
  options?: {
    onStep?: (step: SyncStep) => void;
    onTierReady?: (tier: 0 | 1 | 2) => void;
  },
): Promise<BootstrapV2Result> => {
  const errors: string[] = [];
  const { spaceCode, startDate, endDate } = params;

  const bundle = await fetchSpaceBootstrap(api, spaceCode);
  const monthlySummaries = resolveBootstrapMonthlySummaries(bundle);
  const normalizedBootstrapTransactions = normalizeBootstrapTransactions(
    bundle.transactions,
  );
  const bootstrapCalculatedTransactions = filterInsightsTransactions(
    normalizedBootstrapTransactions,
  );
  const spaceCurrency =
    typeof bundle.space?.currency === "string"
      ? bundle.space.currency
      : "PHP";

  await cacheMonthlyFinancialSummaries(spaceCode, monthlySummaries);

  verifyBootstrapTotals(bundle);

  options?.onStep?.("accounts");
  try {
    await applyBootstrapTier0({
      api,
      bundle,
      spaceCode,
      startDate,
      endDate,
      queryClient,
    });
    options?.onTierReady?.(0);
  } catch (error) {
    errors.push("tier-0");
    console.warn("[sync] Bootstrap v2 tier 0 failed", spaceCode, error);
    throw error;
  }

  options?.onStep?.("transactions");
  try {
    await applyBootstrapTier1({
      bundle,
      spaceCode,
      startDate,
      endDate,
      queryClient,
    });
    options?.onTierReady?.(1);

    await setSyncCursor(spaceCode, {
      lastPulledSeq: bundle.latestSeq,
      lastPulledAt: Date.now(),
    });

    const hydratedSummaries =
      await hydrateMonthlyFinancialSummariesFromLocalTransactions(spaceCode, {
        currency: spaceCurrency,
        existingSummaries: monthlySummaries,
        transactions: bootstrapCalculatedTransactions,
      });
    queryClient.setQueryData(
      ["monthlyFinancialSummaries", "local", spaceCode],
      hydratedSummaries,
    );
    queryClient.setQueryData(
      ["monthlyFinancialSummaries", spaceCode],
      hydratedSummaries,
    );
    queryClient.invalidateQueries({
      queryKey: ["insights", "local", spaceCode],
    });
  } catch (error) {
    errors.push("transactions");
    console.warn("[sync] Bootstrap v2 tier 1 failed", spaceCode, error);
    throw error;
  }

  const transactionPages = transactionsToPages(normalizedBootstrapTransactions);

  options?.onStep?.("monthly-summaries");
  options?.onStep?.("dashboard");
  options?.onStep?.("categories");
  options?.onStep?.("budgets");

  try {
    await applyBootstrapTier2({
      api,
      bundle,
      spaceCode,
      queryClient,
      transactionPages,
    });
    options?.onTierReady?.(2);
  } catch (error) {
    errors.push("tier-2");
    console.warn("[sync] Bootstrap v2 tier 2 failed", spaceCode, error);
  }

  options?.onStep?.("loans");
  options?.onStep?.("transfers");
  options?.onStep?.("exchange-rates");

  try {
    await hydrateMonthlyFinancialSummariesFromLocalTransactions(spaceCode, {
      currency: spaceCurrency,
      transactions: bootstrapCalculatedTransactions,
    });

    const summaries =
      (await loadCachedMonthlyFinancialSummaries(spaceCode)) ?? [];

    if (
      await summariesNeedLocalHydration(
        spaceCode,
        summaries,
        bootstrapCalculatedTransactions,
      )
    ) {
      const fromApi = await ensureMonthlyFinancialSummariesCached(
        api,
        spaceCode,
        { refetchWhenEmpty: true },
      );
      const rehydrated =
        await hydrateMonthlyFinancialSummariesFromLocalTransactions(spaceCode, {
          currency: spaceCurrency,
          existingSummaries: fromApi,
          transactions: bootstrapCalculatedTransactions,
        });
      queryClient.setQueryData(
        ["monthlyFinancialSummaries", "local", spaceCode],
        rehydrated,
      );
      queryClient.setQueryData(
        ["monthlyFinancialSummaries", spaceCode],
        rehydrated,
      );
    } else {
      queryClient.setQueryData(
        ["monthlyFinancialSummaries", "local", spaceCode],
        summaries,
      );
      queryClient.setQueryData(
        ["monthlyFinancialSummaries", spaceCode],
        summaries,
      );
    }

    queryClient.invalidateQueries({
      queryKey: ["insights", "local", spaceCode],
    });
  } catch (error) {
    console.warn(
      "[sync] Bootstrap v2 monthly summaries ensure failed",
      spaceCode,
      error,
    );
  }

  return {
    latestSeq: bundle.latestSeq,
    errors,
  };
};
