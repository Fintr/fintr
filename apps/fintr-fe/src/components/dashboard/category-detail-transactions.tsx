"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter, Eye, EyeOff } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import {
  filterActiveBadgeClassName,
  filterTriggerIconButtonClassName,
} from "@/components/ui/filter-sheet";
import { cn } from "@/lib/utils";
import { ListView } from "@/components/dashboard/tabs/transactions/list-view";
import { TransactionTotalsDisplay } from "@/components/dashboard/tabs/transactions/transaction-totals";
import {
  FilterTypes,
  TransactionFiltersSheet,
} from "@/components/dashboard/tabs/transactions/filters";
import { useInfiniteTransactions } from "@/hooks/async/useInfiniteTransactions";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import EditTransactionDialog from "@/components/dashboard/forms/EditTransactionDialog";
import ScopeModal, {
  DeleteScope,
  Scope,
} from "@/components/dashboard/forms/ScopeModal";
import { deleteTransactionLocalFirst } from "@/services/transactions/delete-local-first";
import { deleteTransaction } from "@/services/transactions/mutation";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import {
  CombinedTransactionTypeEnum,
  IndexTransaction,
} from "@/types/transactionTypes";
import {
  hasAppliedAccountFilters,
  hasAppliedCategoryFilters,
} from "@/utils/transactionFilterValues";
import { useAtom } from "jotai";
import {
  dateFilterEndDateAtom,
  dateFilterStartDateAtom,
  dateRangeToMonthYear,
} from "@/atoms/dateFilterAtoms";
import { toast } from "sonner";

type SubcategoryFilterOption = {
  id: string;
  name: string;
};

type CategoryDetailTransactionsProps = {
  categoryId: string;
  categoryName: string;
  categoryKind: "expense" | "income";
  spaceCurrency: string;
  subcategories?: SubcategoryFilterOption[];
};

export function CategoryDetailTransactions({
  categoryId,
  categoryName,
  categoryKind,
  spaceCurrency,
  subcategories = [],
}: CategoryDetailTransactionsProps) {
  const queryClient = useQueryClient();
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const { currentSpace } = useSpaceContext(api);
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const currency = currentSpace?.currency ?? spaceCurrency;

  const { firstDay, lastDay } = getCurrentMonthDates();
  const [startDate] = useAtom(dateFilterStartDateAtom);
  const [endDate] = useAtom(dateFilterEndDateAtom);

  const defaultCategoryFilters = useMemo(
    () => [categoryId],
    [categoryId],
  );

  const [appliedFilters, setAppliedFilters] = useState<FilterTypes>(() => {
    const queryStartDate = startDate || firstDay;
    const queryEndDate = endDate || lastDay;
    const monthYearFromDates = dateRangeToMonthYear(
      queryStartDate,
      queryEndDate,
    );

    return {
      selectedMonth: monthYearFromDates.selectedMonth,
      selectedYear: monthYearFromDates.selectedYear,
      startMonth: monthYearFromDates.startMonth,
      startYear: monthYearFromDates.startYear,
      endMonth: monthYearFromDates.endMonth,
      endYear: monthYearFromDates.endYear,
      selectedCategories: [categoryId],
      appliedCategories: [categoryId],
      queryStartDate,
      queryEndDate,
      appliedMinAmount: "",
      appliedMaxAmount: "",
      searchQuery: "",
      appliedAccounts: [],
    };
  });

  useEffect(() => {
    const fallbackDates = getCurrentMonthDates();
    const queryStartDate = startDate || fallbackDates.firstDay;
    const queryEndDate = endDate || fallbackDates.lastDay;

    setAppliedFilters((previous) => {
      const monthYearFromDates = dateRangeToMonthYear(
        queryStartDate,
        queryEndDate,
      );
      const isSameDateRange =
        previous.queryStartDate === queryStartDate
        && previous.queryEndDate === queryEndDate;
      const isSameMonthYear =
        previous.selectedMonth === monthYearFromDates.selectedMonth
        && previous.selectedYear === monthYearFromDates.selectedYear;

      if (isSameDateRange && isSameMonthYear) {
        return previous;
      }

      return {
        ...previous,
        selectedMonth: monthYearFromDates.selectedMonth,
        selectedYear: monthYearFromDates.selectedYear,
        startMonth: monthYearFromDates.startMonth,
        startYear: monthYearFromDates.startYear,
        endMonth: monthYearFromDates.endMonth,
        endYear: monthYearFromDates.endYear,
        queryStartDate,
        queryEndDate,
      };
    });
  }, [startDate, endDate]);

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showBookedCurrencies, setShowBookedCurrencies] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<IndexTransaction | null>(null);
  const [deleteScopeModalOpen, setDeleteScopeModalOpen] = useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>(
    DeleteScopeEnum.THIS_ONLY,
  );
  const [transactionToDelete, setTransactionToDelete] =
    useState<IndexTransaction | null>(null);

  const deleteCancelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useDashboardData(
    appliedFilters.queryStartDate,
    appliedFilters.queryEndDate,
  );

  const scopedCategoryTree = useMemo(
    (): CategoryTreeOption => ({
      id: categoryId,
      label: categoryName,
      value: categoryId,
      name: categoryName,
      parentId: null,
      children: subcategories.map((sub) => ({
        id: sub.id,
        label: sub.name,
        value: sub.id,
        name: sub.name,
        parentId: categoryId,
      })),
    }),
    [categoryId, categoryName, subcategories],
  );

  const expenseCategoryOptionsOverride =
    categoryKind === "expense" ? [scopedCategoryTree] : [];
  const incomeCategoryOptionsOverride =
    categoryKind === "income" ? [scopedCategoryTree] : [];

  const periodLabel = useMemo(() => {
    const start = new Date(appliedFilters.queryStartDate);
    const end = new Date(appliedFilters.queryEndDate);

    if (
      appliedFilters.queryStartDate === firstDay
      && appliedFilters.queryEndDate === lastDay
    ) {
      return format(start, "MMMM yyyy");
    }

    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }, [appliedFilters.queryEndDate, appliedFilters.queryStartDate, firstDay, lastDay]);

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

  const hasActiveFilters = useMemo(
    () =>
      appliedFilters.queryStartDate !== firstDay
      || appliedFilters.queryEndDate !== lastDay
      || hasAppliedCategoryFilters(
        appliedFilters.appliedCategories,
        defaultCategoryFilters,
      )
      || appliedFilters.appliedMinAmount !== ""
      || appliedFilters.appliedMaxAmount !== ""
      || appliedFilters.searchQuery !== ""
      || hasAppliedAccountFilters(appliedFilters.appliedAccounts),
    [appliedFilters, defaultCategoryFilters, firstDay, lastDay],
  );

  const {
    data,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    isError,
    isSuccess,
  } = useInfiniteTransactions({
    appliedCategories: appliedFilters.appliedCategories,
    queryStartDate: appliedFilters.queryStartDate,
    queryEndDate: appliedFilters.queryEndDate,
    appliedMinAmount: appliedFilters.appliedMinAmount,
    appliedMaxAmount: appliedFilters.appliedMaxAmount,
    searchQuery: appliedFilters.searchQuery,
    appliedAccountNames: appliedFilters.appliedAccounts,
    loadMoreRef,
  });

  const hasNonSpaceCurrencyInLoadedTransactions = useMemo(() => {
    const pages = data?.pages;
    if (!pages?.length) {
      return false;
    }

    const spaceUpper = currency.trim().toUpperCase();
    const normalizedIso = (code?: string) => {
      const trimmed = code != null ? String(code).trim() : "";
      return trimmed === "" ? null : trimmed.toUpperCase();
    };

    return pages.some((page) =>
      (page.transactions ?? []).some((tx) => {
        const amountCcy = normalizedIso(tx.amountCurrency);
        const bookedCcy = normalizedIso(tx.bookedAmountCurrency);
        return (
          (amountCcy != null && amountCcy !== spaceUpper) ||
          (bookedCcy != null && bookedCcy !== spaceUpper)
        );
      }),
    );
  }, [data?.pages, currency]);

  useEffect(() => {
    if (!hasNonSpaceCurrencyInLoadedTransactions && showBookedCurrencies) {
      setShowBookedCurrencies(false);
    }
  }, [hasNonSpaceCurrencyInLoadedTransactions, showBookedCurrencies]);

  const renderFiltersTrigger = () => (
    <div className="relative shrink-0">
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

  const deleteMutation = useMutation({
    mutationFn: async (deleteData: {
      id: string;
      deleteScope: DeleteScope;
      transactionType?: string;
      listRow?: IndexTransaction | null;
    }) => {
      let result;
      const isOptimisticLocalFirstDelete =
        deleteData.transactionType === CombinedTransactionTypeEnum.TRANSFER ||
        deleteData.transactionType === CombinedTransactionTypeEnum.INCOME ||
        deleteData.transactionType === CombinedTransactionTypeEnum.EXPENSE;
      const isTransferDelete =
        deleteData.transactionType === CombinedTransactionTypeEnum.TRANSFER;

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
          isTransferDelete ? "Transfer deleted" : "Transaction deleted",
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
        toast.success("Transaction deleted");
      }

      const refreshSecondaryCaches = () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["budgets"] });
        queryClient.invalidateQueries({ queryKey: ["insights"] });
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

  const handleEditRow = (transaction: IndexTransaction) => {
    if (transaction.hasLoanPayment) {
      toast.error(
        "This transaction is linked to a loan payment and cannot be edited.",
      );
      return;
    }

    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = (options?: {
    skipTransactionsInvalidate?: boolean;
  }) => {
    if (!options?.skipTransactionsInvalidate) {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["insights"] });
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleDeleteRow = (id: string) => {
    let transaction: IndexTransaction | null = null;

    if (data?.pages) {
      for (const page of data.pages) {
        const found = page.transactions.find((t) => t.id === id);
        if (found) {
          transaction = found;
          break;
        }
      }
    }

    if (transaction?.hasLoanPayment) {
      toast.error(
        "This transaction is linked to a loan payment and cannot be deleted.",
      );
      return;
    }

    setTransactionToDelete(transaction);
    setSelectedDeleteScope(DeleteScopeEnum.THIS_ONLY);
    setDeleteScopeModalOpen(true);
  };

  const handleDeleteConfirm = (scope: Scope) => {
    if (transactionToDelete) {
      setDeleteScopeModalOpen(false);
      deleteMutation.mutate(
        {
          id: transactionToDelete.id,
          deleteScope: scope as DeleteScope,
          transactionType: transactionToDelete.type,
          listRow: transactionToDelete,
        },
        {
          onSuccess: () => {
            setTransactionToDelete(null);
          },
          onError: () => {
            toast.error("Failed to delete transaction");
          },
        },
      );
    }
  };

  const handleDeleteCancel = () => {
    setDeleteScopeModalOpen(false);
    deleteCancelTimeoutRef.current = setTimeout(() => {
      setTransactionToDelete(null);
    }, 300);
  };

  const queryEnabled = Boolean(spaceCode && categoryId);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-primary">Transactions</h2>
        <p className="text-xs text-muted-foreground">{periodLabel}</p>
      </div>

      <TransactionFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        applyFilters={applyFilters}
        appliedFilters={appliedFilters}
        expenseCategoryOptionsOverride={expenseCategoryOptionsOverride}
        incomeCategoryOptionsOverride={incomeCategoryOptionsOverride}
        showAccountFilter={true}
        categoryDefaultValues={defaultCategoryFilters}
        useCategoryDefaultsWhenEmpty={true}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchField
            placeholder="Search transactions"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {renderFiltersTrigger()}
        </div>
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center justify-end gap-2 self-end w-full sm:w-auto sm:self-center",
            !hasNonSpaceCurrencyInLoadedTransactions && "sm:justify-end",
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
        totals={data?.pages?.[0]?.totals ?? null}
        isLoading={queryEnabled && isFetching && !data}
        spaceCurrency={currency}
        variant="summary"
      />

      <ListView
        isPending={isFetching && !data}
        isError={isError}
        error={error as Error | null}
        isSuccess={isSuccess}
        data={data}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={!!hasNextPage}
        onRowEdit={handleEditRow}
        onRowDelete={handleDeleteRow}
        loadMoreRef={loadMoreRef as React.RefObject<HTMLDivElement>}
        showBookedCurrencies={showBookedCurrencies}
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
        onScopeChange={(scope) => setSelectedDeleteScope(scope as DeleteScope)}
        operationType="delete"
        transactionType={transactionToDelete?.type}
        inSeries={Boolean(transactionToDelete?.inSeries)}
      />
    </section>
  );
}
