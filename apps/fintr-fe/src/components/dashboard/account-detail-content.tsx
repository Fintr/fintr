"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SquarePen,
  Trash2,
  Filter,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import {
  filterActiveBadgeClassName,
  filterTriggerIconButtonClassName,
} from "@/components/ui/filter-sheet";
import { cn, formatCurrency } from "@/lib/utils";
import DayDivider from "@/components/ui/day-divider";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  formatTransactionDayDividerDate,
  getTransactionDayGroupKey,
} from "@/utils/dateUtils";
import {
  ActivitiesTypeEnum,
  IndexActivity,
  IndexTransaction,
  CombinedTransactionTypeEnum,
} from "@/types/transactionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/async/useAccounts";
import {
  useAccountAdjustmentHistory,
  ACCOUNT_ADJUSTMENT_HISTORY_KEY,
} from "@/hooks/async/useAccountDetailTransactions";
import {
  useAccountDetailActivities,
  ACCOUNT_DETAIL_ACTIVITIES_KEY,
} from "@/hooks/async/useAccountDetailActivities";
import { ACCOUNT_BALANCE_TIMELINE_KEY } from "@/hooks/async/useAccountBalanceTimeline";
import { activityRecordId } from "@/utils/activityDisplay";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import AccountEditSheet from "@/components/dashboard/account-edit-sheet";
import AccountDeleteDialog from "@/components/dashboard/account-delete-dialog";
import {
  FilterTypes,
  TransactionFiltersSheet,
} from "@/components/dashboard/tabs/transactions/filters";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import {
  hasAppliedAccountFilters,
  hasAppliedCategoryFilters,
} from "@/utils/transactionFilterValues";
import { ListView } from "@/components/dashboard/tabs/transactions/list-view";
import { TransactionTotalsDisplay } from "@/components/dashboard/tabs/transactions/transaction-totals";
import EditTransactionDialog from "@/components/dashboard/forms/EditTransactionDialog";
import ScopeModal, { DeleteScope, Scope } from "@/components/dashboard/forms/ScopeModal";
import { deleteTransactionLocalFirst } from "@/services/transactions/delete-local-first";
import { deleteTransaction } from "@/services/transactions/mutation";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { getCurrentRate } from "@/services/exchangeRates/queries";
import { getPresetDateRange } from "@/utils/dateFilterPresets";
import { usePresetDateRangeOptions } from "@/hooks/usePresetDateRangeOptions";
import { toast } from "sonner";

const AccountBalanceChart = dynamic(
  () =>
    import("@/components/dashboard/account-balance-chart").then(
      (mod) => mod.AccountBalanceChart,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-[220px] items-center justify-center text-muted-foreground"
        aria-busy="true"
        aria-label="Loading balance chart"
      >
        <LoadingSpinner size="small" />
        <span className="ml-2 text-sm">Loading chart…</span>
      </div>
    ),
  },
);

type AccountDetailContentProps = {
  accountId: string;
};

const parseBalance = (balance: string): number => parseFloat(balance) || 0;

const parseOptionalAmount = (raw: string): number | undefined => {
  if (raw.trim() === "") {
    return undefined;
  }

  const amount = Number(raw.trim());
  if (Number.isNaN(amount)) {
    return undefined;
  }

  return amount;
};

const flattenPages = (
  data: { pages: { transactions: IndexTransaction[] }[] } | undefined,
): IndexTransaction[] => {
  if (!data?.pages?.length) return [];
  const flat = data.pages.flatMap((p) => p.transactions);
  const seen = new Set<string>();
  return flat.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
};

const TransactionSection = ({
  accountName,
  currencyCode,
  title,
  showTitle = true,
  transactions,
  isLoading,
  isError,
  error,
  loadMoreRef,
  isFetchingNextPage,
  hasNextPage,
  emptyMessage,
  suppressEmptyState = false,
}: {
  accountName: string;
  currencyCode: string;
  title: string;
  showTitle?: boolean;
  transactions: IndexTransaction[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  hasNextPage: boolean | undefined;
  emptyMessage?: string;
  /** When true, render nothing unless there are rows or an error (no loading or empty copy). */
  suppressEmptyState?: boolean;
}) => {
  if (isError) {
    return (
      <p className="text-sm text-red-600 py-4">
        {error instanceof Error ? error.message : "Could not load data."}
      </p>
    );
  }

  if (suppressEmptyState) {
    if (isLoading || transactions.length === 0) {
      return null;
    }
  } else if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <LoadingSpinner size="small" />
        <span className="ml-2 text-sm">Loading…</span>
      </div>
    );
  } else if (transactions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg bg-muted/20">
        {emptyMessage ?? "Nothing to show."}
      </p>
    );
  }

  const byDate = transactions.reduce(
    (acc, transaction) => {
      const date = getTransactionDayGroupKey(transaction.date);
      if (!acc[date]) acc[date] = [];
      acc[date].push(transaction);
      return acc;
    },
    {} as Record<string, IndexTransaction[]>,
  );

  const sortedDates = Object.keys(byDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  return (
    <div className="space-y-4">
      {showTitle ? (
        <h2 className="text-lg font-semibold">{title}</h2>
      ) : null}
      <div className="rounded-lg border bg-card divide-y">
        {sortedDates.map((date) => (
          <div key={date} className="p-3 space-y-2">
            <DayDivider
              date={formatTransactionDayDividerDate(byDate[date][0].date)}
              textClassName="bg-card"
            />
            <div className="space-y-2">
              {byDate[date].map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-md bg-muted/30 min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-1 h-8 rounded flex-shrink-0",
                        transaction.type === CombinedTransactionTypeEnum.INCOME
                          ? "bg-teal-600"
                          : transaction.type ===
                              CombinedTransactionTypeEnum.EXPENSE
                            ? "bg-red-900"
                            : "bg-blue-900",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-medium truncate"
                        title={transaction.description}
                      >
                        {transaction.description}
                      </p>
                      {transaction.type ===
                      CombinedTransactionTypeEnum.TRANSFER ? (
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={`${transaction.fromAccountName ?? ""} → ${transaction.toAccountName ?? ""}`}
                        >
                          {transaction.fromAccountName &&
                          transaction.toAccountName
                            ? `${transaction.fromAccountName} → ${transaction.toAccountName}`
                            : (transaction.fromAccountName ??
                              transaction.toAccountName ??
                              transaction.categoryName)}
                        </p>
                      ) : (
                        <p
                          className="text-xs text-muted-foreground truncate"
                          title={transaction.categoryName}
                        >
                          {transaction.categoryName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        transaction.type === CombinedTransactionTypeEnum.INCOME
                          ? "text-teal-600"
                          : transaction.type ===
                              CombinedTransactionTypeEnum.EXPENSE
                            ? "text-red-900"
                            : "text-blue-900",
                      )}
                    >
                      {(() => {
                        if (
                          transaction.type ===
                          CombinedTransactionTypeEnum.TRANSFER
                        ) {
                          const isFrom =
                            transaction.fromAccountName === accountName;
                          const isTo =
                            transaction.toAccountName === accountName;
                          if (isFrom && !isTo) {
                            return `-${formatCurrency(Math.abs(transaction.amount), currencyCode)}`;
                          }
                          if (isTo && !isFrom) {
                            return `+${formatCurrency(Math.abs(transaction.amount), currencyCode)}`;
                          }
                        }
                        const sign =
                          transaction.type ===
                          CombinedTransactionTypeEnum.EXPENSE
                            ? "-"
                            : "+";
                        return `${sign}${formatCurrency(Math.abs(transaction.amount), currencyCode)}`;
                      })()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div ref={loadMoreRef} className="flex justify-center py-4 min-h-[48px]">
        {isFetchingNextPage ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <LoadingSpinner size="small" />
            Loading more…
          </div>
        ) : hasNextPage ? (
          <span className="text-xs text-muted-foreground">
            Scroll for more
          </span>
        ) : null}
      </div>
    </div>
  );
};

const AccountDetailContent: React.FC<AccountDetailContentProps> = ({
  accountId,
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const presetOptions = usePresetDateRangeOptions();
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const deleteSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const deleteCancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<IndexTransaction | null>(null);
  const [deleteScopeModalOpen, setDeleteScopeModalOpen] = useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>(
    DeleteScopeEnum.THIS_ONLY,
  );
  const [transactionToDelete, setTransactionToDelete] =
    useState<IndexActivity | null>(null);
  const [showBookedCurrencies, setShowBookedCurrencies] = useState(false);

  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();

  const [appliedFilters, setAppliedFilters] = useState<FilterTypes>(() => {
    const { startDate, endDate } = getPresetDateRange("all_time");

    return {
      selectedMonth: currentMonth,
      selectedYear: currentYear,
      startMonth: currentMonth,
      startYear: currentYear,
      endMonth: currentMonth,
      endYear: currentYear,
      selectedCategories: [],
      appliedCategories: [],
      queryStartDate: startDate,
      queryEndDate: endDate,
      appliedMinAmount: "",
      appliedMaxAmount: "",
      searchQuery: "",
      appliedAccounts: [],
    };
  });
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { accounts, isLoading: accountsLoading } = useAccounts();
  useDashboardData();

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  const accountName = account?.name ?? "";

  const allTimeRange = useMemo(
    () => getPresetDateRange("all_time", new Date(), presetOptions),
    [presetOptions],
  );

  useEffect(() => {
    const anchorDate =
      presetOptions.earliestTransactionDate ?? presetOptions.spaceCreatedAt;

    if (!anchorDate) {
      return;
    }

    setAppliedFilters((previous) => {
      if (
        previous.queryStartDate === allTimeRange.startDate
        && previous.queryEndDate === allTimeRange.endDate
      ) {
        return previous;
      }

      const legacyAllTimeStart = "2000-01-01";
      const fallbackAllTime = getPresetDateRange("all_time");
      const spaceCreatedAllTime = getPresetDateRange("all_time", new Date(), {
        spaceCreatedAt: presetOptions.spaceCreatedAt,
      });
      const isDefaultAllTimeRange =
        previous.queryStartDate === legacyAllTimeStart
        || previous.queryStartDate === fallbackAllTime.startDate
        || previous.queryStartDate === spaceCreatedAllTime.startDate
        || previous.queryStartDate === allTimeRange.startDate;

      if (!isDefaultAllTimeRange) {
        return previous;
      }

      return {
        ...previous,
        queryStartDate: allTimeRange.startDate,
        queryEndDate: allTimeRange.endDate,
      };
    });
  }, [
    allTimeRange.endDate,
    allTimeRange.startDate,
    presetOptions.earliestTransactionDate,
    presetOptions.spaceCreatedAt,
  ]);

  useEffect(() => {
    setAppliedFilters((previous) => {
      const nextSearchQuery = debouncedSearch.trim();
      if (previous.searchQuery === nextSearchQuery) {
        return previous;
      }

      return {
        ...previous,
        searchQuery: nextSearchQuery,
      };
    });
  }, [debouncedSearch]);

  const applyFilters = (filters: FilterTypes) => {
    setAppliedFilters(filters);
    setSearchInput(filters.searchQuery);
  };

  const hasActiveFilters = useMemo(() => {
    const isDefaultDateRange =
      appliedFilters.queryStartDate === allTimeRange.startDate
      && appliedFilters.queryEndDate === allTimeRange.endDate;

    return (
      !isDefaultDateRange
      || hasAppliedCategoryFilters(appliedFilters.appliedCategories)
      || appliedFilters.appliedMinAmount !== ""
      || appliedFilters.appliedMaxAmount !== ""
      || appliedFilters.searchQuery !== ""
      || hasAppliedAccountFilters(appliedFilters.appliedAccounts)
    );
  }, [allTimeRange.endDate, allTimeRange.startDate, appliedFilters]);

  const minAmount = parseOptionalAmount(appliedFilters.appliedMinAmount);
  const maxAmount = parseOptionalAmount(appliedFilters.appliedMaxAmount);

  const queryEnabled = Boolean(account);

  const mainQuery = useAccountDetailActivities({
    accountId: account?.id ?? "",
    accountName,
    startDate: appliedFilters.queryStartDate,
    endDate: appliedFilters.queryEndDate,
    categoryFilters: appliedFilters.appliedCategories,
    searchQuery: appliedFilters.searchQuery,
    ...(minAmount !== undefined ? { minAmount } : {}),
    ...(maxAmount !== undefined ? { maxAmount } : {}),
    enabled: queryEnabled && !!account?.id,
  });

  const adjustmentQuery = useAccountAdjustmentHistory({
    accountName,
    startDate: appliedFilters.queryStartDate,
    endDate: appliedFilters.queryEndDate,
    enabled: queryEnabled,
  });

  const hasNonSpaceCurrencyInLoadedTransactions = useMemo(() => {
    const pages = mainQuery.data?.pages;
    if (!pages?.length) return false;

    const spaceUpper = spaceCurrency.trim().toUpperCase();
    const normalizedIso = (code?: string) => {
      const trimmed = code != null ? String(code).trim() : "";
      return trimmed === "" ? null : trimmed.toUpperCase();
    };

    return pages.some((page) =>
      (page.activities ?? []).some((tx) => {
        const amountCcy = normalizedIso(tx.amountCurrency);
        const bookedCcy = normalizedIso(tx.bookedAmountCurrency);
        return (
          (amountCcy != null && amountCcy !== spaceUpper) ||
          (bookedCcy != null && bookedCcy !== spaceUpper)
        );
      }),
    );
  }, [mainQuery.data?.pages, spaceCurrency]);

  useEffect(() => {
    if (!hasNonSpaceCurrencyInLoadedTransactions && showBookedCurrencies) {
      setShowBookedCurrencies(false);
    }
  }, [hasNonSpaceCurrencyInLoadedTransactions, showBookedCurrencies]);

  const deleteMutation = useMutation({
    mutationFn: async (deleteData: {
      id: string;
      deleteScope: DeleteScope;
      transactionType?: string;
      listRow?: IndexTransaction | null;
    }) => {
      let result;
      const isOptimisticLocalFirstDelete =
        deleteData.transactionType === ActivitiesTypeEnum.TRANSFER ||
        deleteData.transactionType === ActivitiesTypeEnum.INCOME ||
        deleteData.transactionType === ActivitiesTypeEnum.EXPENSE;
      const isTransferDelete =
        deleteData.transactionType === ActivitiesTypeEnum.TRANSFER;

      if (isOptimisticLocalFirstDelete) {
        result = await deleteTransactionLocalFirst(
          api,
          {
            spaceId: spaceCode,
            transactionId: deleteData.id,
            deleteScope: deleteData.deleteScope as DeleteScopeEnum,
            listRow: deleteData.listRow,
          },
          { queryClient, waitForSync: false },
        );
        toast.success(
          isTransferDelete
            ? "Transfer deleted successfully"
            : "Transaction deleted successfully",
        );
        void Promise.resolve(result.syncPromise).then((synced) => {
          if (synced.pendingSync) {
            toast.message(
              isTransferDelete
                ? "Transfer deleted on this device. Will sync when online."
                : "Transaction deleted on this device. Will sync when online.",
            );
          }
        });
      } else {
        result = await deleteTransaction(api, {
          id: deleteData.id,
          deleteScope: deleteData.deleteScope,
        });
        toast.success("Transaction deleted successfully");
      }

      const refreshSecondaryCaches = () => {
        queryClient.invalidateQueries({
          queryKey: ["dashboard", spaceCode],
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: ["accounts"],
          refetchType: "active",
        });
        queryClient.invalidateQueries({
          queryKey: ["insights"],
          refetchType: "active",
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY],
          refetchType: "active",
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: [ACCOUNT_ADJUSTMENT_HISTORY_KEY],
          refetchType: "active",
          exact: false,
        });
        queryClient.invalidateQueries({
          queryKey: [ACCOUNT_BALANCE_TIMELINE_KEY],
          refetchType: "active",
          exact: false,
        });
      };

      if (isOptimisticLocalFirstDelete) {
        void Promise.resolve(result.syncPromise)
          .then(() => {
            refreshSecondaryCaches();
          })
          .catch(() => undefined);
      } else {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        refreshSecondaryCaches();
      }

      return result;
    },
  });

  useEffect(() => {
    return () => {
      if (deleteSuccessTimeoutRef.current) {
        clearTimeout(deleteSuccessTimeoutRef.current);
      }
      if (deleteCancelTimeoutRef.current) {
        clearTimeout(deleteCancelTimeoutRef.current);
      }
    };
  }, []);

  const handleEditRow = (row: IndexTransaction | IndexActivity) => {
    const activity = row as IndexActivity;
    if (activity.isLoanActivity && activity.loanId) {
      router.push(`/dashboard/loans/detail?loanId=${activity.loanId}`);
      return;
    }
    if (activity.hasLoanPayment) {
      toast.error(
        "This transaction is linked to a loan payment and cannot be edited. Edit the loan payment instead.",
      );
      return;
    }
    setSelectedTransaction({
      ...activity,
      id: activityRecordId(activity),
      type: activity.type as unknown as CombinedTransactionTypeEnum,
    });
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleEditSuccess = (options?: {
    skipTransactionsInvalidate?: boolean;
  }) => {
    if (!options?.skipTransactionsInvalidate) {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
    queryClient.invalidateQueries({
      queryKey: ["dashboard", spaceCode],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["accounts"],
      refetchType: "active",
    });
    queryClient.invalidateQueries({
      queryKey: ["insights"],
      refetchType: "active",
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: [ACCOUNT_DETAIL_ACTIVITIES_KEY],
      refetchType: "active",
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: [ACCOUNT_ADJUSTMENT_HISTORY_KEY],
      refetchType: "active",
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: [ACCOUNT_BALANCE_TIMELINE_KEY],
      refetchType: "active",
      exact: false,
    });
    mainQuery.refetch();
    adjustmentQuery.refetch();
  };

  const handleDeleteRow = (id: string) => {
    let activity: IndexActivity | null = null;
    if (mainQuery.data?.pages) {
      for (const page of mainQuery.data.pages) {
        const found = page.activities.find((row) => row.id === id);
        if (found) {
          activity = found;
          break;
        }
      }
    }

    if (activity?.isLoanActivity) {
      toast.error("Loan activity is managed from the Loans tab.");
      return;
    }

    if (activity?.hasLoanPayment) {
      toast.error(
        "This transaction is linked to a loan payment and cannot be deleted. Delete the loan payment instead.",
      );
      return;
    }

    setTransactionToDelete(activity);
    setSelectedDeleteScope(DeleteScopeEnum.THIS_ONLY);
    setDeleteScopeModalOpen(true);
  };

  const handleDeleteConfirm = (scope: Scope) => {
    if (transactionToDelete) {
      const listRow: IndexTransaction = {
        ...transactionToDelete,
        id: activityRecordId(transactionToDelete),
        type: transactionToDelete.type as unknown as CombinedTransactionTypeEnum,
      };
      setDeleteScopeModalOpen(false);
      deleteMutation.mutate(
        {
          id: listRow.id,
          deleteScope: scope as DeleteScope,
          transactionType: transactionToDelete.type,
          listRow,
        },
        {
          onSuccess: () => {
            deleteSuccessTimeoutRef.current = setTimeout(() => {
              setTransactionToDelete(null);
            }, 300);
          },
          onError: (error) => {
            console.error("Error deleting transaction:", error);
            toast.error("Failed to delete transaction");
          },
        },
      );
    }
  };

  const handleDeleteScopeChange = (scope: Scope) => {
    setSelectedDeleteScope(scope as DeleteScope);
  };

  const handleDeleteCancel = () => {
    setDeleteScopeModalOpen(false);
    deleteCancelTimeoutRef.current = setTimeout(() => {
      setTransactionToDelete(null);
    }, 300);
  };

  const adjustmentTx = flattenPages(adjustmentQuery.data);

  const mainSentinelRef = useRef<HTMLDivElement>(null);
  const adjSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mainSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          mainQuery.hasNextPage &&
          !mainQuery.isFetchingNextPage
        ) {
          mainQuery.fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [
    mainQuery.fetchNextPage,
    mainQuery.hasNextPage,
    mainQuery.isFetchingNextPage,
  ]);

  useEffect(() => {
    const el = adjSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (
          entries[0]?.isIntersecting &&
          adjustmentQuery.hasNextPage &&
          !adjustmentQuery.isFetchingNextPage
        ) {
          adjustmentQuery.fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [
    adjustmentQuery.fetchNextPage,
    adjustmentQuery.hasNextPage,
    adjustmentQuery.isFetchingNextPage,
  ]);

  const currencyCode = account?.balanceCurrency ?? "PHP";
  const accountBalance = parseBalance(account?.balance ?? "0");
  const [balanceRateToSpace, setBalanceRateToSpace] = useState(1);
  const [balanceRateLoading, setBalanceRateLoading] = useState(false);

  const needsBalanceConversion = useMemo(
    () =>
      currencyCode.trim().toUpperCase() !== spaceCurrency.trim().toUpperCase(),
    [currencyCode, spaceCurrency],
  );

  useEffect(() => {
    if (!api || !needsBalanceConversion) {
      setBalanceRateToSpace(1);
      setBalanceRateLoading(false);
      return;
    }

    setBalanceRateLoading(true);
    const todayStr = new Date().toISOString().slice(0, 10);

    getCurrentRate(api, currencyCode, spaceCurrency, todayStr)
      .then((data) => setBalanceRateToSpace(Number(data.rate)))
      .catch(() => setBalanceRateToSpace(1))
      .finally(() => setBalanceRateLoading(false));
  }, [api, currencyCode, spaceCurrency, needsBalanceConversion]);

  const balanceInSpaceCurrency = accountBalance * balanceRateToSpace;

  const renderFiltersTrigger = (wrapperClassName: string) => (
    <div className={cn("relative", wrapperClassName)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={filterTriggerIconButtonClassName}
        onClick={() => setFiltersOpen(true)}
        aria-label="Open transaction filters"
      >
        <Filter className="h-4 w-4" aria-hidden />
      </Button>
      {hasActiveFilters ? (
        <span className={filterActiveBadgeClassName} aria-hidden />
      ) : null}
    </div>
  );

  if (accountsLoading && !account) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (!accountsLoading && !account) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto px-2 py-8">
        <p className="text-muted-foreground">Account not found.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/space_settings/accounts">Back to accounts</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-8">
      <header className="px-4 pb-3 pt-1 sm:px-6">
        <h1
          className="text-2xl font-extrabold tracking-tight text-primary md:text-[1.75rem] truncate"
        >
          {account?.name}
        </h1>
        {account?.accountCategory ? (
          <p className="mt-0.5 text-sm font-medium text-muted-foreground capitalize">
            {account.accountCategory.replace(/_/g, " ")}
          </p>
        ) : null}
      </header>

      <section
        className="w-full border-y border-border/50 bg-card px-4 py-5 shadow-sm dark:bg-muted/30 sm:px-6"
        aria-label="Account overview"
      >
        <AccountBalanceChart
          accountId={account?.id ?? ""}
          displayAmount={balanceInSpaceCurrency}
          displayCurrency={spaceCurrency}
          displayAmountLoading={needsBalanceConversion && balanceRateLoading}
          enabled={queryEnabled && !!account?.id}
        />

        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg border-muted-foreground/25 bg-background/60 text-foreground hover:bg-muted/60"
            onClick={() => setEditOpen(true)}
            aria-label="Edit account"
          >
            <SquarePen className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg border-red-800/35 bg-background/60 text-red-800 hover:bg-red-800/10 dark:text-red-400 dark:border-red-800/50 dark:hover:bg-red-800/20"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete account"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-6 px-2 pt-6">
      <Link
        href="/dashboard/space_settings/accounts"
        className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Accounts
      </Link>

      <TransactionFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        applyFilters={applyFilters}
        appliedFilters={appliedFilters}
        defaultPresetId="all_time"
      />

      <div>
        <h2 className="text-lg font-semibold mb-3">Activity</h2>
        <div className="flex flex-col md:flex-row gap-4 mb-4 md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <SearchField
              placeholder="Search activity"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            {renderFiltersTrigger("shrink-0")}
          </div>
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-center justify-end gap-2 self-end w-full md:ml-auto md:w-auto md:self-center md:flex-nowrap",
              !hasNonSpaceCurrencyInLoadedTransactions && "hidden md:flex",
            )}
          >
            {hasNonSpaceCurrencyInLoadedTransactions ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 h-9 text-xs sm:text-sm"
                onClick={() => setShowBookedCurrencies((v) => !v)}
                aria-pressed={showBookedCurrencies}
                aria-label={
                  showBookedCurrencies ? "Hide currency" : "Show currency"
                }
              >
                {showBookedCurrencies ? (
                  <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="whitespace-nowrap">
                  {showBookedCurrencies ? "Hide currency" : "Show currency"}
                </span>
              </Button>
            ) : null}
          </div>
        </div>

        <TransactionTotalsDisplay
          totals={mainQuery.data?.pages?.[0]?.totals ?? null}
          isLoading={queryEnabled && mainQuery.isFetching && !mainQuery.data}
          spaceCurrency={spaceCurrency}
          variant="summary"
        />

        <ListView
          variant="activities"
          isPending={accountsLoading || (queryEnabled && mainQuery.isFetching)}
          isError={mainQuery.isError}
          error={mainQuery.error as Error | null}
          isSuccess={mainQuery.isSuccess}
          data={mainQuery.data}
          isFetchingNextPage={mainQuery.isFetchingNextPage}
          hasNextPage={!!mainQuery.hasNextPage}
          onRowEdit={handleEditRow}
          onRowDelete={handleDeleteRow}
          loadMoreRef={mainSentinelRef as React.RefObject<HTMLDivElement>}
          showBookedCurrencies={showBookedCurrencies}
        />
      </div>

      <TransactionSection
        accountName={accountName}
        currencyCode={currencyCode}
        title="Balance adjustment history"
        transactions={adjustmentTx}
        isLoading={
          accountsLoading ||
          (Boolean(account) && adjustmentQuery.isLoading)
        }
        isError={adjustmentQuery.isError}
        error={adjustmentQuery.error as Error | null}
        loadMoreRef={adjSentinelRef}
        isFetchingNextPage={adjustmentQuery.isFetchingNextPage}
        hasNextPage={adjustmentQuery.hasNextPage}
        suppressEmptyState
      />
      </div>

      <AccountEditSheet
        account={account}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSaved={() => {
          mainQuery.refetch();
          adjustmentQuery.refetch();
        }}
      />

      <EditTransactionDialog
        transaction={selectedTransaction}
        isOpen={editDialogOpen}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
      />

      <ScopeModal
        isOpen={deleteScopeModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        selectedScope={selectedDeleteScope}
        onScopeChange={handleDeleteScopeChange}
        operationType="delete"
        inSeries={Boolean(transactionToDelete?.inSeries)}
        transactionType={transactionToDelete?.type}
      />

      <AccountDeleteDialog
        account={account}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => router.push("/dashboard/space_settings/accounts")}
      />
    </div>
  );
};

export default AccountDetailContent;
