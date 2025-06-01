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

const TransactionsTab = () => {
  const { firstDay, lastDay } = getCurrentMonthDates();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();

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
  }
  const [appliedFilters, setAppliedFilters] = useState(initialFilters)
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
    manualOnly: false,
    loadMoreRef,
  });

  const queryClient = useQueryClient();

  function applyFilters(a: FilterTypes) {
    setAppliedFilters(a)
  }

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

  const handleEditRow = (transaction: any) => {
    console.log("Edit row:", transaction);
    handleCellClick(transaction.id, "description", transaction.description);
  };

  const handleDeleteRow = async (id: string) => {
    try {
      const updatedTransactions = allTransactions.filter((t) => t.id !== id);
      setAllTransactions(updatedTransactions);
      setFilteredTransactions(filteredTransactions.filter((t) => t.id !== id));

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting transaction:", error);
    }
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            Manage and filter your transaction history
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center gap-2">
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
      </CardHeader>
      <CardContent>
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
            />
          </div>
          <div className="flex items-center">
            <h3 className="text-lg font-medium mr-2">Transactions</h3>
          </div>
          <div className="flex items-center gap-2">
            <DownloadButton />
            <DeleteButton />
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
            loadMoreRef={loadMoreRef}
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
            loadMoreRef={loadMoreRef}
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
  );
};

export default TransactionsTab;
