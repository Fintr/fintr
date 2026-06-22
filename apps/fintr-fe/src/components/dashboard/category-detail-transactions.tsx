"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter, CalendarIcon, Eye, EyeOff } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import type { DateRange } from "@daypicker/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchField } from "@/components/ui/search-field";
import { Label } from "@/components/ui/label";
import { ComboBox } from "@/components/ui/combobox";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  filterActiveBadgeClassName,
  filterTriggerIconButtonClassName,
} from "@/components/ui/filter-sheet";
import { cn } from "@/lib/utils";
import { ListView } from "@/components/dashboard/tabs/transactions/list-view";
import { TransactionTotalsDisplay } from "@/components/dashboard/tabs/transactions/transaction-totals";
import { useInfiniteTransactions } from "@/hooks/async/useInfiniteTransactions";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import { formatCategoryPickerValue } from "@/types/categoryTreeTypes";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import EditTransactionDialog from "@/components/dashboard/forms/EditTransactionDialog";
import ScopeModal, {
  DeleteScope,
  Scope,
} from "@/components/dashboard/forms/ScopeModal";
import { deleteTransaction } from "@/services/transactions/mutation";
import { deleteTransfer } from "@/services/transactions/transfers/mutation";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import {
  CombinedTransactionTypeEnum,
  IndexTransaction,
} from "@/types/transactionTypes";
import { toast } from "sonner";

const ALL_SUBCATEGORIES_VALUE = "__all_subcategories__";

type SubcategoryFilterOption = {
  id: string;
  name: string;
};

type CategoryDetailTransactionsProps = {
  categoryId: string;
  spaceCurrency: string;
  subcategories?: SubcategoryFilterOption[];
};

export function CategoryDetailTransactions({
  categoryId,
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

  const [filterBaseline] = useState(() => getCurrentMonthDates());
  const [appliedStart, setAppliedStart] = useState(() => filterBaseline.firstDay);
  const [appliedEnd, setAppliedEnd] = useState(() => filterBaseline.lastDay);
  const [draftStart, setDraftStart] = useState(() => filterBaseline.firstDay);
  const [draftEnd, setDraftEnd] = useState(() => filterBaseline.lastDay);
  const [draftSubcategory, setDraftSubcategory] = useState(ALL_SUBCATEGORIES_VALUE);
  const [appliedSubcategoryId, setAppliedSubcategoryId] = useState<string | null>(
    null,
  );
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");
  const [appliedMin, setAppliedMin] = useState(0);
  const [appliedMax, setAppliedMax] = useState(999999);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeSelected, setRangeSelected] = useState<DateRange | undefined>(() => ({
    from: new Date(filterBaseline.firstDay),
    to: new Date(filterBaseline.lastDay),
  }));
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

  const subcategoryComboOptions = useMemo(
    () => [
      { value: ALL_SUBCATEGORIES_VALUE, label: "All subcategories" },
      ...subcategories.map((sub) => ({
        value: sub.id,
        label: sub.name,
      })),
    ],
    [subcategories],
  );

  const appliedCategoryFilter = useMemo(
    () =>
      formatCategoryPickerValue({
        categoryId,
        subcategoryId: appliedSubcategoryId,
      }),
    [categoryId, appliedSubcategoryId],
  );

  const periodLabel = useMemo(() => {
    const start = new Date(appliedStart);
    const end = new Date(appliedEnd);

    if (
      appliedStart === filterBaseline.firstDay &&
      appliedEnd === filterBaseline.lastDay
    ) {
      return format(start, "MMMM yyyy");
    }

    return `${format(start, "MMM d, yyyy")} – ${format(end, "MMM d, yyyy")}`;
  }, [appliedStart, appliedEnd, filterBaseline.firstDay, filterBaseline.lastDay]);

  useEffect(() => {
    setAppliedSearch(debouncedSearch.trim());
  }, [debouncedSearch]);

  const {
    data,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    isError,
    isSuccess,
  } = useInfiniteTransactions({
    appliedCategory: appliedCategoryFilter,
    queryStartDate: appliedStart,
    queryEndDate: appliedEnd,
    appliedMinAmount: appliedMin === 0 ? "" : String(appliedMin),
    appliedMaxAmount: appliedMax === 999999 ? "" : String(appliedMax),
    searchQuery: appliedSearch,
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

  const hasActiveFilters = useMemo(
    () =>
      appliedStart !== filterBaseline.firstDay ||
      appliedEnd !== filterBaseline.lastDay ||
      appliedSubcategoryId !== null ||
      appliedMin !== 0 ||
      appliedMax !== 999999 ||
      appliedSearch.trim() !== "",
    [
      appliedEnd,
      appliedMax,
      appliedMin,
      appliedSearch,
      appliedStart,
      appliedSubcategoryId,
      filterBaseline.firstDay,
      filterBaseline.lastDay,
    ],
  );

  const openFiltersSheet = () => {
    setDraftStart(appliedStart);
    setDraftEnd(appliedEnd);
    setDraftSubcategory(
      appliedSubcategoryId ?? ALL_SUBCATEGORIES_VALUE,
    );
    setDraftMin(appliedMin === 0 ? "" : String(appliedMin));
    setDraftMax(appliedMax === 999999 ? "" : String(appliedMax));
    setRangeSelected({
      from: new Date(appliedStart),
      to: new Date(appliedEnd),
    });
    setFiltersOpen(true);
  };

  const handleApplyFilters = () => {
    setAppliedStart(draftStart);
    setAppliedEnd(draftEnd);
    setAppliedSubcategoryId(
      draftSubcategory === ALL_SUBCATEGORIES_VALUE ? null : draftSubcategory,
    );
    const minParsed = draftMin.trim() === "" ? 0 : Number(draftMin);
    const maxParsed = draftMax.trim() === "" ? 999999 : Number(draftMax);

    if (
      !Number.isFinite(minParsed) ||
      !Number.isFinite(maxParsed) ||
      minParsed > maxParsed
    ) {
      setAppliedMin(0);
      setAppliedMax(999999);
    } else {
      setAppliedMin(minParsed);
      setAppliedMax(maxParsed);
    }

    setFiltersOpen(false);
  };

  const handleResetFilters = () => {
    setAppliedStart(filterBaseline.firstDay);
    setAppliedEnd(filterBaseline.lastDay);
    setDraftStart(filterBaseline.firstDay);
    setDraftEnd(filterBaseline.lastDay);
    setAppliedSubcategoryId(null);
    setDraftSubcategory(ALL_SUBCATEGORIES_VALUE);
    setAppliedMin(0);
    setAppliedMax(999999);
    setDraftMin("");
    setDraftMax("");
    setSearchInput("");
    setAppliedSearch("");
    setRangeSelected({
      from: new Date(filterBaseline.firstDay),
      to: new Date(filterBaseline.lastDay),
    });
    setFiltersOpen(false);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setRangeSelected(range);

    if (range?.from) {
      setDraftStart(format(range.from, "yyyy-MM-dd"));
    }

    if (range?.to) {
      setDraftEnd(format(range.to, "yyyy-MM-dd"));
    } else if (range?.from && !range.to) {
      setDraftEnd(format(range.from, "yyyy-MM-dd"));
    }

    if (range?.from && range?.to) {
      setRangeOpen(false);
    }
  };

  const renderFiltersTrigger = () => (
    <div className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={filterTriggerIconButtonClassName}
        onClick={openFiltersSheet}
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
    }) => {
      let result;
      if (deleteData.transactionType === CombinedTransactionTypeEnum.TRANSFER) {
        result = await deleteTransfer(api, {
          id: deleteData.id,
          deleteScope: deleteData.deleteScope,
        });
      } else {
        result = await deleteTransaction(api, {
          id: deleteData.id,
          deleteScope: deleteData.deleteScope,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
      toast.success("Transaction deleted");

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

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
    setDeleteScopeModalOpen(true);
  };

  const handleDeleteConfirm = (scope: Scope) => {
    if (transactionToDelete) {
      deleteMutation.mutate(
        {
          id: transactionToDelete.id,
          deleteScope: scope as DeleteScope,
          transactionType: transactionToDelete.type,
        },
        {
          onSuccess: () => {
            setDeleteScopeModalOpen(false);
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

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0 min-h-0 max-h-[100dvh]"
          swipeToClose
          onSwipeToClose={() => setFiltersOpen(false)}
        >
          <div className="p-6 pb-4 flex flex-col flex-1 min-h-0 min-w-0">
            <SheetHeader className="text-left shrink-0">
              <SheetTitle className="text-2xl font-bold text-primary">
                Filters
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-2 py-2 -mx-2 space-y-4">
              <div className="space-y-2">
                <Label>Date range</Label>
                <DateRangePicker
                  open={rangeOpen}
                  onOpenChange={setRangeOpen}
                  selected={rangeSelected}
                  onSelect={handleRangeSelect}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {draftStart && draftEnd
                        ? `${format(new Date(draftStart), "MMM d, yyyy")} – ${format(new Date(draftEnd), "MMM d, yyyy")}`
                        : "Pick a range"}
                    </Button>
                  }
                />
              </div>
              {subcategories.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="cat-filter-subcategory">Subcategory</Label>
                  <ComboBox
                    filterType="frontend"
                    data={subcategoryComboOptions}
                    placeholder="Select subcategories"
                    className="w-full"
                    showAllOnFocus={true}
                    value={draftSubcategory}
                    onChange={setDraftSubcategory}
                    getDisplayLabel={(value) =>
                      subcategoryComboOptions.find((opt) => opt.value === value)
                        ?.label ?? ""
                    }
                  />
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cat-filter-min">Min amount</Label>
                  <Input
                    id="cat-filter-min"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={draftMin}
                    onChange={(e) => setDraftMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cat-filter-max">Max amount</Label>
                  <Input
                    id="cat-filter-max"
                    type="number"
                    step="0.01"
                    placeholder="No max"
                    value={draftMax}
                    onChange={(e) => setDraftMax(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <SheetFooter className="border-t bg-background p-4 sm:p-6 gap-2 mt-auto shrink-0 flex-col sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto order-2 sm:order-1"
              onClick={handleResetFilters}
            >
              Reset filters
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto order-1 sm:order-2"
              onClick={handleApplyFilters}
            >
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <SearchField
            placeholder="Search transactions"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setAppliedSearch(searchInput.trim());
              }
            }}
            onBlur={() => setAppliedSearch(searchInput.trim())}
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
        totalsCurrency={currency}
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
        inSeries={transactionToDelete?.inSeries ?? true}
      />
    </section>
  );
}
