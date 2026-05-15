"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SquarePen,
  Trash2,
  CalendarIcon,
  Search,
  Filter,
  ChevronLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "@daypicker/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn, formatCurrency, getNumberColor } from "@/lib/utils";
import DayDivider from "@/components/ui/day-divider";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  IndexTransaction,
  CombinedTransactionTypeEnum,
} from "@/types/transactionTypes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccounts } from "@/hooks/async/useAccounts";
import {
  useAccountAdjustmentHistory,
  useAccountDetailTransactions,
  ACCOUNT_DETAIL_TRANSACTIONS_KEY,
  ACCOUNT_ADJUSTMENT_HISTORY_KEY,
} from "@/hooks/async/useAccountDetailTransactions";
import { getWideAccountHistoryDateRange } from "@/utils/dateUtils";
import { categoryOptionsAtom } from "@/atoms/dashboardAtoms";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import AccountEditSheet from "@/components/dashboard/account-edit-sheet";
import AccountDeleteDialog from "@/components/dashboard/account-delete-dialog";
import { useAtomValue } from "jotai";
import { useDebouncedValue, SEARCH_DEBOUNCE_MS } from "@/hooks/useDebouncedValue";
import { ListView } from "@/components/dashboard/tabs/transactions/list-view";
import { TransactionTotalsDisplay } from "@/components/dashboard/tabs/transactions/transaction-totals";
import EditTransactionDialog from "@/components/dashboard/forms/EditTransactionDialog";
import ScopeModal, { DeleteScope, Scope } from "@/components/dashboard/forms/ScopeModal";
import { deleteTransaction } from "@/services/transactions/mutation";
import { deleteTransfer } from "@/services/transactions/transfers/mutation";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { toast } from "sonner";

const ALL_CATEGORIES_VALUE = "__all_categories__";

type AccountDetailContentProps = {
  accountId: string;
};

const parseBalance = (balance: string): number => parseFloat(balance) || 0;

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
      const date = new Date(transaction.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
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
            <DayDivider date={date} textClassName="bg-card" />
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
    useState<IndexTransaction | null>(null);
  const [showBookedCurrencies, setShowBookedCurrencies] = useState(false);

  const [filterBaseline, setFilterBaseline] = useState(() =>
    getWideAccountHistoryDateRange(),
  );
  const [appliedStart, setAppliedStart] = useState(
    () => filterBaseline.startDate,
  );
  const [appliedEnd, setAppliedEnd] = useState(() => filterBaseline.endDate);
  const [draftStart, setDraftStart] = useState(() => filterBaseline.startDate);
  const [draftEnd, setDraftEnd] = useState(() => filterBaseline.endDate);
  const [draftCategory, setDraftCategory] = useState(ALL_CATEGORIES_VALUE);
  const [appliedCategory, setAppliedCategory] = useState("");
  const [draftMin, setDraftMin] = useState("");
  const [draftMax, setDraftMax] = useState("");
  const [appliedMin, setAppliedMin] = useState(0);
  const [appliedMax, setAppliedMax] = useState(999999);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeSelected, setRangeSelected] = useState<DateRange | undefined>(
    () => ({
      from: new Date(filterBaseline.startDate),
      to: new Date(filterBaseline.endDate),
    }),
  );

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { accounts, isLoading: accountsLoading } = useAccounts();
  useDashboardData();
  const categoryOptions = useAtomValue(categoryOptionsAtom);

  const account = useMemo(
    () => accounts.find((a) => a.id === accountId) ?? null,
    [accounts, accountId],
  );

  const accountName = account?.name ?? "";

  useEffect(() => {
    setAppliedSearch(debouncedSearch.trim());
  }, [debouncedSearch]);

  const openFiltersSheet = () => {
    setDraftStart(appliedStart);
    setDraftEnd(appliedEnd);
    setDraftCategory(
      appliedCategory === "" ? ALL_CATEGORIES_VALUE : appliedCategory,
    );
    setDraftMin(appliedMin === 0 ? "" : String(appliedMin));
    setDraftMax(appliedMax === 999999 ? "" : String(appliedMax));
    setRangeSelected({
      from: new Date(appliedStart),
      to: new Date(appliedEnd),
    });
    setFiltersOpen(true);
  };

  const hasActiveFilters = useMemo(() => {
    return (
      appliedStart !== filterBaseline.startDate ||
      appliedEnd !== filterBaseline.endDate ||
      appliedCategory !== "" ||
      appliedMin !== 0 ||
      appliedMax !== 999999 ||
      appliedSearch.trim() !== ""
    );
  }, [
    appliedCategory,
    appliedEnd,
    appliedMax,
    appliedMin,
    appliedSearch,
    appliedStart,
    filterBaseline.endDate,
    filterBaseline.startDate,
  ]);

  const queryEnabled = Boolean(account);

  const mainQuery = useAccountDetailTransactions({
    accountName,
    startDate: appliedStart,
    endDate: appliedEnd,
    categoryName: appliedCategory,
    searchQuery: appliedSearch,
    ...(appliedMin !== 0 ? { minAmount: appliedMin } : {}),
    ...(appliedMax !== 999999 ? { maxAmount: appliedMax } : {}),
    enabled: queryEnabled,
  });

  const adjustmentQuery = useAccountAdjustmentHistory({
    accountName,
    startDate: appliedStart,
    endDate: appliedEnd,
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
      (page.transactions ?? []).some((tx) => {
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
    mutationFn: (deleteData: {
      id: string;
      deleteScope: DeleteScope;
      transactionType?: string;
    }) => {
      if (deleteData.transactionType === CombinedTransactionTypeEnum.TRANSFER) {
        return deleteTransfer(api, {
          id: deleteData.id,
          deleteScope: deleteData.deleteScope,
        });
      }
      return deleteTransaction(api, {
        id: deleteData.id,
        deleteScope: deleteData.deleteScope,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
        queryKey: [ACCOUNT_DETAIL_TRANSACTIONS_KEY],
        refetchType: "active",
        exact: false,
      });
      queryClient.invalidateQueries({
        queryKey: [ACCOUNT_ADJUSTMENT_HISTORY_KEY],
        refetchType: "active",
        exact: false,
      });
      setDeleteScopeModalOpen(false);
      deleteSuccessTimeoutRef.current = setTimeout(() => {
        setTransactionToDelete(null);
      }, 300);
    },
    onError: (error) => {
      console.error("Error deleting transaction:", error);
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

  const handleEditRow = (transaction: IndexTransaction) => {
    if (transaction.hasLoanPayment) {
      toast.error(
        "This transaction is linked to a loan payment and cannot be edited. Edit the loan payment instead.",
      );
      return;
    }
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
      queryKey: [ACCOUNT_DETAIL_TRANSACTIONS_KEY],
      refetchType: "active",
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: [ACCOUNT_ADJUSTMENT_HISTORY_KEY],
      refetchType: "active",
      exact: false,
    });
    mainQuery.refetch();
    adjustmentQuery.refetch();
  };

  const handleDeleteRow = (id: string) => {
    let transaction: IndexTransaction | null = null;
    if (mainQuery.data?.pages) {
      for (const page of mainQuery.data.pages) {
        const found = page.transactions.find((t) => t.id === id);
        if (found) {
          transaction = found;
          break;
        }
      }
    }

    if (transaction?.hasLoanPayment) {
      toast.error(
        "This transaction is linked to a loan payment and cannot be deleted. Delete the loan payment instead.",
      );
      return;
    }

    setTransactionToDelete(transaction);
    setDeleteScopeModalOpen(true);
  };

  const handleDeleteConfirm = (scope: Scope) => {
    if (transactionToDelete) {
      deleteMutation.mutate({
        id: transactionToDelete.id,
        deleteScope: scope as DeleteScope,
        transactionType: transactionToDelete.type,
      });
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

  const handleApplyFilters = () => {
    setAppliedStart(draftStart);
    setAppliedEnd(draftEnd);
    setAppliedCategory(
      draftCategory === ALL_CATEGORIES_VALUE ? "" : draftCategory,
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
    const next = getWideAccountHistoryDateRange();
    setFilterBaseline(next);
    setAppliedStart(next.startDate);
    setAppliedEnd(next.endDate);
    setDraftStart(next.startDate);
    setDraftEnd(next.endDate);
    setAppliedCategory("");
    setDraftCategory(ALL_CATEGORIES_VALUE);
    setAppliedMin(0);
    setAppliedMax(999999);
    setDraftMin("");
    setDraftMax("");
    setSearchInput("");
    setAppliedSearch("");
    setRangeSelected({
      from: new Date(next.startDate),
      to: new Date(next.endDate),
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

  const currencyCode = account?.balanceCurrency ?? "PHP";

  const renderFiltersTrigger = (wrapperClassName: string) => (
    <div className={cn("relative", wrapperClassName)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="rounded-lg border-muted-foreground/25 bg-white text-foreground hover:bg-muted/60"
        onClick={openFiltersSheet}
        aria-label="Open transaction filters"
      >
        <Filter className="h-4 w-4" aria-hidden />
      </Button>
      {hasActiveFilters ? (
        <span
          className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full border-2 border-white bg-red-500"
          aria-hidden
        />
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
    <div className="max-w-3xl mx-auto px-2 pb-24 md:pb-8 space-y-6">
      <Link
        href="/dashboard/space_settings/accounts"
        className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        Accounts
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-primary truncate">
            {account?.name}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {account?.accountCategory?.replace(/_/g, " ")}
          </p>
          <p
            className={`text-2xl font-semibold mt-2 ${getNumberColor(parseBalance(account?.balance ?? "0"))}`}
          >
            {formatCurrency(parseBalance(account?.balance ?? "0"), currencyCode)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 justify-end flex-shrink-0">
          {renderFiltersTrigger("md:hidden")}
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg border-muted-foreground/25 text-foreground hover:bg-muted/60"
            onClick={() => setEditOpen(true)}
            aria-label="Edit account"
          >
            <SquarePen className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg border-destructive/35 text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete account"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
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
              <div className="space-y-2">
                <Label htmlFor="acct-filter-category">Category</Label>
                <Select value={draftCategory} onValueChange={setDraftCategory}>
                  <SelectTrigger id="acct-filter-category">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CATEGORIES_VALUE}>
                      All categories
                    </SelectItem>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="acct-filter-min">Min amount</Label>
                  <Input
                    id="acct-filter-min"
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={draftMin}
                    onChange={(e) => setDraftMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acct-filter-max">Max amount</Label>
                  <Input
                    id="acct-filter-max"
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

      <div>
        <h2 className="text-lg font-semibold mb-3">Transactions</h2>
        <div className="flex flex-col md:flex-row gap-4 mb-4 md:items-center">
          <div className="relative min-w-0 flex-1 w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <Input
              placeholder="Search Transactions"
              className="w-full bg-white pl-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setAppliedSearch(searchInput.trim());
                }
              }}
              onBlur={() => setAppliedSearch(searchInput.trim())}
            />
          </div>
          <div
            className={cn(
              "flex shrink-0 flex-wrap items-center justify-end gap-2 self-end w-full md:ml-auto md:w-auto md:self-center md:flex-nowrap",
              !hasNonSpaceCurrencyInLoadedTransactions && "hidden md:flex",
            )}
          >
            {renderFiltersTrigger("hidden md:block shrink-0")}
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
          totalsCurrency={spaceCurrency}
        />

        <ListView
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
        inSeries={transactionToDelete?.inSeries ?? true}
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
