import React, { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, List, Table2, CalendarDays } from "lucide-react";
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
import { Filters, FilterTypes } from "./filters";
import { DownloadButton } from "./buttons/DownloadButton";
import { DeleteButton } from "./buttons/DeleteButton";
import { ViewModeButton } from "./buttons/ViewModeButton";
import { IndexTransaction } from "@/types/transactionTypes";
import EditTransactionDialog from "@/components/dashboard/forms/EditTransactionDialog";
import ScopeModal, { DeleteScope, Scope } from "@/components/dashboard/forms/ScopeModal";
import { deleteTransaction } from "@/services/transactions/mutation";
import { deleteTransfer } from "@/services/transactions/transfers/mutation";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { TransactionTypeEnum } from "@/types/transactionTypes";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { shouldShowV2Features } from "@/lib/utils";

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

  // Default to list view
  const [viewMode, setViewMode] = useState("list");
  const initialFilters = {
    selectedMonth: currentMonth,
    selectedYear: currentYear,
    startMonth: currentMonth,
    startYear: currentYear,
    endMonth: currentMonth,
    endYear: currentYear,
    selectedCategory: "",
    appliedCategory: "",
    queryStartDate: firstDay,
    queryEndDate: lastDay,
    appliedMinAmount: "",
    appliedMaxAmount: "",
    searchQuery: "",
  }
  const [appliedFilters, setAppliedFilters] = useState(initialFilters)
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

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (deleteData: { id: string; deleteScope: DeleteScope; transactionType?: string }) => {
      // Use the appropriate delete function based on transaction type
      if (deleteData.transactionType === TransactionTypeEnum.TRANSFER) {
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
      queryClient.invalidateQueries({
        queryKey: [
          "transactions",
          localStorage.getItem("spaceCode"),
          appliedFilters.queryStartDate,
          appliedFilters.queryEndDate,
        ],
      });
      setEditingCell(null);
      setEditValue("");
    } catch (error) {
      console.error("Error in handleSaveEdit:", error);
    }
  };

  const handleEditRow = (transaction: IndexTransaction) => {
    setSelectedTransaction(transaction);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    // Invalidate queries to refresh the transaction list
    queryClient.invalidateQueries({
      queryKey: [
        "transactions",
        localStorage.getItem("spaceCode"),
        appliedFilters.appliedCategory,
        appliedFilters.queryStartDate,
        appliedFilters.queryEndDate,
        appliedFilters.appliedMinAmount,
        appliedFilters.appliedMaxAmount,
      ],
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

  return (
    <>
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>
              Manage and filter your transaction history
            </CardDescription>
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
          <Filters
            transactionFilterType="range"
            applyFilters={applyFilters}
          />

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search Transactions"
                className="pl-10 bg-white"
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
            <div className="flex items-center justify-between md:justify-start">
              <h3 className="text-lg font-medium mr-2">Transactions</h3>
              <DownloadButton />
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
