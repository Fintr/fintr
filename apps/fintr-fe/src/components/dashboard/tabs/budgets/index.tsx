import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import {
  enrichCategoriesWithSubcategoryTree,
  transformBudgetsToCategories,
} from "@/services/budgets/queries";
import { BudgetProgress, BudgetUsageBar } from "@/components/dashboard/insights/budget-usage-bar";
import {
  budgetSummaryCardSurfaceClassName,
  statTileSurfaceClassName,
} from "@/components/dashboard/insights/summary-stat-tile";
import { cn, formatCurrency, getProgressColor } from "@/lib/utils";
import { useBudgetsData } from "@/hooks/async/useBudgetsData";
import { NewBudgetDialog } from "./new-budget-dialog";
import { EditBudgetDialog } from "./edit-budget-dialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { DeleteBudgetDialog } from "./delete-budget-dialog";
import { useAtom, useAtomValue } from "jotai";
import { expenseCategoryOptionsAtom } from "@/atoms/dashboardAtoms";
import { dateFilterStartDateAtom, dateFilterEndDateAtom, dateFilterMonthYearAtom, dateFilterTypeAtom } from "@/atoms/dateFilterAtoms";
import { DateFilterFields } from "@/components/ui/date-filter-fields";
import {
  FilterSheet,
  filterActiveBadgeClassName,
  filterTriggerButtonClassName,
} from "@/components/ui/filter-sheet";
import { monthNames, getCurrentMonthDates } from "@/utils/dateUtils";
import {
  DateFilterPresetId,
  DateFilterTypeSelector,
  getPresetDateRange,
  inferDateFilterTypeSelector,
  matchPresetFromDateRange,
} from "@/utils/dateFilterPresets";
import { resolveQueryDateRange } from "@/utils/resolveQueryDateRange";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useSpaceContext } from "@/hooks/useSpaceContext";

interface BudgetsTabProps {}

const BudgetsTab = ({}: BudgetsTabProps) => {
  // Budget state
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  // Get space context for currency
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

  // Use shared date filter atoms
  const [startDate, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [endDate, setEndDate] = useAtom(dateFilterEndDateAtom);
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  const [filterType] = useAtom(dateFilterTypeAtom);
  
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  
  // Local state for filter type selector (single month vs predefined vs custom)
  const [filterTypeSelector, setFilterTypeSelector] =
    useState<DateFilterTypeSelector>(() =>
      inferDateFilterTypeSelector(startDate, endDate),
    );
  const [selectedPreset, setSelectedPreset] =
    useState<DateFilterPresetId>("this_week");
  
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
  const [dateRangePickerOpen, setDateRangePickerOpen] = useState(false);

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
  
  // Sync local state with atoms
  useEffect(() => {
    setSelectedMonth(monthYear.selectedMonth);
    setSelectedYear(monthYear.selectedYear);
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    // Sync dateRange from atoms
    if (startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    }
  }, [monthYear, startDate, endDate]);
  
  // Update filter type selector when filterType changes
  useEffect(() => {
    if (filterType === "single") {
      setFilterTypeSelector("single");
    } else {
      const matchedPreset = matchPresetFromDateRange(startDate, endDate);
      if (matchedPreset) {
        setFilterTypeSelector("predefined");
        setSelectedPreset(matchedPreset);
      } else {
        setFilterTypeSelector("custom");
      }
    }
  }, [filterType, startDate, endDate]);
  
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
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);

  const categories = useMemo(() => {
    if (!budgetsData?.budgets) {
      return [];
    }

    const transformed = transformBudgetsToCategories(budgetsData.budgets);

    return enrichCategoriesWithSubcategoryTree(
      transformed,
      expenseCategoryOptions,
    );
  }, [budgetsData?.budgets, expenseCategoryOptions]);

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
      const hadIncompleteSelection =
        dateRange?.from != null && dateRange?.to == null;
      const nowComplete =
        updatedRange.from != null && updatedRange.to != null;

      setDateRange(updatedRange);

      // With resetOnSelect, the first click after a full range starts a new from;
      // a second click completes { from, to }. Only close after that two-step flow.
      if (hadIncompleteSelection && nowComplete) {
        setDateRangePickerOpen(false);
      }
      // Don't update date atoms immediately - wait for Apply Filters button
    } else {
      setDateRange(undefined);
    }
  };
  
  // Handle filter type selector change
  const handleFilterTypeChange = (value: DateFilterTypeSelector) => {
    setFilterTypeSelector(value);
    if (value === "single") {
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
    } else if (value === "predefined") {
      const { startDate: presetStart, endDate: presetEnd } =
        getPresetDateRange(selectedPreset);
      setDateRange({
        from: new Date(presetStart),
        to: new Date(presetEnd),
      });
    } else if (appliedStartDate && appliedEndDate) {
      setDateRange({
        from: new Date(appliedStartDate),
        to: new Date(appliedEndDate),
      });
    } else {
      const { firstDay, lastDay } = getCurrentMonthDates();
      setDateRange({
        from: new Date(firstDay),
        to: new Date(lastDay),
      });
    }
  };

  const handlePresetChange = (preset: DateFilterPresetId) => {
    setSelectedPreset(preset);
    const { startDate: presetStart, endDate: presetEnd } =
      getPresetDateRange(preset);
    setDateRange({
      from: new Date(presetStart),
      to: new Date(presetEnd),
    });
  };

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setSelectedMonth(monthYear.selectedMonth);
      setSelectedYear(monthYear.selectedYear);
      const inferredType = inferDateFilterTypeSelector(
        appliedStartDate,
        appliedEndDate,
      );
      setFilterTypeSelector(inferredType);
      const matchedPreset = matchPresetFromDateRange(
        appliedStartDate,
        appliedEndDate,
      );
      if (matchedPreset) {
        setSelectedPreset(matchedPreset);
      }

      if (appliedStartDate && appliedEndDate) {
        setDateRange({
          from: new Date(appliedStartDate),
          to: new Date(appliedEndDate),
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [filtersOpen, monthYear, filterType, appliedStartDate, appliedEndDate]);

  const handleResetFilters = () => {
    const { firstDay, lastDay } = getCurrentMonthDates();

    setFilterTypeSelector("single");
    setSelectedPreset("this_week");
    setSelectedMonth(currentMonth);
    setSelectedYear(currentYear);
    setDateRange({
      from: new Date(firstDay),
      to: new Date(lastDay),
    });
    setAppliedStartDate(firstDay);
    setAppliedEndDate(lastDay);
    setStartDate(firstDay);
    setEndDate(lastDay);
    setFiltersOpen(false);
  };

  // Handle applying filters
  const handleApplyFilters = () => {
    const { queryStartDate, queryEndDate } = resolveQueryDateRange({
      filterTypeSelector,
      selectedMonth,
      selectedYear,
      selectedPreset,
      dateRange,
    });

    setAppliedStartDate(queryStartDate);
    setAppliedEndDate(queryEndDate);
    setStartDate(queryStartDate);
    setEndDate(queryEndDate);
    setFiltersOpen(false);
  };

  const handleDeleteBudget = (budgetId: string) =>
    deleteBudgetMutation.mutateAsync(budgetId);

  return (
    <div className="px-2 md:px-0">
    <Card className="border-0 shadow-none bg-transparent px-0 py-0 overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4 overflow-visible pt-2">
        <div>
          <CardTitle>Monthly Budget</CardTitle>
          <CardDescription>
            Track your spending against budget limits for {formattedDate}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setFiltersOpen(true)}
              className={filterTriggerButtonClassName}
              aria-label="Open budget filters"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden md:inline">Filters</span>
            </Button>
            {hasActiveFilters() && (
              <span className={filterActiveBadgeClassName} aria-hidden />
            )}
          </div>
          <NewBudgetDialog
            budgetsData={budgetsData}
            createBudgetMutation={createBudgetMutation}
            api={api}
            budgetMonthDate={appliedStartDate}
          />
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <FilterSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          title="Budget Filters"
          onReset={handleResetFilters}
          onApply={handleApplyFilters}
          applyDisabled={isLoading}
        >
          <DateFilterFields
            filterTypeSelector={filterTypeSelector}
            onFilterTypeChange={handleFilterTypeChange}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={handleMonthChange}
            onYearChange={handleYearChange}
            selectedPreset={selectedPreset}
            onPresetChange={handlePresetChange}
            dateRange={dateRange}
            onDateRangeSelect={handleDateRangeSelect}
            dateRangePickerOpen={dateRangePickerOpen}
            onDateRangePickerOpenChange={setDateRangePickerOpen}
          />
        </FilterSheet>

        {/* Budget Summary */}
        <Card className="mb-6 border-0 shadow-sm">
          <CardHeader className="px-4">
            <CardTitle>Budget Summary</CardTitle>
            <CardDescription>
              Overview of your budget status. Totals use the same rules as
              Dashboard insights for this date range.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {isError ? (
              <div className="py-4 text-center text-red-900">
                Error loading budget data. Please try again.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={statTileSurfaceClassName}>
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Budget
                  </h4>
                  <div className="text-2xl font-bold text-primary">
                    {formatCurrency(totalBudget, spaceCurrency)}
                  </div>
                </div>
                <div className={statTileSurfaceClassName}>
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Spent
                  </h4>
                  <div className="flex items-center">
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(totalSpent, spaceCurrency)}
                    </div>
                    <div className={`ml-2 text-sm font-medium ${getProgressColor(budgetUsagePercentage, "font")}`}>
                      ({formattedBudgetPercentage}%)
                    </div>
                  </div>
                  <BudgetUsageBar
                    usagePercentage={budgetUsagePercentage}
                    className="mt-2"
                    overAmountLabel={
                      isOverBudget
                        ? formatCurrency(Math.abs(totalRemaining), spaceCurrency)
                        : undefined
                    }
                  />
                </div>
                <div className={statTileSurfaceClassName}>
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    {isOverBudget ? "Over budget" : "Remaining"}
                  </h4>
                  <div
                    className={cn(
                      "text-2xl font-bold",
                      getProgressColor(budgetUsagePercentage, "font"),
                    )}
                  >
                    {formatCurrency(totalRemaining, spaceCurrency)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3 rounded-lg overflow-hidden">
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
                  className={cn(budgetSummaryCardSurfaceClassName, "space-y-4 p-5")}
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
                            budgetsData={budgetsData}
                            updateBudgetMutation={updateBudgetMutation}
                            createBudgetMutation={createBudgetMutation}
                            budgetMonthDate={appliedStartDate}
                            spaceCurrency={spaceCurrency}
                          />
                          <DeleteBudgetDialog
                            budget={category}
                            onDelete={handleDeleteBudget}
                            isLoading={deleteBudgetMutation.isPending}
                            currency={spaceCurrency}
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
                            {formatCurrency(category.spent, spaceCurrency)}
                          </span>
                          <span className="text-primary/70">
                            {" "}
                            / {formatCurrency(category.budget, spaceCurrency)}
                          </span>
                          <span className={`ml-2 ${getProgressColor(budgetPercentage, "font")}`}>
                            ({formattedItemPercentage}%)
                          </span>
                        </div>
                        <div className="hidden md:flex space-x-2">
                          <EditBudgetDialog
                            budget={category}
                            budgetsData={budgetsData}
                            updateBudgetMutation={updateBudgetMutation}
                            createBudgetMutation={createBudgetMutation}
                            budgetMonthDate={appliedStartDate}
                            spaceCurrency={spaceCurrency}
                          />
                          <DeleteBudgetDialog
                            budget={category}
                            onDelete={handleDeleteBudget}
                            isLoading={deleteBudgetMutation.isPending}
                            currency={spaceCurrency}
                            variant="ghost"
                            size="icon"
                          />
                          
                        </div>
                      </div>
                    </div>
                    <BudgetProgress
                      usagePercentage={budgetPercentage}
                      className="h-2 bg-gray-200 dark:bg-muted/40"
                    />
                  </div>

                  {category.subcategories.length > 0 && (
                    <div className="space-y-4 border-t pt-3">
                      {(category.parentOnlySpent ?? 0) > 0 && (
                        <div className="space-y-1 pl-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-primary/80">
                              Parent only
                            </span>
                            <span className="text-primary/70">
                              {formatCurrency(
                                category.parentOnlySpent ?? 0,
                                spaceCurrency,
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Expenses in this category without a subcategory
                          </p>
                        </div>
                      )}
                      {category.subcategories.map((sub) => {
                        const subPercentage =
                          sub.budget > 0
                            ? (sub.spent / sub.budget) * 100
                            : sub.spent > 0
                              ? 100
                              : 0;

                        return (
                          <div key={sub.subcategoryId ?? sub.name} className="space-y-1 pl-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-primary/80">
                                {sub.subcategoryName ?? sub.name}
                              </span>
                              <span className="text-primary/70">
                                {formatCurrency(sub.spent, spaceCurrency)}
                                {sub.id ? (
                                  <>
                                    {" / "}
                                    {formatCurrency(sub.budget, spaceCurrency)}
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    {" "}
                                    · No budget set
                                  </span>
                                )}
                              </span>
                            </div>
                            <BudgetProgress
                              usagePercentage={subPercentage}
                              className="h-1.5 bg-gray-100 dark:bg-muted/30"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
};

export default BudgetsTab;
