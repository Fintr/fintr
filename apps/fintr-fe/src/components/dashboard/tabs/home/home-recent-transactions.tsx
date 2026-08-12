"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { requestOpenTransaction } from "@/lib/open-transaction-request";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";
import { defaultTransactionsQueryKey } from "@/services/local-sync/bootstrap-local-data";
import {
  compareTransactionsNewestFirst,
  loadCachedTransactionsInRange,
} from "@/services/transactions/local-cache";
import { buildRecentTransactionsList } from "@/services/transactions/recent-transactions-list";
import { fetchTransactionsPage } from "@/services/transactions/queries";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  activityCategoryLine,
  activityPresentsAsIncome,
  activityPresentsAsTransfer,
} from "@/utils/activityDisplay";
import {
  formatIndexTransactionListAmount,
  indexTransactionDisplayMoney,
} from "@/utils/indexTransactionDisplay";
import { formatTransactionRowDate } from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import { HomeSection } from "@/components/dashboard/tabs/home/home-section";
import { TransactionRowTypeIcon } from "@/components/dashboard/tabs/transactions/transaction-row-type-icon";

const RECENT_LIMIT = 5;

type HomeRecentTransactionsProps = {
  spaceCurrency: string;
};

export const HomeRecentTransactions = ({
  spaceCurrency,
}: HomeRecentTransactionsProps) => {
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const bootstrapRange = useMemo(() => offlineBootstrapDateRange(), []);

  const localCacheQuery = useQuery({
    queryKey: [
      "home",
      "recent-transactions",
      "local",
      spaceCode,
      bootstrapRange.startDate,
      bootstrapRange.endDate,
    ],
    queryFn: async () =>
      loadCachedTransactionsInRange(
        spaceCode,
        bootstrapRange.startDate,
        bootstrapRange.endDate,
      ),
    enabled: !!spaceCode,
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery);

  const shouldFetchFromNetwork =
    !!spaceCode &&
    !!api &&
    isAuthenticated &&
    !skipNetworkFetch &&
    !localCacheQuery.isPending &&
    localCacheQuery.data?.length === 0;

  const cachedRows = localCacheQuery.data ?? [];
  const isLoadingCache = localCacheQuery.isPending;

  const { data: networkRows = [], isLoading: isLoadingNetwork } = useQuery({
    queryKey: [
      "home",
      "recent-transactions",
      "network",
      spaceCode,
      bootstrapRange.startDate,
      bootstrapRange.endDate,
    ],
    queryFn: async () => {
      const { queryKey } = defaultTransactionsQueryKey(
        spaceCode,
        bootstrapRange.startDate,
        bootstrapRange.endDate,
      );
      const page = await fetchTransactionsPage(api, {
        pageParam: 1,
        queryKey,
      });

      return page.transactions;
    },
    enabled: shouldFetchFromNetwork,
    staleTime: 30_000,
  });

  const isLoading = isLoadingCache || (shouldFetchFromNetwork && isLoadingNetwork);

  const transactions = useMemo(() => {
    const rows = cachedRows.length > 0 ? cachedRows : networkRows;
    const sorted = [...rows].sort(compareTransactionsNewestFirst);

    return buildRecentTransactionsList(sorted, RECENT_LIMIT);
  }, [cachedRows, networkRows]);

  return (
    <HomeSection title="Recent transactions" href="/dashboard/" linkLabel="See all">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="medium" />
        </div>
      ) : null}

      {!isLoading && transactions.length === 0 ? (
        <p className="rounded-xl border border-border/60 bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No transactions yet.
        </p>
      ) : null}

      {!isLoading && transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.map((transaction) => {
            const { amount, currency } = indexTransactionDisplayMoney(
              transaction,
              spaceCurrency,
              false,
            );
            const presentsAsIncome = activityPresentsAsIncome(transaction);
            const presentsAsTransfer = activityPresentsAsTransfer(transaction);
            const categoryLine = activityCategoryLine(transaction);
            const description =
              transaction.description?.trim() ||
              categoryLine ||
              "Transaction";

            return (
              <button
                key={transaction.id}
                type="button"
                onClick={() => requestOpenTransaction(transaction)}
                className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-left transition-colors hover:border-primary/30"
              >
                <div
                  className={cn(
                    "h-10 w-1 shrink-0 self-center rounded",
                    presentsAsIncome
                      ? "bg-teal-600"
                      : presentsAsTransfer
                        ? "bg-blue-900"
                        : "bg-red-900",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-primary">
                    {description}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {categoryLine}
                    {categoryLine ? " · " : ""}
                    {formatTransactionRowDate(transaction.date)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      presentsAsTransfer
                        ? "text-primary"
                        : presentsAsIncome
                          ? "text-teal-600 dark:text-teal-500"
                          : "text-red-900 dark:text-red-700",
                    )}
                  >
                    {formatIndexTransactionListAmount(amount, currency, false)}
                  </span>
                  <TransactionRowTypeIcon row={transaction} size="sm" />
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </HomeSection>
  );
};
