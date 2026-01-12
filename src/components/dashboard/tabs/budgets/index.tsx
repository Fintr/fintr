import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Trash2, Filter } from "lucide-react";
import { transformBudgetsToCategories } from "@/services/budgets/queries";
import { z } from "zod";
import { formatCurrency, getProgressColor } from "@/lib/utils";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { NewBudgetDialog } from "./new-budget-dialog";
import { EditBudgetDialog } from "./edit-budget-dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { DeleteButton } from "../transactions/buttons/DeleteButton";
import { useAtom } from "jotai";
import { dateFilterStartDateAtom, dateFilterEndDateAtom, dateFilterMonthYearAtom, monthYearToDateRange } from "@/atoms/dateFilterAtoms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { monthNames, getYearOptions, getCurrentMonthDates } from "@/utils/dateUtils";
import { useAuthApi } from "@/hooks/useAuthApi";

interface BudgetsTabProps {}

const BudgetsTab = ({}: BudgetsTabProps) => {
  // Budget state
  const [showFilters, setShowFilters] = useState(false);
  
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  // Use shared date filter atoms
  const [startDate, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [endDate, setEndDate] = useAtom(dateFilterEndDateAtom);
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  
  const yearOptions = getYearOptions();
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentMonthNumber = new Date().getMonth() + 1;
  
  // Local state for filter type selector (single month vs custom)
  const [filterTypeSelector, setFilterTypeSelector] = useState<"single" | "custom">("single");
  
  // Local state for custom date range picker
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined } | undefined>(() => {
    if (startDate && endDate) {
      return {
        from: new Date(startDate),
        to: new Date(endDate),
      };
    }
    return undefined;
  });
  
  // Local state for month/year selection
  const [selectedMonth, setSelectedMonth] = useState(monthYear.selectedMonth);
  const [selectedYear, setSelectedYear] = useState(monthYear.selectedYear);
  
  // Applied date range for fetching budgets
  const [appliedStartDate, setAppliedStartDate] = useState<string>(startDate);
  const [appliedEndDate, setAppliedEndDate] = useState<string>(endDate);
  
  // Check if any filters are active (beyond default date range)
  const hasActiveFilters = () => {
    const { firstDay, lastDay } = getCurrentMonthDates();
    const isDefaultDateRange = appliedStartDate === firstDay && appliedEndDate === lastDay;
    
    return !isDefaultDateRange;
  };
  
  // Sync local state with atoms - only when filter type is single or on initial mount
  useEffect(() => {
    setSelectedMonth(monthYear.selectedMonth);
    setSelectedYear(monthYear.selectedYear);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    // Only sync dateRange from atoms if we're in single month mode
    // In custom mode, let the user control the date range picker
    if (filterTypeSelector === "single" && startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    }
  }, [monthYear, startDate, endDate, filterTypeSelector]);
  
  // Format the selected month/year for display
  const getFormattedDate = () => {
    if (filterTypeSelector === "single") {
      return selectedMonth && selectedYear
        ? `${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} ${selectedYear}`
        : "Select month";
    } else {
      // For custom range, show the date range or the earliest month if it spans multiple months
      if (dateRange?.from && dateRange?.to) {
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        const fromMonth = fromDate.getMonth();
        const fromYear = fromDate.getFullYear();
        const toMonth = toDate.getMonth();
        const toYear = toDate.getFullYear();
        
        // If spans multiple months, show the range
        if (fromYear !== toYear || fromMonth !== toMonth) {
          const fromMonthName = monthNames[fromMonth].label;
          const toMonthName = monthNames[toMonth].label;
          return `${fromMonthName} ${fromYear} - ${toMonthName} ${toYear}`;
        } else {
          // Same month, show the month name
          const monthName = monthNames[fromMonth].label;
          return `${monthName} ${fromYear}`;
        }
      } else if (dateRange?.from) {
        const fromDate = new Date(dateRange.from);
        const monthName = monthNames[fromDate.getMonth()].label;
        return `${monthName} ${fromDate.getFullYear()}`;
      }
      return "Select date range";
    }
  };
  
  const formattedDate = getFormattedDate();

  const {
    data: budgetsData,
    isLoading,
    isError,
    updateBudgetMutation,
    createBudgetMutation,
    deleteBudgetMutation
  } = useBudgetsData(appliedStartDate, appliedEndDate);

  // Calculate budget stats
  const budgetSummary = budgetsData?.summary;
  const totalBudget = budgetSummary?.total_budget ?? 0;
  const totalSpent = budgetSummary?.total_spent ?? 0;
  const totalRemaining = budgetSummary?.remaining ?? 0;
  // Provide a fallback for total_spent_percentage if it's null and totalBudget is 0 to avoid NaN
  const budgetUsagePercentage =
    budgetSummary?.total_spent_percentage ??
    (totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0);
  const isOverBudget = budgetUsagePercentage > 100;
  // Ensure formattedBudgetPercentage is not NaN if budgetUsagePercentage is NaN (e.g. 0/0)
  const formattedBudgetPercentage = Number(
    isNaN(budgetUsagePercentage) ? 0 : budgetUsagePercentage
  ).toFixed(1);
  const categories = budgetsData?.budgets
    ? transformBudgetsToCategories(budgetsData.budgets)
    : [];

  // Handle month change
  const handleMonthChange = (value: string) => {
    setSelectedMonth(value);
    // Don't update date atoms immediately - wait for Apply Filters button
  };

  // Handle year change
  const handleYearChange = (value: string) => {
    setSelectedYear(value);
    // Don't update date atoms immediately - wait for Apply Filters button
  };
  
  // Handle custom date range selection
  const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      const updatedRange: { from: Date | undefined; to: Date | undefined } = {
        from: range.from,
        to: range.to,
      };
      setDateRange(updatedRange);
      // Don't update date atoms immediately - wait for Apply Filters button
    } else {
      setDateRange(undefined);
    }
  };
  
  // Handle filter type selector change
  const handleFilterTypeChange = (value: "single" | "custom") => {
    setFilterTypeSelector(value);
    if (value === "single") {
      // Reset local state to current month when switching to single
      const { firstDay, lastDay } = getCurrentMonthDates();
      const currentMonthNum = new Date().getMonth() + 1;
      const currentYearNum = new Date().getFullYear();
      const monthName = monthNames[currentMonthNum - 1].value;
      setSelectedMonth(monthName);
      setSelectedYear(currentYearNum.toString());
      setDateRange({
        from: new Date(firstDay),
        to: new Date(lastDay),
      });
    } else {
      // When switching to custom, initialize date range picker with current applied dates
      // or leave it undefined if user wants to select fresh
      if (appliedStartDate && appliedEndDate) {
        setDateRange({
          from: new Date(appliedStartDate),
          to: new Date(appliedEndDate),
        });
      } else {
        // If no applied dates, initialize with current month
        const { firstDay, lastDay } = getCurrentMonthDates();
        setDateRange({
          from: new Date(firstDay),
          to: new Date(lastDay),
        });
      }
    }
  };

  // Handle applying filters
  const handleApplyFilters = () => {
    let queryStartDate: string;
    let queryEndDate: string;
    
    if (filterTypeSelector === "single") {
      // For single month filter, use selectedMonth and selectedYear
      const dateRange = monthYearToDateRange(
        selectedMonth,
        selectedYear,
        selectedMonth,
        selectedYear
      );
      queryStartDate = dateRange.startDate;
      queryEndDate = dateRange.endDate;
    } else {
      // For custom range filter, use dateRange picker
      if (dateRange?.from && dateRange?.to) {
        queryStartDate = format(dateRange.from, "yyyy-MM-dd");
        queryEndDate = format(dateRange.to, "yyyy-MM-dd");
      } else if (dateRange?.from) {
        // If only from is selected, use the same date for both
        queryStartDate = format(dateRange.from, "yyyy-MM-dd");
        queryEndDate = format(dateRange.from, "yyyy-MM-dd");
      } else {
        // Fallback to current dates if nothing is selected
        const { firstDay, lastDay } = getCurrentMonthDates();
        queryStartDate = firstDay;
        queryEndDate = lastDay;
      }
    }
    
    setAppliedStartDate(queryStartDate);
    setAppliedEndDate(queryEndDate);
    setStartDate(queryStartDate);
    setEndDate(queryEndDate);
  };

  // Handle budget deletion
  const handleDeleteBudget = (index: number) => {
    deleteBudgetMutation.mutate(categories[index].id);
  };

  return (
    <Card className="border-0 shadow-none bg-transparent py-0 md:py-4 overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between overflow-visible">
        <div>
          <CardTitle>Monthly Budget</CardTitle>
          <CardDescription>
            Track your spending against budget limits for {formattedDate}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 bg-white text-primary"
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
          <NewBudgetDialog
            budgetsData={budgetsData}
            createBudgetMutation={createBudgetMutation}
            api={api}
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Budget Filters */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader className="px-4">
              <CardTitle>Budget Filters</CardTitle>
              <CardDescription>Customize your budget view</CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex flex-col md:flex-row gap-4 flex-1">
                  {/* Filter Type Selector */}
                  <div className="space-y-2 md:w-auto md:min-w-[180px]">
                    <Label>Filter Type</Label>
                    <Select
                      value={filterTypeSelector}
                      onValueChange={(value) => handleFilterTypeChange(value as "single" | "custom")}
                    >
                      <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Select filter type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single Month</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filterTypeSelector === "single" ? (
                    <>
                      <div className="space-y-2 md:w-auto md:min-w-[160px]">
                        <Label>Month</Label>
                        <Select
                          value={selectedMonth}
                          onValueChange={handleMonthChange}
                        >
                          <SelectTrigger className="w-full md:w-[160px]">
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
                                <SelectItem
                                  key={`${month.value}-${idx}`}
                                  value={month.value}
                                >
                                  {month.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:w-auto md:min-w-[120px]">
                        <Label>Year</Label>
                        <Select
                          value={selectedYear}
                          onValueChange={handleYearChange}
                        >
                          <SelectTrigger className="w-full md:w-[120px]">
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
                    <div className="space-y-2 md:w-auto md:min-w-[280px]">
                      <Label>Date Range</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full md:w-[280px] justify-start text-left font-normal text-sm"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "MMM d, yyyy")} -{" "}
                                  {format(dateRange.to, "MMM d, yyyy")}
                                </>
                              ) : (
                                format(dateRange.from, "MMM d, yyyy")
                              )
                            ) : (
                              <span>Pick a date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={handleDateRangeSelect}
                            initialFocus
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>

                <div className="md:self-end md:ml-auto">
                  <Button
                    className="bg-primary hover:bg-primary/80 w-full md:w-auto"
                    onClick={handleApplyFilters}
                    disabled={isLoading}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Budget Summary */}
        <Card className="mb-6">
          <CardHeader className="px-4">
            <CardTitle>Budget Summary</CardTitle>
            <CardDescription>Overview of your budget status</CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {isError ? (
              <div className="py-4 text-center text-red-900">
                Error loading budget data. Please try again.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Budget
                  </h4>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(totalBudget)}
                  </div>
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Spent
                  </h4>
                  <div className="flex items-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(totalSpent)}
                    </div>
                    <div className={`ml-2 text-sm font-medium ${getProgressColor(budgetUsagePercentage, "font")}`}>
                      ({formattedBudgetPercentage}%)
                    </div>
                  </div>
                  <Progress
                    value={budgetUsagePercentage > 100 ? 100 : budgetUsagePercentage}
                    className="h-2 mt-2 bg-gray-200"
                    indicatorClassName={getProgressColor(budgetUsagePercentage, "bg")}
                  />
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Remaining
                  </h4>
                  <div className={`text-2xl font-bold text-primary ${getProgressColor(budgetUsagePercentage, "font")}`}>
                    {formatCurrency(totalRemaining)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {isLoading ? (
            <div className="py-4 text-center">
              <LoadingSpinner size="medium" />
            </div>
          ) : (
            categories.map((category, index) => {
              // Calculate percentage for each budget item
              let budgetPercentage: number;
              let isItemOverBudget: boolean;

              if (category.budget > 0) {
                budgetPercentage = (category.spent / category.budget) * 100;
                isItemOverBudget = category.spent > category.budget;
              } else {
                // category.budget is 0 or less
                if (category.spent > 0) {
                  budgetPercentage = 100; // Fill the bar completely as it's over the zero budget
                  isItemOverBudget = true; // Clearly over budget
                } else {
                  budgetPercentage = 0; // 0 spent, 0 budget
                  isItemOverBudget = false;
                }
              }
              const formattedItemPercentage = budgetPercentage.toFixed(1);

              return (
                <div
                  key={index}
                  className="p-4 border rounded-lg space-y-4 bg-white"
                >
                  <div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-2">
                      <div className="flex items-center justify-between w-full md:w-auto">
                        <h3 className="font-medium text-primary truncate max-w-[200px] md:max-w-[300px]">
                          {category.name}
                        </h3>
                        <div className="flex space-x-2 md:hidden">
                          <EditBudgetDialog
                            budget={category}
                            updateBudgetMutation={updateBudgetMutation}
                          />
                          <DeleteButton
                            onClick={() => handleDeleteBudget(index)}
                          />
                        </div>
                      </div>
                      
                      <div className="mt-2 md:mt-0 flex items-center justify-between md:justify-end w-full">
                        <div className="text-sm font-medium md:mr-4">
                          <span
                            className={
                              isItemOverBudget
                                ? "text-[oklch(39.6% 0.141 25.723)]"
                                : "text-primary"
                            }
                          >
                            {formatCurrency(category.spent)}
                          </span>
                          <span className="text-primary/70">
                            {" "}
                            / {formatCurrency(category.budget)}
                          </span>
                          <span className={`ml-2 ${getProgressColor(budgetPercentage, "font")}`}>
                            ({formattedItemPercentage}%)
                          </span>
                        </div>
                        <div className="hidden md:flex space-x-2">
                          <EditBudgetDialog
                            budget={category}
                            updateBudgetMutation={updateBudgetMutation}
                          />
                          <DeleteButton
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteBudget(index)}
                          />
                          
                        </div>
                      </div>
                    </div>
                    <Progress
                      value={budgetPercentage > 100 ? 100 : budgetPercentage}
                      className="h-2 bg-gray-200"
                      indicatorClassName={
                        getProgressColor(budgetPercentage, "bg")
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BudgetsTab;
