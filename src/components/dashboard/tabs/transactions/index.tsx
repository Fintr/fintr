import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, List, Table2, CalendarDays, Plus, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import { ListView } from "./list-view";
import { SheetsView } from "./sheets-view";
import { CalendarView } from "./calendar-view";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import { useInfiniteTransactions } from "@/hooks/async/useInfiniteTransactions";
import { formatCurrency } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Filters, FilterTypes } from "./filters";
import { DownloadButton } from "./buttons/DownloadButton";
import { DeleteButton } from "./buttons/DeleteButton";
import { ViewModeButton } from "./buttons/ViewModeButton";
import { IndexTransaction, TransactionIndexInputType } from "@/types/transactionTypes";
import EditTransactionDialog from "@/components/dashboard/forms/EditTransactionDialog";
import ScopeModal, { DeleteScope, Scope } from "@/components/dashboard/forms/ScopeModal";
import { deleteTransaction } from "@/services/transactions/mutation";
import { deleteTransfer } from "@/services/transactions/transfers/mutation";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { shouldShowV2Features } from "@/lib/utils";
import AddTransactionDialog from "../../add-transaction-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTransactionsCsv } from "@/services/transactions/queries";
import { toast } from "sonner";
import { useAtom } from "jotai";
import { dateFilterTypeAtom, dateFilterStartDateAtom, dateFilterEndDateAtom, dateFilterMonthYearAtom } from "@/atoms/dateFilterAtoms";

interface TransactionsTabProps {
  // Define any props if needed, but not used in this component
}

const TransactionsTab = ({ }: TransactionsTabProps) => {
  const showV2Features = shouldShowV2Features();
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { firstDay, lastDay } = getCurrentMonthDates();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();

  // Get filter type and dates from shared atoms (automatically determined by date range)
  const [filterType] = useAtom(dateFilterTypeAtom);
  const [startDate] = useAtom(dateFilterStartDateAtom);
  const [endDate] = useAtom(dateFilterEndDateAtom);
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  
  // Fetch dashboard data with date filters
  const { data: dashboardData } = useDashboardData(startDate, endDate);
  
  // Format the description to show selected month/year
  const getDescription = () => {
    if (filterType === "range") {
      const startMonth = monthYear.startMonth.charAt(0).toUpperCase() + monthYear.startMonth.slice(1);
      const endMonth = monthYear.endMonth.charAt(0).toUpperCase() + monthYear.endMonth.slice(1);
      return `Manage and filter your transaction history for ${startMonth} ${monthYear.startYear} - ${endMonth} ${monthYear.endYear}`;
    } else {
      const month = monthYear.selectedMonth.charAt(0).toUpperCase() + monthYear.selectedMonth.slice(1);
      return `Manage and filter your transaction history for ${month} ${monthYear.selectedYear}`;
    }
  };

  // Default to list view
  const [viewMode, setViewMode] = useState("list");
  const [showFilters, setShowFilters] = useState(false);
  
  // Initialize appliedFilters with date filter atoms
  const [appliedFilters, setAppliedFilters] = useState<FilterTypes>(() => ({
    selectedMonth: currentMonth,
    selectedYear: currentYear,
    startMonth: currentMonth,
    startYear: currentYear,
    endMonth: currentMonth,
    endYear: currentYear,
    selectedCategory: "",
    appliedCategory: "",
    queryStartDate: startDate,
    queryEndDate: endDate,
    appliedMinAmount: "",
    appliedMaxAmount: "",
    searchQuery: "",
  }))
  
  // Check if any filters are active (beyond default date range)
  const hasActiveFilters = () => {
    const { firstDay, lastDay } = getCurrentMonthDates();
    const isDefaultDateRange = appliedFilters.queryStartDate === firstDay && appliedFilters.queryEndDate === lastDay;
    
    return (
      !isDefaultDateRange ||
      (appliedFilters.appliedCategory && appliedFilters.appliedCategory !== "" && appliedFilters.appliedCategory !== "all") ||
      appliedFilters.appliedMinAmount !== "" ||
      appliedFilters.appliedMaxAmount !== "" ||
      appliedFilters.searchQuery !== ""
    );
  };
  const [searchInput, setSearchInput] = useState("");
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);

  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: string;
  } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    id: string;
    field: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<IndexTransaction | null>(null);

  // Delete scope modal state
  const [deleteScopeModalOpen, setDeleteScopeModalOpen] = useState(false);
  const [selectedDeleteScope, setSelectedDeleteScope] = useState<DeleteScope>(DeleteScopeEnum.THIS_ONLY);
  const [transactionToDelete, setTransactionToDelete] = useState<IndexTransaction | null>(null);

  // Add transaction dialog state
  const [addTransactionType, setAddTransactionType] = useState<CombinedTransactionTypeEnum>(CombinedTransactionTypeEnum.EXPENSE);
  const [isAddTransactionDialogOpen, setIsAddTransactionDialogOpen] = useState(false);

  const {
    data,
    error,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    isSuccess,
  } = useInfiniteTransactions({
    appliedCategory: appliedFilters.appliedCategory,
    queryStartDate: appliedFilters.queryStartDate,
    queryEndDate: appliedFilters.queryEndDate,
    appliedMinAmount: appliedFilters.appliedMinAmount,
    appliedMaxAmount: appliedFilters.appliedMaxAmount,
    searchQuery: appliedFilters.searchQuery,
    manualOnly: false,
    loadMoreRef,
  });

  const queryClient = useQueryClient();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (deleteData: { id: string; deleteScope: DeleteScope; transactionType?: string }) => {
      // Use the appropriate delete function based on transaction type
      if (deleteData.transactionType === CombinedTransactionTypeEnum.TRANSFER) {
        return deleteTransfer(api, { id: deleteData.id, deleteScope: deleteData.deleteScope });
      } else {
        return deleteTransaction(api, { id: deleteData.id, deleteScope: deleteData.deleteScope });
      }
    },
    onSuccess: () => {
      // Invalidate queries to refresh the transaction list
      queryClient.invalidateQueries({
        queryKey: [
          "transactions",
          spaceCode,
          appliedFilters.appliedCategory,
          appliedFilters.queryStartDate,
          appliedFilters.queryEndDate,
          appliedFilters.appliedMinAmount,
          appliedFilters.appliedMaxAmount,
          appliedFilters.searchQuery,
        ],
      });
      
      // Invalidate dashboard query to refresh financial summary
      queryClient.invalidateQueries({
        queryKey: ["dashboard", spaceCode, startDate, endDate],
      });
      // Invalidate accounts to refresh account balances after delete
      queryClient.invalidateQueries({
        queryKey: ["accounts"],
        refetchType: "active",
      });
      // Invalidate insights query so Insights tab reflects latest stats
      queryClient.invalidateQueries({
        queryKey: ["insights"],
        refetchType: "active",
        exact: false,
      });
      
      setDeleteScopeModalOpen(false);
      // Reset transaction state after a delay to prevent visual glitch
      setTimeout(() => {
        setTransactionToDelete(null);
      }, 300);
    },
    onError: (error) => {
      console.error('Error deleting transaction:', error);
    },
  });

  function applyFilters(a: FilterTypes) {
    setAppliedFilters(a)
  }

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // Apply search filter
  const handleSearch = () => {
    setAppliedFilters(prev => ({
      ...prev,
      searchQuery: searchInput
    }));
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchInput("");
    setAppliedFilters(prev => ({
      ...prev,
      searchQuery: ""
    }));
  };

  // Handle search input blur
  const handleSearchBlur = () => {
    handleSearch();
  };

  const handleCellClick = (id: string, field: string, value: string) => {
    // Find the transaction to check if it's linked to a loan payment
    let transaction: IndexTransaction | null = null;
    if (data?.pages) {
      for (const page of data.pages) {
        const found = page.transactions.find(t => t.id === id);
        if (found) {
          transaction = found;
          break;
        }
      }
    }

    if (transaction?.hasLoanPayment) {
      toast.error("This transaction is linked to a loan payment and cannot be edited. Edit the loan payment instead.");
      return;
    }

    if (selectedCell?.id === id && selectedCell?.field === field) {
      setEditingCell({ id, field });
      setEditValue(value);

      setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
        }
      }, 0);
    } else {
      setSelectedCell({ id, field });
      setEditingCell(null);
    }
  };

  const handleCellDoubleClick = (id: string, field: string, value: string) => {
    // Find the transaction to check if it's linked to a loan payment
    let transaction: IndexTransaction | null = null;
    if (data?.pages) {
      for (const page of data.pages) {
        const found = page.transactions.find(t => t.id === id);
        if (found) {
          transaction = found;
          break;
        }
      }
    }

    if (transaction?.hasLoanPayment) {
      toast.error("This transaction is linked to a loan payment and cannot be edited. Edit the loan payment instead.");
      return;
    }

    setSelectedCell({ id, field });
    setEditingCell({ id, field });
    setEditValue(value);

    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
      }
    }, 0);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    transaction: any,
    field: string
  ) => {
    if (!selectedCell) return;

    const { id } = selectedCell;
    const currentRowIndex = filteredTransactions.findIndex((t) => t.id === id);
    const fields = ["date", "description", "category", "subcategory", "amount"];
    const currentFieldIndex = fields.indexOf(field);

    if (editingCell?.id === id && editingCell?.field === field) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSaveEdit(id, field);

        if (e.key === "Enter") {
          if (currentRowIndex < filteredTransactions.length - 1) {
            const nextTransaction = filteredTransactions[currentRowIndex + 1];
            setSelectedCell({ id: nextTransaction.id, field });
          }
        } else if (e.key === "Tab") {
          if (currentFieldIndex < fields.length - 1) {
            setSelectedCell({ id, field: fields[currentFieldIndex + 1] });
          } else if (currentRowIndex < filteredTransactions.length - 1) {
            const nextTransaction = filteredTransactions[currentRowIndex + 1];
            setSelectedCell({ id: nextTransaction.id, field: fields[0] });
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setEditingCell(null);
      }
      return;
    }

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (currentRowIndex > 0) {
          const prevTransaction = filteredTransactions[currentRowIndex - 1];
          setSelectedCell({ id: prevTransaction.id, field });
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (currentRowIndex < filteredTransactions.length - 1) {
          const nextTransaction = filteredTransactions[currentRowIndex + 1];
          setSelectedCell({ id: nextTransaction.id, field });
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (currentFieldIndex > 0) {
          setSelectedCell({ id, field: fields[currentFieldIndex - 1] });
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        if (currentFieldIndex < fields.length - 1) {
          setSelectedCell({ id, field: fields[currentFieldIndex + 1] });
        }
        break;
      case "Enter":
      case "F2":
        e.preventDefault();
        const transaction = filteredTransactions.find((t) => t.id === id);
        if (transaction) {
          let value = transaction[field];
          if (field === "amount") value = value.toString();
          if (value === null || value === undefined) value = "";
          setEditingCell({ id, field });
          setEditValue(value.toString());
          setTimeout(() => {
            if (editInputRef.current) {
              editInputRef.current.focus();
            }
          }, 0);
        }
        break;
    }
  };

  const handleSaveEdit = async (id: string, field: string) => {
    if (!editingCell) return;

    // Find the transaction to check if it's linked to a loan payment
    let transaction: IndexTransaction | null = null;
    if (data?.pages) {
      for (const page of data.pages) {
        const found = page.transactions.find(t => t.id === id);
        if (found) {
          transaction = found;
          break;
        }
      }
    }

    if (transaction?.hasLoanPayment) {
      toast.error("This transaction is linked to a loan payment and cannot be edited. Edit the loan payment instead.");
      setEditingCell(null);
      setEditValue("");
      return;
    }

    try {
      let value: string | number = editValue;

      if (field === "amount") {
        const parsedValue = parseFloat(editValue);
        value = isNaN(parsedValue) ? 0 : parsedValue;
      }

      const updatePayload = { [field]: value };
      const { data: updateData, error: updateError } = await supabase
        .from("transactions")
        .update(updatePayload)
        .eq("id", id)
        .select();

      if (updateError) {
        console.error("Error saving edit to Supabase:", updateError);
        throw updateError;
      }
      console.log("Update successful:", updateData);
      
      // Use consistent invalidation pattern with all filter parameters
      queryClient.invalidateQueries({
        queryKey: [
          "transactions",
          spaceCode,
          appliedFilters.appliedCategory,
          appliedFilters.queryStartDate,
          appliedFilters.queryEndDate,
          appliedFilters.appliedMinAmount,
          appliedFilters.appliedMaxAmount,
          appliedFilters.searchQuery,
        ],
        refetchType: 'active'
      });
      // Invalidate dashboard, accounts, and insights so summary, balances, and charts refresh
      queryClient.invalidateQueries({
        queryKey: ["dashboard", spaceCode, startDate, endDate],
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
      setEditingCell(null);
      setEditValue("");
    } catch (error) {
      console.error("Error in handleSaveEdit:", error);
    }
  };

  const handleEditRow = (transaction: IndexTransaction) => {
    if (transaction.hasLoanPayment) {
      toast.error("This transaction is linked to a loan payment and cannot be edited. Edit the loan payment instead.");
      return;
    }
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    // Invalidate all transaction list queries (any filters) so the list shows updated data
    queryClient.invalidateQueries({
      queryKey: ["transactions"],
    });

    // Invalidate dashboard and accounts to refresh financial summary and balances
    queryClient.invalidateQueries({
      queryKey: ["dashboard", spaceCode, startDate, endDate],
    });
    queryClient.invalidateQueries({
      queryKey: ["accounts"],
      refetchType: "active",
    });
    // Invalidate insights so Insights tab stays in sync
    queryClient.invalidateQueries({
      queryKey: ["insights"],
      refetchType: "active",
      exact: false,
    });
  };

  const handleEditClose = () => {
    setEditDialogOpen(false);
    setSelectedTransaction(null);
  };

  const handleDeleteRow = (id: string) => {
    // Find the transaction to get its inSeries status
    let transaction: IndexTransaction | null = null;
    if (data?.pages) {
      for (const page of data.pages) {
        const found = page.transactions.find(t => t.id === id);
        if (found) {
          transaction = found;
          break;
        }
      }
    }

    if (transaction?.hasLoanPayment) {
      toast.error("This transaction is linked to a loan payment and cannot be deleted. Delete the loan payment instead.");
      return;
    }

    setTransactionToDelete(transaction);
    
    // Always show modal to prevent accidental deletion
    // For non-series transactions, modal will only show "this_only" option
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
    // Reset transaction state after a delay to prevent visual glitch
    setTimeout(() => {
      setTransactionToDelete(null);
    }, 300);
  };

  const handleDownloadTransactions = async () => {
    try {
      const filterData: Omit<TransactionIndexInputType, 'page'> = {
        spaceCode,
        categoryName: appliedFilters.appliedCategory,
        startDate: appliedFilters.queryStartDate,
        endDate: appliedFilters.queryEndDate,
        minAmount: appliedFilters.appliedMinAmount,
        maxAmount: appliedFilters.appliedMaxAmount,
        searchQuery: appliedFilters.searchQuery,
      };
      await generateTransactionsCsv(api, filterData);
    } catch (error) {
      console.error("Failed to download transactions CSV:", error);
    }
  };

  // Get financial summary data
  const financialSummary = dashboardData?.financialSummary;
  const netSavings = financialSummary?.netSavings ? parseFloat(financialSummary.netSavings) : 0;
  const totalIncome = financialSummary?.totalIncome ? parseFloat(financialSummary.totalIncome) : 0;
  const totalExpenses = financialSummary?.totalExpenses ? parseFloat(financialSummary.totalExpenses) : 0;

  return (
    <>
      {/* Mobile Financial Summary Cards */}
      <div className="px-2 md:px-0 md:hidden mb-4 space-y-4">
        {/* Savings Card */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-6 shadow-lg">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600/20 rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <p className="text-gray-400 text-md mb-2">Savings</p>
            <div className="flex items-center justify-between">
              <p className="text-white text-3xl font-bold">
                {spaceCurrency === "PHP" ? `₱${netSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : netSavings.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <Link href="/dashboard/space_settings/accounts">
                <button className="bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors">
                  <ArrowRight className="h-5 w-5 text-white" />
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Income & Expenses Card */}
        <div className="relative overflow-hidden rounded-2xl bg-primary p-6 shadow-lg">
          {/* Decorative shape */}
          <div className="absolute top-0 left-0 w-20 h-20 bg-purple-600/20 rounded-full blur-2xl" />
          
          <div className="relative z-10 grid grid-cols-2 gap-4">
            {/* Income Section */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="h-4 w-4 text-blue-400" />
                <p className="text-gray-400 text-md">Income</p>
              </div>
              <p className="text-white text-2xl font-bold">
                {spaceCurrency === "PHP" ? `₱${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : totalIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Expenses Section */}
            <div className="flex flex-col border-l border-gray-700 pl-4">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownLeft className="h-4 w-4 text-blue-400" />
                <p className="text-gray-400 text-md">Expenses</p>
              </div>
              <p className="text-white text-2xl font-bold">
                {spaceCurrency === "PHP" ? `₱${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-2 md:px-0">
        <Card className="border-0 shadow-none bg-transparent px-0 py-0 overflow-visible">
        <CardHeader className="flex flex-row items-center justify-between gap-4 overflow-visible">
          <div>
            <CardTitle className="hidden md:block">All Transactions</CardTitle>
            <CardDescription className="px-0 md:px-2">
              {getDescription()}
            </CardDescription>
          </div>
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 bg-white"
            >
              <Filter className="h-4 w-4" />
              <div className="hidden md:flex">
                {showFilters ? "Hide" : "Show"} Filters
              </div>
            </Button>
            {hasActiveFilters() && (
              <span className="absolute -top-1.5 -right-1.5 h-3 w-3 bg-red-500 rounded-full border-2 border-white z-50" />
            )}
          </div>
          {shouldShowV2Features() && (
            <div className="flex items-center space-x-2">
              <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row sm:gap-2">
                <ViewModeButton
                  label="List"
                  IconComponent={List}
                  isActive={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                />
                <ViewModeButton
                  label="Sheets"
                  IconComponent={Table2}
                  isActive={viewMode === "sheets"}
                  onClick={() => setViewMode("sheets")}
                  aria-pressed={viewMode === "sheets"}
                />
                <ViewModeButton
                  label="Calendar"
                  IconComponent={CalendarDays}
                  isActive={viewMode === "calendar"}
                  onClick={() => setViewMode("calendar")}
                  aria-pressed={viewMode === "calendar"}
                />
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="px-0">
          {showFilters && (
            <Filters
              transactionFilterType={filterType as "single" | "range"}
              applyFilters={applyFilters}
              isCollapsible={true}
              defaultCollapsed={false}
            />
          )}

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="relative flex-grow w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search Transactions"
                className="pl-10 bg-white w-full"
                value={searchInput}
                onChange={handleSearchChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                onBlur={handleSearchBlur}
              />
            </div>
            <div className="flex items-center justify-end w-full md:w-automd:justify-start">
              <DownloadButton onClick={handleDownloadTransactions} />
            </div>
          </div>

          {viewMode === "list" ? (
            <ListView
              isPending={isFetching}
              isError={isError}
              error={error as Error | null}
              isSuccess={isSuccess}
              data={data}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={!!hasNextPage}
              onRowEdit={handleEditRow}
              onRowDelete={handleDeleteRow}
              loadMoreRef={loadMoreRef as React.RefObject<HTMLDivElement>}
            />
          ) : viewMode === "sheets" ? (
            <SheetsView
              isPending={isFetching}
              isError={isError}
              error={error as Error | null}
              isSuccess={isSuccess}
              data={data}
              onRowEdit={handleEditRow}
              onRowDelete={handleDeleteRow}
              onCellClick={handleCellClick}
              onCellDoubleClick={handleCellDoubleClick}
              onKeyDown={handleKeyDown}
              onSaveEdit={handleSaveEdit}
              loadMoreRef={loadMoreRef as React.RefObject<HTMLDivElement>}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={!!hasNextPage}
            />
          ) : viewMode === "calendar" ? (
            <CalendarView
              isPending={isFetching}
              isError={isError}
              error={error as Error | null}
              isSuccess={isSuccess}
            />
          ) : null}
        </CardContent>
      </Card>
      </div>
      
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
    </>
  );
};

export default TransactionsTab;
