import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Search,
  Check,
  X,
  Calendar,
  FileText,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  CreditCard,
  ArrowLeftRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import useAuthApi from "@/hooks/useAuthApi";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchTransactionsPage } from "@/services/transactions/queries";
import { fetchDashboardData } from "@/services/spaces/queries";
import { IndexTransaction, TransactionsPage } from "@/types/transactionTypes";
import { InfiniteData } from "@tanstack/react-query";
import { ComboBox } from "@/components/ui/combobox";
import { useAtom } from "jotai";
import {
  dashboardDataAtom,
  categoryOptionsAtom,
  accountOptionsAtom,
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import {
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getMonthDateRange,
} from "@/utils/dateUtils";
import { DashboardData } from "@/types/spaceTypes";
import * as z from "zod";
import { TransactionTypeEnum } from "@/types/transactionTypes";

const TransactionsTab = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  // Access and set dashboardData from Jotai atom
  const [dashboardDataFromAtom, setDashboardDataAtomValue] =
    useAtom<DashboardData | null>(dashboardDataAtom);

  // Set up Jotai atoms for dashboard data
  const [categoryOptions, setCategoryOptions] = useAtom(categoryOptionsAtom);
  const [accountOptions, setAccountOptions] = useAtom(accountOptionsAtom);
  const [expenseCategoryOptions, setExpenseCategoryOptions] = useAtom(
    expenseCategoryOptionsAtom
  );
  const [incomeCategoryOptions, setIncomeCategoryOptions] = useAtom(
    incomeCategoryOptionsAtom
  );

  // Get current month's first and last day
  const getCurrentMonthDates = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return {
      firstDay: getFirstDayOfMonth(year, month),
      lastDay: getLastDayOfMonth(year, month),
    };
  };

  const { firstDay, lastDay } = getCurrentMonthDates();
  const [queryStartDate, setQueryStartDate] = useState(firstDay);
  const [queryEndDate, setQueryEndDate] = useState(lastDay);

  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();

  // Get current month number (1-12)
  const currentMonthNumber = new Date().getMonth() + 1;

  // Month names for display in dropdowns
  const monthNames = [
    { value: "january", label: "January" },
    { value: "february", label: "February" },
    { value: "march", label: "March" },
    { value: "april", label: "April" },
    { value: "may", label: "May" },
    { value: "june", label: "June" },
    { value: "july", label: "July" },
    { value: "august", label: "August" },
    { value: "september", label: "September" },
    { value: "october", label: "October" },
    { value: "november", label: "November" },
    { value: "december", label: "December" },
  ];

  // Generate array of years (current year and 4 previous years)
  const getYearOptions = () => {
    const thisYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => (thisYear - i).toString());
  };

  const yearOptions = getYearOptions();

  const [viewMode, setViewMode] = useState("list");
  const [transactionFilterType, setTransactionFilterType] = useState("range");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [startYear, setStartYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [endYear, setEndYear] = useState(currentYear);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [appliedMinAmount, setAppliedMinAmount] = useState("");
  const [appliedMaxAmount, setAppliedMaxAmount] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);
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
  const tableRef = useRef<HTMLTableElement>(null);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    isPending,
    isError,
    isSuccess,
  } = useInfiniteQuery<
    TransactionsPage,
    Error,
    InfiniteData<TransactionsPage>,
    [string, string, string, string, string, string, string],
    number
  >({
    queryKey: [
      "transactions",
      localStorage.getItem("spaceCode"),
      appliedCategory,
      queryStartDate,
      queryEndDate,
      appliedMinAmount,
      appliedMaxAmount,
    ],
    queryFn: ({ pageParam = 1, queryKey }) =>
      fetchTransactionsPage(api, { pageParam, queryKey }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!localStorage.getItem("spaceCode"),
    retry: false,
  });

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard", localStorage.getItem("spaceCode")],
    queryFn: () => fetchDashboardData(api),
    enabled: !!localStorage.getItem("spaceCode"),
  });
  const queryClient = useQueryClient();

  // Update Jotai atoms when dashboard data changes
  useEffect(() => {
    if (dashboardData) {
      // Update the main dashboard data atom
      setDashboardDataAtomValue(dashboardData);

      // Update category options
      if (dashboardData.categoryOptions) {
        setCategoryOptions(dashboardData.categoryOptions);
      }

      // Update account options
      if (dashboardData.accountOptions) {
        setAccountOptions(dashboardData.accountOptions);
      }

      // Update expense category options
      if (dashboardData.expenseCategoryOptions) {
        setExpenseCategoryOptions(dashboardData.expenseCategoryOptions);
      }

      // Update income category options
      if (dashboardData.incomeCategoryOptions) {
        setIncomeCategoryOptions(dashboardData.incomeCategoryOptions);
      }
    }
  }, [
    dashboardData,
    setDashboardDataAtomValue,
    setCategoryOptions,
    setAccountOptions,
    setExpenseCategoryOptions,
    setIncomeCategoryOptions,
  ]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log("[Observer Bottom] Fetching next page...");
          fetchNextPage();
        }
      },
      {
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
      console.log("[Observer Bottom] Observing bottom sentinel:", currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
        console.log("[Observer Bottom] Unobserving bottom sentinel.");
      }
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const applyFilters = () => {
    let filtered = [...allTransactions];

    if (selectedCategory !== "all") {
      filtered = filtered.filter(
        (t) => t.categoryName?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Apply amount filters if they're set
    if (minAmount !== "") {
      const min = parseFloat(minAmount);
      filtered = filtered.filter((t) => t.amount >= min);
    }

    if (maxAmount !== "") {
      const max = parseFloat(maxAmount);
      filtered = filtered.filter((t) => t.amount <= max);
    }

    if (transactionFilterType === "single") {
      const monthMap: { [key: string]: number } = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
      };

      const monthNum = monthMap[selectedMonth];
      const yearNum = parseInt(selectedYear);

      filtered = filtered.filter((t) => {
        const date = new Date(t.date);
        return (
          date.getMonth() + 1 === monthNum && date.getFullYear() === yearNum
        );
      });
    } else if (transactionFilterType === "range") {
      const monthMap: { [key: string]: number } = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
      };

      const startMonthNum = monthMap[startMonth];
      const startYearNum = parseInt(startYear);
      const endMonthNum = monthMap[endMonth];
      const endYearNum = parseInt(endYear);

      const startDate = new Date(startYearNum, startMonthNum - 1, 1);
      const endDate = new Date(endYearNum, endMonthNum, 0);

      filtered = filtered.filter((t) => {
        const date = new Date(t.date);
        return date >= startDate && date <= endDate;
      });
    }

    filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    setFilteredTransactions(filtered);

    // Check if backend filters have changed
    const hasBackendFiltersChanged =
      appliedCategory !== selectedCategory ||
      appliedMinAmount !== minAmount ||
      appliedMaxAmount !== maxAmount ||
      (transactionFilterType === "single" &&
        (getMonthNumber(selectedMonth) !==
          new Date(queryStartDate).getMonth() + 1 ||
          parseInt(selectedYear) !== new Date(queryStartDate).getFullYear())) ||
      (transactionFilterType === "range" &&
        (getMonthNumber(startMonth) !==
          new Date(queryStartDate).getMonth() + 1 ||
          parseInt(startYear) !== new Date(queryStartDate).getFullYear() ||
          getMonthNumber(endMonth) !== new Date(queryEndDate).getMonth() + 1 ||
          parseInt(endYear) !== new Date(queryEndDate).getFullYear()));

    // Update applied category state
    setAppliedCategory(selectedCategory);
    setAppliedMinAmount(minAmount);
    setAppliedMaxAmount(maxAmount);
    setFiltersApplied(true);

    // update backend query dates based on filter selection
    if (transactionFilterType === "single") {
      const m = getMonthNumber(selectedMonth);
      const y = parseInt(selectedYear);
      const newStartDate = getFirstDayOfMonth(y, m);
      const newEndDate = getLastDayOfMonth(y, m);

      if (newStartDate !== queryStartDate || newEndDate !== queryEndDate) {
        setQueryStartDate(newStartDate);
        setQueryEndDate(newEndDate);
      }
    } else {
      const sm = getMonthNumber(startMonth);
      const sy = parseInt(startYear);
      const em = getMonthNumber(endMonth);
      const ey = parseInt(endYear);
      const newStartDate = getFirstDayOfMonth(sy, sm);
      const newEndDate = getLastDayOfMonth(ey, em);

      console.log("New start date:", newStartDate);
      console.log("New end date:", newEndDate);

      if (newStartDate !== queryStartDate || newEndDate !== queryEndDate) {
        setQueryStartDate(newStartDate);
        setQueryEndDate(newEndDate);
      }
    }

    // Only invalidate the query if backend filters have changed
    if (hasBackendFiltersChanged) {
      queryClient.invalidateQueries({
        queryKey: ["transactions", localStorage.getItem("spaceCode")],
      });
    }
  };

  const getMonthNumber = (monthName: string) => {
    const monthMap: { [key: string]: number } = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };
    return monthMap[monthName.toLowerCase()];
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
          queryStartDate,
          queryEndDate,
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

  const resetFilters = () => {
    // Reset filter selections
    setSelectedCategory("all");
    setMinAmount("");
    setMaxAmount("");

    if (transactionFilterType === "single") {
      setSelectedMonth(currentMonth);
      setSelectedYear(currentYear);
    } else {
      setStartMonth(currentMonth);
      setStartYear(currentYear);
      setEndMonth(currentMonth);
      setEndYear(currentYear);
    }

    // Reset to current month dates
    const { firstDay, lastDay } = getCurrentMonthDates();
    setQueryStartDate(firstDay);
    setQueryEndDate(lastDay);
    setAppliedCategory("all");
    setAppliedMinAmount("");
    setAppliedMaxAmount("");
    setFiltersApplied(false);
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
            <Button
              variant="outline"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 ${
                viewMode === "list" ? "bg-primary text-white" : ""
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M8 12h8" />
                <path d="M8 8h8" />
                <path d="M8 16h8" />
              </svg>
              List
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewMode("sheets")}
              className={`flex items-center gap-1 ${
                viewMode === "sheets" ? "bg-primary text-white" : ""
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
                <line x1="15" y1="3" x2="15" y2="21" />
              </svg>
              Sheets
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewMode("calendar")}
              className={`flex items-center gap-1 ${
                viewMode === "calendar" ? "bg-primary text-white" : ""
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <line x1="3" x2="21" y1="9" y2="9" />
                <line x1="9" x2="9" y1="3" y2="21" />
              </svg>
              Calendar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Transaction Filters</CardTitle>
                <CardDescription>
                  Customize your transaction view
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
                Hide Filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              {transactionFilterType === "single" ? (
                <>
                  <div className="space-y-2 md:w-1/4">
                    <Label>Month</Label>
                    <Select
                      defaultValue={selectedMonth}
                      value={selectedMonth}
                      onValueChange={setSelectedMonth}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthNames
                          .filter(
                            (month, index) =>
                              parseInt(selectedYear) !==
                                new Date().getFullYear() ||
                              index < currentMonthNumber
                          )
                          .map((month, idx) => (
                            <SelectItem key={`${month.value}-${idx}`} value={month.value}>
                              {month.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 md:w-1/4">
                    <Label>Year</Label>
                    <Select
                      defaultValue={selectedYear}
                      value={selectedYear}
                      onValueChange={setSelectedYear}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((year, idx) => (
                          <SelectItem key={`${year}-${idx}`} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2 md:w-1/4">
                    <Label>Start Month & Year</Label>
                    <div className="flex space-x-2">
                      <Select
                        defaultValue={startMonth}
                        value={startMonth}
                        onValueChange={setStartMonth}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Start Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthNames
                            .filter(
                              (month, index) =>
                                parseInt(startYear) !==
                                  new Date().getFullYear() ||
                                index < currentMonthNumber
                            )
                            .map((month, idx) => (
                              <SelectItem key={`${month.value}-${idx}`} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Select
                        defaultValue={startYear}
                        value={startYear}
                        onValueChange={setStartYear}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year, idx) => (
                            <SelectItem key={`${year}-${idx}`} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 md:w-1/4">
                    <Label>End Month & Year</Label>
                    <div className="flex space-x-2">
                      <Select
                        defaultValue={endMonth}
                        value={endMonth}
                        onValueChange={setEndMonth}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="End Month" />
                        </SelectTrigger>
                        <SelectContent>
                          {monthNames
                            .filter(
                              (month, index) =>
                                parseInt(endYear) !==
                                  new Date().getFullYear() ||
                                index < currentMonthNumber
                            )
                            .map((month, idx) => (
                              <SelectItem key={`${month.value}-${idx}`} value={month.value}>
                                {month.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Select
                        defaultValue={endYear}
                        value={endYear}
                        onValueChange={setEndYear}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                          {yearOptions.map((year, idx) => (
                            <SelectItem key={`${year}-${idx}`} value={year}>
                              {year}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2 md:w-1/4">
                <Label>Categories</Label>
                <div className="relative">
                  <ComboBox
                    filterType="frontend"
                    data={dashboardData?.categoryOptions}
                    placeholder="Select categories"
                    className="w-full"
                    showAllOnFocus={true}
                    value={selectedCategory}
                    onChange={(value) => setSelectedCategory(value)}
                  />
                </div>
              </div>

              <div className="space-y-2 md:w-1/4">
                <Label>Amount Range</Label>
                <div className="flex items-center gap-2">
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₱
                    </span>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full pl-7"
                    />
                  </div>
                  <span className="text-gray-500">-</span>
                  <div className="relative w-full">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                      ₱
                    </span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full pl-7"
                    />
                  </div>
                </div>
              </div>

              <div className="md:self-end flex gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={resetFilters}
                >
                  Reset
                </Button>
                <Button
                  className={`${
                    filtersApplied ? "bg-primary/90" : "bg-primary"
                  } hover:bg-primary/80 w-full flex items-center gap-1`}
                  onClick={applyFilters}
                >
                  {filtersApplied && (
                    <div className="h-2 w-2 rounded-full bg-white"></div>
                  )}
                  Apply Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
            <Button variant="outline" className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
              Download
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-1 text-red-500 border-red-200 hover:bg-red-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Delete
            </Button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="space-y-4 bg-white rounded-lg overflow-hidden p-4">
            {isPending && <div>Loading initial transactions...</div>}
            {isError && (
              <div className="text-red-500">Error: {error.message}</div>
            )}
            {isSuccess && data && (
              <>
                {(() => {
                  let lastDisplayedMonthYear: string | null = null;
                  return data.pages.map((page, pageIndex) => (
                    <React.Fragment key={`page-${pageIndex}`}>
                      {page.transactions.map(
                        (transaction: IndexTransaction, idx: number) => {
                          const transactionDate = new Date(transaction.date);
                          const currentMonthYear = `${transactionDate.toLocaleString(
                            "default",
                            { month: "long" }
                          )} ${transactionDate.getFullYear()}`;
                          let showDivider = false;

                          if (currentMonthYear !== lastDisplayedMonthYear) {
                            showDivider = true;
                            lastDisplayedMonthYear = currentMonthYear;
                          }

                          return (
                            <React.Fragment key={`${transaction.id}-${idx}`}>
                              {showDivider && (
                                <div
                                  key={`divider-${currentMonthYear}`}
                                  className="flex items-center my-4"
                                >
                                  <div className="flex-grow border-t border-gray-300" />
                                  <span className="px-2 text-sm font-semibold text-primary">
                                    {currentMonthYear}
                                  </span>
                                  <div className="flex-grow border-t border-gray-300" />
                                </div>
                              )}
                              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="flex w-full">
                                  <div
                                    className={`w-2 self-stretch rounded-l-lg mr-4 ${
                                      transaction.type ===
                                      TransactionTypeEnum.INCOME
                                        ? "bg-emerald-500"
                                        : transaction.type ===
                                          TransactionTypeEnum.EXPENSE
                                        ? "bg-red-500"
                                        : "bg-blue-500"
                                    }`}
                                  ></div>
                                  <div className="flex-1">
                                    <p className="font-medium text-primary flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-gray-500" />
                                      {transaction.description}
                                    </p>
                                    <p className="text-sm text-primary/70 flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-gray-500" />
                                      {new Date(
                                        transaction.date
                                      ).toLocaleDateString()}
                                    </p>
                                    <p className="text-sm text-primary/70 flex items-center gap-2">
                                      <Tag className="h-4 w-4 text-gray-500" />
                                      {transaction.categoryName}
                                    </p>
                                    <div className="flex flex-col sm:flex-row sm:gap-4">
                                      {transaction.fromAccountName && (
                                        <>
                                          <p className="text-sm text-primary/70 flex items-center gap-2">
                                            <ArrowUpRight className="h-4 w-4 text-gray-500" />
                                            From: {transaction.fromAccountName}
                                          </p>
                                        </>
                                      )}
                                      {transaction.toAccountName && (
                                        <>
                                          <p className="text-sm text-primary/70 flex items-center gap-2">
                                            <ArrowDownLeft className="h-4 w-4 text-gray-500" />
                                            To: {transaction.toAccountName}
                                          </p>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 mt-4 lg:mt-0">
                                  <span
                                    className={`font-medium flex items-center gap-1 ${
                                      transaction.type ===
                                      TransactionTypeEnum.INCOME
                                        ? "text-emerald-600"
                                        : transaction.type ===
                                          TransactionTypeEnum.EXPENSE
                                        ? "text-red-600"
                                        : "text-blue-600"
                                    }`}
                                  >
                                    <DollarSign className="h-4 w-4" />
                                    {transaction.amount > 0 ? "+" : ""}
                                    {formatCurrency(transaction.amount)}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${
                                      transaction.type ===
                                      TransactionTypeEnum.INCOME
                                        ? "bg-emerald-100 text-emerald-800"
                                        : transaction.type ===
                                          TransactionTypeEnum.EXPENSE
                                        ? "bg-red-100 text-red-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {transaction.type ===
                                      TransactionTypeEnum.INCOME && (
                                      <ArrowUpRight className="h-3 w-3" />
                                    )}
                                    {transaction.type ===
                                      TransactionTypeEnum.EXPENSE && (
                                      <ArrowDownLeft className="h-3 w-3" />
                                    )}
                                    {transaction.type ===
                                      TransactionTypeEnum.TRANSFER && (
                                      <ArrowLeftRight className="h-3 w-3" />
                                    )}
                                    {transaction.type}
                                  </span>
                                  <div className="flex space-x-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-primary"
                                      onClick={() => handleEditRow(transaction)}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                                      onClick={() =>
                                        handleDeleteRow(transaction.id)
                                      }
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        }
                      )}
                    </React.Fragment>
                  ));
                })()}
                <div ref={loadMoreRef} style={{ height: "10px" }} />
              </>
            )}
            {isSuccess &&
              (!data ||
                data.pages.every((p) => p.transactions.length === 0)) && (
                <div className="text-center py-8 text-gray-500">
                  No transactions found
                </div>
              )}
            {isFetchingNextPage && (
              <div className="text-center py-4">Loading more...</div>
            )}
            {!hasNextPage &&
              isSuccess &&
              data &&
              !data.pages.every((p) => p.transactions.length === 0) && (
                <div className="text-center py-4 text-gray-400">
                  No more transactions
                </div>
              )}
          </div>
        ) : viewMode === "sheets" ? (
          <div className="mt-4">
            <div className="bg-white rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full" ref={tableRef} tabIndex={0}>
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPending && (
                      <tr>
                        <td colSpan={5} className="text-center p-4">
                          Loading...
                        </td>
                      </tr>
                    )}
                    {isError && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center p-4 text-red-500"
                        >
                          Error: {error.message}
                        </td>
                      </tr>
                    )}
                    {isSuccess &&
                      data?.pages
                        .flatMap((page) => page.transactions)
                        .map((transaction: IndexTransaction, index) => (
                          <tr
                            key={transaction.id}
                            className={
                              index % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                            data-transaction-id={transaction.id}
                          >
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {editingCell?.id === transaction.id &&
                              editingCell?.field === "date" ? (
                                <div className="flex items-center">
                                  <Input
                                    ref={editInputRef}
                                    type="date"
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      handleKeyDown(e, transaction, "date")
                                    }
                                    className="h-7 py-1 px-2 text-sm"
                                    autoFocus
                                  />
                                  <div className="flex ml-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleSaveEdit(transaction.id, "date")
                                      }
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => setEditingCell(null)}
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`cursor-pointer px-2 py-1 rounded ${
                                    selectedCell?.id === transaction.id &&
                                    selectedCell?.field === "date"
                                      ? "bg-blue-100 outline-2 outline-blue-500"
                                      : "hover:bg-gray-100"
                                  }`}
                                  onClick={() =>
                                    handleCellClick(
                                      transaction.id,
                                      "date",
                                      transaction.date
                                    )
                                  }
                                  onDoubleClick={() =>
                                    handleCellDoubleClick(
                                      transaction.id,
                                      "date",
                                      transaction.date
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, transaction, "date")
                                  }
                                >
                                  {new Date(
                                    transaction.date
                                  ).toLocaleDateString()}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {editingCell?.id === transaction.id &&
                              editingCell?.field === "description" ? (
                                <div className="flex items-center">
                                  <Input
                                    ref={editInputRef}
                                    type="text"
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      handleKeyDown(
                                        e,
                                        transaction,
                                        "description"
                                      )
                                    }
                                    className="h-7 py-1 px-2 text-sm"
                                    autoFocus
                                  />
                                  <div className="flex ml-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleSaveEdit(
                                          transaction.id,
                                          "description"
                                        )
                                      }
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => setEditingCell(null)}
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`cursor-pointer px-2 py-1 rounded ${
                                    selectedCell?.id === transaction.id &&
                                    selectedCell?.field === "description"
                                      ? "bg-blue-100 outline outline-2 outline-blue-500"
                                      : "hover:bg-gray-100"
                                  }`}
                                  onClick={() =>
                                    handleCellClick(
                                      transaction.id,
                                      "description",
                                      transaction.description
                                    )
                                  }
                                  onDoubleClick={() =>
                                    handleCellDoubleClick(
                                      transaction.id,
                                      "description",
                                      transaction.description
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, transaction, "description")
                                  }
                                >
                                  {transaction.description}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              {editingCell?.id === transaction.id &&
                              editingCell?.field === "category" ? (
                                <div className="flex items-center">
                                  <Select
                                    value={editValue}
                                    onValueChange={(value) => {
                                      setEditValue(value);
                                      handleSaveEdit(
                                        transaction.id,
                                        "category"
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="h-7 py-1 px-2 text-sm">
                                      <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="food">Food</SelectItem>
                                      <SelectItem value="transportation">
                                        Transportation
                                      </SelectItem>
                                      <SelectItem value="utilities">
                                        Utilities
                                      </SelectItem>
                                      <SelectItem value="entertainment">
                                        Entertainment
                                      </SelectItem>
                                      <SelectItem value="shopping">
                                        Shopping
                                      </SelectItem>
                                      <SelectItem value="house">
                                        House
                                      </SelectItem>
                                      <SelectItem value="income">
                                        Income
                                      </SelectItem>
                                      <SelectItem value="expense">
                                        Expense
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 ml-1"
                                    onClick={() => setEditingCell(null)}
                                  >
                                    <X className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <div
                                  className={`cursor-pointer px-2 py-1 rounded ${
                                    selectedCell?.id === transaction.id &&
                                    selectedCell?.field === "category"
                                      ? "bg-blue-100 outline outline-2 outline-blue-500"
                                      : "hover:bg-gray-100"
                                  }`}
                                  onClick={() =>
                                    handleCellClick(
                                      transaction.id,
                                      "category",
                                      transaction.categoryName
                                    )
                                  }
                                  onDoubleClick={() =>
                                    handleCellDoubleClick(
                                      transaction.id,
                                      "category",
                                      transaction.categoryName
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, transaction, "category")
                                  }
                                >
                                  {transaction.categoryName}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                              {editingCell?.id === transaction.id &&
                              editingCell?.field === "amount" ? (
                                <div className="flex items-center">
                                  <Input
                                    ref={editInputRef}
                                    type="number"
                                    value={editValue}
                                    onChange={(e) =>
                                      setEditValue(e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      handleKeyDown(e, transaction, "amount")
                                    }
                                    className="h-7 py-1 px-2 text-sm"
                                    autoFocus
                                  />
                                  <div className="flex ml-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() =>
                                        handleSaveEdit(transaction.id, "amount")
                                      }
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6"
                                      onClick={() => setEditingCell(null)}
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className={`cursor-pointer px-2 py-1 rounded ${
                                    selectedCell?.id === transaction.id &&
                                    selectedCell?.field === "amount"
                                      ? "bg-blue-100 outline outline-2 outline-blue-500"
                                      : "hover:bg-gray-100"
                                  }`}
                                  onClick={() =>
                                    handleCellClick(
                                      transaction.id,
                                      "amount",
                                      transaction.amount.toString()
                                    )
                                  }
                                  onDoubleClick={() =>
                                    handleCellDoubleClick(
                                      transaction.id,
                                      "amount",
                                      transaction.amount.toString()
                                    )
                                  }
                                  onKeyDown={(e) =>
                                    handleKeyDown(e, transaction, "amount")
                                  }
                                  style={{
                                    color:
                                      transaction.amount > 0
                                        ? "#16a34a"
                                        : "#dc2626",
                                  }}
                                >
                                  {transaction.amount > 0 ? "+" : ""}
                                  {formatCurrency(transaction.amount)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-primary"
                                  onClick={() => handleEditRow(transaction)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() =>
                                    handleDeleteRow(transaction.id)
                                  }
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : viewMode === "calendar" ? (
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-sm font-medium text-primary">
                  {day}
                </div>
              ))}
            </div>
            {isPending && <div className="text-center p-4">Loading...</div>}
            {isError && (
              <div className="text-center p-4 text-red-500">
                Error: {error.message}
              </div>
            )}
            {isSuccess && (
              <div className="text-center p-4 text-gray-500">
                Calendar view needs update for infinite data structure.
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default TransactionsTab;
