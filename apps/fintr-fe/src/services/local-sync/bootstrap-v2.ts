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
  extractAccountsFromResponse,
} from "@/services/transactions/accounts/local-cache";
import {
  getCurrentRate,
  getRecentRates,
} from "@/services/exchangeRates/queries";
import { buildCurrencyPairs } from "@/services/exchangeRates/local-db";
import {
  buildDashboardDataFromBuckets,
  cacheDashboardShell,
  cacheMonthlyFinancialSummaries,
  dashboardShellFromDashboard,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  cacheTransactionCategoriesResponse,
} from "@/services/transactions/categories/local-cache";
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
import { verifyBootstrapTotals } from "./bootstrap-v2-helpers";

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

  await cacheSpaceContext(spaceCode, { space: bundle.space as never });

  try {
    const shellDashboard = await fetchDashboardForSpace(
      params.api,
      spaceCode,
      currentMonthStart,
      currentMonthEnd,
    );
    const shell = dashboardShellFromDashboard(shellDashboard);
    await cacheDashboardShell(spaceCode, shell);
    queryClient.setQueryData(["dashboard", "shell", "local", spaceCode], shell);
    queryClient.setQueryData(["dashboard", "shell", spaceCode], shell);

    const composed = buildDashboardDataFromBuckets(
      shell,
      bundle.monthlyFinancialSummaries as never,
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
    console.warn("[sync] Bootstrap v2 dashboard shell fetch failed", error);
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

  await cacheMonthlyFinancialSummaries(
    spaceCode,
    bundle.monthlyFinancialSummaries as never,
  );
  queryClient.setQueryData(
    ["monthlyFinancialSummaries", "local", spaceCode],
    bundle.monthlyFinancialSummaries,
  );
  queryClient.setQueryData(
    ["monthlyFinancialSummaries", spaceCode],
    bundle.monthlyFinancialSummaries,
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

  const spaceCurrency =
    (bundle.space as { currency?: string }).currency ?? "PHP";
  const accountCurrencies = extractAccountsFromResponse(bundle.accounts).map(
    (account) => account.balanceCurrency,
  );
  const transactionCurrencies = transactionPages.flatMap((page) =>
    page.transactions.flatMap((transaction) => [
      transaction.amountCurrency,
      transaction.bookedAmountCurrency,
    ]),
  );
  const pairs = buildCurrencyPairs([
    spaceCurrency,
    ...accountCurrencies,
    ...transactionCurrencies.filter(
      (code): code is string => typeof code === "string" && code.length > 0,
    ),
  ]);

  for (const pair of pairs) {
    try {
      await getCurrentRate(api, pair.from, pair.to);
      await getRecentRates(api, pair.from, pair.to);
    } catch (rateError) {
      console.warn(
        "[sync] Bootstrap v2 exchange rate fetch failed",
        pair,
        rateError,
      );
    }
  }
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
  } catch (error) {
    errors.push("transactions");
    console.warn("[sync] Bootstrap v2 tier 1 failed", spaceCode, error);
    throw error;
  }

  const normalizedTransactions = normalizeBootstrapTransactions(bundle.transactions);
  const transactionPages = transactionsToPages(normalizedTransactions);

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

  return {
    latestSeq: bundle.latestSeq,
    errors,
  };
};
