import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Target,
  Send,
  LineChart,
  PieChart,
  BarChart3,
  Filter,
  Eye,
  CalendarIcon,
} from "lucide-react";
import { useInsightsQueries } from "@/hooks/async/useInsightsQueries";
import { InsightNarrativeCards } from "@/components/dashboard/insights/insight-narrative-cards";
import { InsightMetricCards } from "@/components/dashboard/insights/insight-metric-cards";
import { DashboardSummarySection } from "@/components/dashboard/insights/dashboard-summary-section";
import { ExpenseBreakdownCenterLabel } from "@/components/dashboard/insights/expense-breakdown-center-label";
import { ChartTooltipContent } from "@/components/dashboard/insights/chart-tooltip-content";
import { rechartsTooltipProps } from "@/components/dashboard/insights/recharts-tooltip-props";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Label as RechartsLabel,
  BarChart as RechartsBarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import { formatCurrency, getColor, getColorByIndex, shouldShowV2Features } from "@/lib/utils";
import { useMemo, useEffect, useState } from "react";
import { parseCategoryPickerValue } from "@/types/categoryTreeTypes";
import { useAtom, useAtomValue } from "jotai";
import {
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import { CategoryFilterComboBox } from "@/components/ui/category-filter-combobox";
import { DateFilterFields } from "@/components/ui/date-filter-fields";
import {
  FilterSheet,
  filterActiveBadgeClassName,
  filterTriggerButtonClassName,
} from "@/components/ui/filter-sheet";
import { getCurrentMonthDates, monthNames } from "@/utils/dateUtils";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { HealthScoreFactorRow } from "@/components/dashboard/insights/health-score-factor-row";
// @ai-context INSIGHTS_ACCOUNT_BREAKDOWN_CARD — hidden from Insights tab; restore block below to re-show.
// import AccountBreakdownComponent from "@/components/dashboard/account-breakdown";
import {
  dateFilterStartDateAtom,
  dateFilterEndDateAtom,
  dateFilterMonthYearAtom,
  dateFilterTypeAtom,
} from "@/atoms/dateFilterAtoms";
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

interface InsightsTabProps {
  filteredTransactions?: any[];
}

// Mock data for charts - will be replaced by API data but kept as fallback
const monthlyFinancialData = [
  { month: "Jan", income: 45000, expenses: -32000, savings: 13000 },
  { month: "Feb", income: 48000, expenses: -30000, savings: 18000 },
  { month: "Mar", income: 52000, expenses: -35000, savings: 17000 },
  { month: "Apr", income: 49000, expenses: -38000, savings: 11000 },
  { month: "May", income: 53000, expenses: -33000, savings: 20000 },
  { month: "Jun", income: 55000, expenses: -37000, savings: 18000 },
];

const categoryExpenseData = [
  { name: "Food", value: 8500, color: getColor("categoryExpenseData"), percentage: "19.54%" },
  { name: "Transportation", value: 3200, color: getColor("categoryExpenseData"), percentage: "6.51%" },
  { name: "Entertainment", value: 2800, color: getColor("categoryExpenseData"), percentage: "4.34%" },
  { name: "Utilities", value: 4500, color: getColor("categoryExpenseData"), percentage: "13.03%" },
  { name: "Shopping", value: 6200, color: getColor("categoryExpenseData"), percentage: "10.86%" },
];

const weeklySpendingData = [
  { day: "Mon", amount: 1200 },
  { day: "Tue", amount: 800 },
  { day: "Wed", amount: 1500 },
  { day: "Thu", amount: 950 },
  { day: "Fri", amount: 2200 },
  { day: "Sat", amount: 1800 },
  { day: "Sun", amount: 1100 },
];

const FINANCIAL_HEALTH_GAUGE_CIRCUMFERENCE = 282.7;

const financialHealthGaugeStrokeClass = (score: number): string => {
  if (score >= 80) {
    return "stroke-teal-600";
  }

  return "stroke-[#0A3D62] dark:stroke-[var(--chart-2)]";
};

function FinancialHealthGauge({ score }: { score: number }) {
  return (
    <div className="relative mb-4 h-40 w-40">
      <div className="absolute inset-0 flex items-center justify-center border-0 ring-0 dark:border-0 dark:ring-0">
        <div className="text-4xl font-bold text-primary">{score}</div>
      </div>
      <svg
        className="h-full w-full"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          className="stroke-[#e2e8f0] dark:stroke-transparent"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          className={financialHealthGaugeStrokeClass(score)}
          strokeWidth="10"
          strokeDasharray={FINANCIAL_HEALTH_GAUGE_CIRCUMFERENCE}
          strokeDashoffset={
            FINANCIAL_HEALTH_GAUGE_CIRCUMFERENCE
              - (FINANCIAL_HEALTH_GAUGE_CIRCUMFERENCE * score / 100)
          }
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
}

const InsightsTab = () => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();

  // Get API and space context for currency
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";

  const formatAmount = (amount: number) => {
    let result = formatCurrency(amount, spaceCurrency);
    result = result.replace(/[.,]00$/, "");
    return result;
  };


  // Use shared date filter atoms
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  const [filterType] = useAtom(dateFilterTypeAtom);
  const [startDate, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [endDate, setEndDate] = useAtom(dateFilterEndDateAtom);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const incomeCategoryOptions = useAtomValue(incomeCategoryOptionsAtom);
  const selectedCategoryAssignment = useMemo(
    () =>
      selectedCategory === "all"
        ? null
        : parseCategoryPickerValue(selectedCategory),
    [selectedCategory],
  );
  
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

  // Local state synced with atoms
  const [selectedMonth, setSelectedMonth] = useState(monthYear.selectedMonth);
  const [selectedYear, setSelectedYear] = useState(monthYear.selectedYear);
  
  // Check if any filters are active (beyond default date range)
  const hasActiveFilters = () => {
    const { firstDay, lastDay } = getCurrentMonthDates();
    const isDefaultDateRange = startDate === firstDay && endDate === lastDay;

    return !isDefaultDateRange || selectedCategory !== "all";
  };
  
  // Sync local state with atoms
  useEffect(() => {
    setSelectedMonth(monthYear.selectedMonth);
    setSelectedYear(monthYear.selectedYear);
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

  // Calculate month/year values for API call based on applied filters (from atoms)
  const getInsightsParams = useMemo(() => {
    // Use the applied filter type from atoms
    if (filterType === "single") {
      return {
        filterType: "single",
        selectedMonth: monthYear.selectedMonth,
        selectedYear: monthYear.selectedYear,
        startMonth: monthYear.selectedMonth,
        startYear: monthYear.selectedYear,
        endMonth: monthYear.selectedMonth,
        endYear: monthYear.selectedYear,
        selectedCategory: selectedCategory === "all" ? "all" : selectedCategory,
        selectedCategoryId: selectedCategoryAssignment?.categoryId ?? null,
        selectedSubcategoryId: selectedCategoryAssignment?.subcategoryId ?? null,
      };
    } else {
      // For range, use monthYear from atoms
      return {
        filterType: "range",
        selectedMonth: monthYear.startMonth,
        selectedYear: monthYear.startYear,
        startMonth: monthYear.startMonth,
        startYear: monthYear.startYear,
        endMonth: monthYear.endMonth,
        endYear: monthYear.endYear,
        selectedCategory: selectedCategory === "all" ? "all" : selectedCategory,
        selectedCategoryId: selectedCategoryAssignment?.categoryId ?? null,
        selectedSubcategoryId: selectedCategoryAssignment?.subcategoryId ?? null,
      };
    }
  }, [filterType, monthYear, selectedCategory, selectedCategoryAssignment]);
  
  const {
    summary,
    narratives,
    healthScores: healthScoresData,
    expenseBreakdown,
    monthlySpending,
    weeklySpending,
    // accountBreakdown,
    isLoading,
    isError,
    // isAccountLoading,
    isChartsLoading,
    refetch,
  } = useInsightsQueries(getInsightsParams);

  const insightsData = {
    summary,
    healthScores: healthScoresData,
    expenseBreakdown,
    monthlySpending,
    weeklySpending,
    // accountBreakdown,
  };

  // Calculate Y-axis domain for bar chart with padding
  const barChartYAxisDomain = useMemo(() => {
    const data = insightsData?.monthlySpending || monthlyFinancialData;

    if (!data || data.length === 0) {
      return [0, 100000];
    }

    // Find max and min values across all data points (income, expenses, savings)
    const allValues = data.flatMap(item => [
      item.income || 0,
      Math.abs(item.expenses) || 0, // expenses shown as positive
      item.savings || 0
    ]);

    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...data.map(item => item.savings || 0)); // Check if savings go negative

    // Add 20% padding to the top, and 10% to bottom if there are negative values
    const domainMax = maxValue * 1.2;
    const domainMin = minValue < 0 ? minValue * 1.1 : 0;

    return [domainMin, domainMax];
  }, [insightsData?.monthlySpending]);

  // Whether we actually have negative savings in the series
  const hasNegativeSavings = useMemo(() => {
    const data = insightsData?.monthlySpending || monthlyFinancialData;
    return data.some((item) => (item.savings || 0) < 0);
  }, [insightsData?.monthlySpending]);

  // Calculate Y-axis domain for financial trends chart with padding
  const yAxisDomain = useMemo(() => {
    const data = insightsData?.monthlySpending || monthlyFinancialData;
    if (!data || data.length === 0) {
      return ['auto', 'auto'];
    }
    
    // Collect all values from income, expenses, and savings
    const allValues = data.flatMap(item => [
      item.income || 0,
      item.expenses || 0,
      item.savings || 0
    ]);
    
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    
    // Add 15% padding on both sides to ensure all dots are visible
    const range = maxValue - minValue;
    const padding = range * 0.15 || Math.abs(maxValue) * 0.15 || 1000;
    
    const domainMin = minValue - padding;
    const domainMax = maxValue + padding;
    
    return [domainMin, domainMax];
  }, [insightsData?.monthlySpending]);

  // Process expense breakdown data to show top 5 categories and group others
  const processedExpenseBreakdown = useMemo(() => {
    const data = insightsData?.expenseBreakdown || categoryExpenseData;
    
    if (data.length <= 5) {
      const result = data.map((item, index) => ({
        ...item,
        color: getColorByIndex(index), // Ensure all items have colors
      }));
      return result;
    }

    // Sort data in descending order of value
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    // Take top 5 categories
    const top5 = sortedData.slice(0, 5).map((item, index) => ({
      ...item,
      color: getColorByIndex(index), // Use unique color based on category name
    }));

    // Sum up the rest for "Other" category
    const otherValue = sortedData
      .slice(5)
      .reduce((sum, item) => sum + item.value, 0);
    const otherDetails = sortedData.slice(5).map(item => ({
      name: item.name,
      value: item.value,
      percent: item.percentage, // Use percentage as string directly from API
    }));

    const result = [
      ...top5,
      { 
        name: "Other", 
        value: otherValue, 
        color: getColorByIndex(5), // Use our color function for "Other" category
        details: otherDetails 
      },
    ];
    return result;
  }, [insightsData?.expenseBreakdown]);

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
    } else if (startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
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
      const inferredType = inferDateFilterTypeSelector(startDate, endDate);
      setFilterTypeSelector(inferredType);
      const matchedPreset = matchPresetFromDateRange(startDate, endDate);
      if (matchedPreset) {
        setSelectedPreset(matchedPreset);
      }

      if (startDate && endDate) {
        setDateRange({
          from: new Date(startDate),
          to: new Date(endDate),
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [filtersOpen, monthYear, filterType, startDate, endDate]);

  const handleResetFilters = () => {
    const { firstDay, lastDay } = getCurrentMonthDates();
    const monthName = currentMonth;

    setFilterTypeSelector("single");
    setSelectedPreset("this_week");
    setSelectedMonth(monthName);
    setSelectedYear(currentYear);
    setSelectedCategory("all");
    setDateRange({
      from: new Date(firstDay),
      to: new Date(lastDay),
    });
    setStartDate(firstDay);
    setEndDate(lastDay);
    setFiltersOpen(false);
    refetch();
  };

  // Handle filter application - update date atoms first
  const handleApplyFilters = () => {
    const { queryStartDate, queryEndDate } = resolveQueryDateRange({
      filterTypeSelector,
      selectedMonth,
      selectedYear,
      selectedPreset,
      dateRange,
    });

    setStartDate(queryStartDate);
    setEndDate(queryEndDate);
    setFiltersOpen(false);
    refetch();
  };

  const showV2Features = shouldShowV2Features();

  // Format the description to show selected month/year or date range
  const getDescription = () => {
    if (filterType === "range") {
      const startMonth = monthYear.startMonth.charAt(0).toUpperCase() + monthYear.startMonth.slice(1);
      const endMonth = monthYear.endMonth.charAt(0).toUpperCase() + monthYear.endMonth.slice(1);
      return `Your financial activity for ${startMonth} ${monthYear.startYear} - ${endMonth} ${monthYear.endYear}`;
    } else {
      const month = monthYear.selectedMonth.charAt(0).toUpperCase() + monthYear.selectedMonth.slice(1);
      return `Your financial activity for ${month} ${monthYear.selectedYear}`;
    }
  };

  return (
    <div className="px-2 md:px-0">
    <Card className="col-span-3 gap-8 border-0 shadow-none bg-transparent px-0 py-0 overflow-visible">
      <CardHeader className="flex flex-row items-center justify-between gap-4 overflow-visible pt-2">
        <div>
          <CardTitle>Monthly Overview</CardTitle>
          <CardDescription>
            {getDescription()}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button
              variant="ghost"
              onClick={() => setFiltersOpen(true)}
              className={filterTriggerButtonClassName}
              aria-label="Open dashboard filters"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden md:inline">Filters</span>
            </Button>
            {hasActiveFilters() && (
              <span className={filterActiveBadgeClassName} aria-hidden />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        <FilterSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          title="Dashboard Filters"
          onReset={handleResetFilters}
          onApply={handleApplyFilters}
          applyLoading={isLoading}
        >
          <DateFilterFields
            filterTypeSelector={filterTypeSelector}
            onFilterTypeChange={handleFilterTypeChange}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            onMonthChange={setSelectedMonth}
            onYearChange={setSelectedYear}
            selectedPreset={selectedPreset}
            onPresetChange={handlePresetChange}
            dateRange={dateRange}
            onDateRangeSelect={handleDateRangeSelect}
            dateRangePickerOpen={dateRangePickerOpen}
            onDateRangePickerOpenChange={setDateRangePickerOpen}
          />

          <div className="space-y-2">
            <Label>Categories</Label>
            <CategoryFilterComboBox
              expenseOptions={expenseCategoryOptions}
              incomeOptions={incomeCategoryOptions}
              placeholder="Select categories"
              className="w-full"
              showAllOnFocus={true}
              value={selectedCategory === "all" ? "" : selectedCategory}
              onChange={(value) => setSelectedCategory(value || "all")}
            />
          </div>
        </FilterSheet>

        <DashboardSummarySection
          summary={summary}
          isLoading={isLoading}
          isError={isError}
          formatAmount={formatAmount}
        />

        <InsightMetricCards
          metrics={narratives?.metrics ?? []}
          isLoading={isLoading}
          isBusiness={currentSpace?.isOrganization ?? false}
        />

        <InsightNarrativeCards
          insights={narratives?.insights ?? []}
          isLoading={isLoading}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 md:gap-6">
          <Card className="border-0 shadow-sm" data-tutorial-target="financial-health-score">
            <CardHeader className="px-4">
              <CardTitle>Financial Health Score</CardTitle>
              <CardDescription>
                Based on your spending habits and savings
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              {isLoading ? (
                <div className="text-center py-8">
                  <LoadingSpinner size="medium" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center justify-center py-6">
                    <FinancialHealthGauge
                      score={insightsData?.healthScores?.score || 0}
                    />
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-primary">
                        {insightsData?.healthScores?.rating || "Good"}
                      </h3>
                      <p className="text-sm text-primary/70 mt-1">
                        {insightsData?.healthScores?.description || "You're on track to meet your financial goals"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <HealthScoreFactorRow
                      label="Savings Rate"
                      variant="savings"
                      percentage={
                        insightsData?.healthScores?.savingsPercentage
                          ?.percentage || "0%"
                      }
                      score={
                        insightsData?.healthScores?.savingsPercentage?.score ||
                        0
                      }
                      helpTitle="Savings rate score"
                      calculation={
                        insightsData?.healthScores?.savingsPercentage
                          ?.calculation
                      }
                    />

                    <HealthScoreFactorRow
                      label="Budget Usage"
                      variant="budget"
                      percentage={
                        insightsData?.healthScores?.budgetUsage?.percentage ||
                        "0%"
                      }
                      score={
                        insightsData?.healthScores?.budgetUsage?.score || 0
                      }
                      helpTitle="Budget usage score"
                      calculation={
                        insightsData?.healthScores?.budgetUsage?.calculation
                      }
                    />

                    <HealthScoreFactorRow
                      label="Debt-to-income"
                      variant="debt"
                      percentage={
                        insightsData?.healthScores?.debtToIncomeRatio
                          ?.percentage || "0%"
                      }
                      score={
                        insightsData?.healthScores?.debtToIncomeRatio?.score ||
                        0
                      }
                      helpTitle="Debt-to-income score"
                      calculation={
                        insightsData?.healthScores?.debtToIncomeRatio
                          ?.calculation
                      }
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {showV2Features ? (
            <Card className="col-span-2 border-0 shadow-sm">
              <CardHeader>
                <CardTitle>AI-Powered Insights</CardTitle>
                <CardDescription>
                  Personalized financial recommendations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                    <div className="flex items-start">
                      <div className="bg-primary text-white p-2 rounded-full mr-3">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-primary mb-1">
                          Spending Pattern Detected
                        </h4>
                        <p className="text-sm text-primary/70">
                          You've spent 24% more on dining out this month compared
                          to your 3-month average. Consider setting a specific
                          budget for restaurants to keep your spending in check.
                        </p>
                        <div className="mt-3 flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 border-primary text-primary"
                          >
                            Create Budget
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 border-gray-200 text-gray-500"
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                    <div className="flex items-start">
                      <div className="bg-teal-600 text-white p-2 rounded-full mr-3">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-green-800 mb-1">
                          Savings Goal Progress
                        </h4>
                        <p className="text-sm text-green-700">
                          You're 65% of the way to your emergency fund goal. At
                          your current savings rate, you'll reach your target in
                          approximately 4 months.
                        </p>
                        <div className="mt-2">
                          <div className="flex justify-between items-center text-xs text-green-700 mb-1">
                            <span>₱65,000 saved</span>
                            <span>₱100,000 goal</span>
                          </div>
                          <Progress
                            value={65}
                            className="h-2 bg-teal-200"
                            indicatorClassName="bg-teal-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-start">
                      <div className="bg-blue-600 text-white p-2 rounded-full mr-3">
                        <CalendarIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-800 mb-1">
                          Upcoming Bill Reminder
                        </h4>
                        <p className="text-sm text-blue-900">
                          Your electricity bill (approximately ₱4,500 based on
                          previous months) is due in 5 days. Make sure you have
                          sufficient funds in your account.
                        </p>
                        <div className="mt-3 flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 border-blue-300 text-blue-900"
                          >
                            Schedule Payment
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 border-gray-200 text-gray-500"
                          >
                            Remind Me Later
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="col-span-2 border-0 shadow-sm"
              data-tutorial-target="expense-breakdown"
              data-testid="expense-breakdown"
            >
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Expense Breakdown
                </CardTitle>
                <CardDescription>
                  How your expenses are distributed
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {isLoading || isChartsLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner size="medium" />
                  </div>
                ) : processedExpenseBreakdown.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No expense data available</p>
                  </div>
                ) : (
                  <div
                    className="h-96 w-full"
                    data-testid="expense-breakdown-chart"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart margin={{ bottom: 56 }}>
                        <Pie
                          data={processedExpenseBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          paddingAngle={2}
                          stroke="var(--card)"
                          isAnimationActive={false}
                        >
                          {processedExpenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                          <RechartsLabel
                            position="center"
                            content={(labelRenderProps) => (
                              <ExpenseBreakdownCenterLabel
                                viewBox={labelRenderProps.viewBox}
                                totalLabel={formatAmount(
                                  processedExpenseBreakdown.reduce(
                                    (sum, item) => sum + item.value,
                                    0,
                                  ),
                                )}
                              />
                            )}
                          />
                        </Pie>
                        <RechartsTooltip
                          {...rechartsTooltipProps}
                          formatter={(value: number, name: string, props: any) => {
                            if (name === "Other" && props.payload.details) {
                              return (
                                <div className="text-foreground">
                                  {formatAmount(value)}<br/>
                                 {props.payload.details.map((detail: { name: string; value: number; percent: string; }) => (
                                    <div key={detail.name}>
                                      {detail.name}: {formatAmount(detail.value)} ({detail.percent.includes('%') ? detail.percent : `${detail.percent}%`})
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return formatAmount(value);
                          }}
                          wrapperStyle={{ zIndex: 100 }}
                        />
                        <Legend 
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          iconType="circle"
                          iconSize={10}
                          payload={processedExpenseBreakdown
                            .filter(item => {
                              // Calculate percent from value / total
                              const total = processedExpenseBreakdown.reduce((sum, i) => sum + i.value, 0);
                              const percent = total > 0 ? (item.value / total) * 100 : 0;
                              // Only include items with >= 1%
                              return percent >= 1;
                            })
                            .map(item => {
                              const total = processedExpenseBreakdown.reduce((sum, i) => sum + i.value, 0);
                              const percent = total > 0 ? (item.value / total) * 100 : 0;
                              return {
                                value: `${item.name} (${percent.toFixed(0)}%)`,
                                type: 'circle' as const,
                                color: item.color,
                              };
                            })
                          }
                          wrapperStyle={{ paddingTop: 20 }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Financial Trends
            </CardTitle>
            <CardDescription>
              Track your income (blue), expenses (red), and net savings (green) over time
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart
                  data={(insightsData?.monthlySpending || monthlyFinancialData).map(item => ({
                    ...item,
                    expensesPositive: Math.abs(item.expenses), // Show expenses as positive for better visibility
                  }))}
                  margin={{ top: 15, right: 30, left: 20, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    style={{ fontSize: "14px" }}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    domain={barChartYAxisDomain}
                    tickFormatter={(value) => {
                      // Always include sign for non-zero values; guarantees negatives are explicit
                      const formatted = formatCurrency(Math.abs(value), spaceCurrency).replace(/[.,]00$/, "");
                      return value < 0 ? `-${formatted}` : formatted;
                    }}
                    style={{ fontSize: '12px' }}
                  />
                  <RechartsTooltip
                    cursor={{ stroke: "var(--border)", fill: "var(--muted)" }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(month) => `Month: ${month}`}
                        formatValue={(value) => formatAmount(value)}
                      />
                    }
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#0A3D62"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Income"
                  />
                  <Line
                    type="monotone"
                    dataKey="expensesPositive"
                    stroke="oklch(39.6% 0.141 25.723)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Expenses"
                  />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="oklch(59.6% 0.145 163.225)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Savings"
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
            
            {/* View Details Button */}
            <div className="mt-6 pt-4 border-t flex justify-center">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Eye className="h-4 w-4" />
                    View Monthly Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="!max-w-[90vw] w-[90vw] max-h-[90vh] overflow-y-auto p-8">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-bold">Monthly Financial Breakdown</DialogTitle>
                    <DialogDescription className="text-lg mt-2">
                      Detailed view of your income, expenses, and savings for each month
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-6">
                    {(insightsData?.monthlySpending || monthlyFinancialData).map((item, idx) => (
                      <div key={idx} className="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="text-xl font-bold text-center mb-4 pb-3 border-b">{item.month}</div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground font-medium flex-shrink-0">Earned:</span>
                            <span className="font-bold text-green-600 text-base whitespace-nowrap text-right">{formatAmount(item.income)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-muted-foreground font-medium flex-shrink-0">Spent:</span>
                            <span className="font-bold text-red-900 text-base whitespace-nowrap text-right">{formatAmount(Math.abs(item.expenses))}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-2 border-t">
                            <span className="text-sm text-muted-foreground font-medium flex-shrink-0 flex items-center gap-1.5">
                              Left over:
                              {item.savings < 0 && <span className="text-base">⚠️</span>}
                            </span>
                            <span className={`font-bold text-base whitespace-nowrap text-right ${item.savings < 0 ? 'text-red-900' : 'text-gray-900'}`}>
                              {formatAmount(item.savings)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 px-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Weekly Spending
            </CardTitle>
            <CardDescription>Your daily expenses this week</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading || isChartsLoading ? (
              <div className="text-center py-8">
                <LoadingSpinner size="medium" />
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart
                    data={insightsData?.weeklySpending || weeklySpendingData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                    />
                    <XAxis dataKey="day" stroke="var(--muted-foreground)" />
                    <YAxis stroke="var(--muted-foreground)" />
                    <RechartsTooltip
                      cursor={{ stroke: "var(--border)", fill: "var(--muted)" }}
                      content={
                        <ChartTooltipContent
                          formatValue={(value) => formatAmount(value)}
                        />
                      }
                    />
                    <Bar
                      dataKey="amount"
                      fill="var(--primary-dark-mode)"
                      name="Spending"
                      radius={[4, 4, 0, 0]}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* @ai-context INSIGHTS_ACCOUNT_BREAKDOWN_CARD — Account Breakdown + per-account recent transactions (see account-breakdown.tsx) */}
        {/*
        <AccountBreakdownComponent
          data={insightsData?.accountBreakdown || { totalBalance: 0, breakdown: [] }}
          isLoading={isAccountLoading}
          currencyCode={spaceCurrency}
          transactionsStartDate={startDate}
          transactionsEndDate={endDate}
        />
        */}

        {showV2Features && (
          <Card className="mt-6 border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Fintr Finance Assistant</CardTitle>
              <CardDescription>
                Get personalized help with your financial questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <div className="flex items-start">
                  <div className="bg-primary text-white p-2 rounded-full mr-3">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-primary/70">
                      Hi there! I'm your Fintr Finance Assistant. How can I help
                      you today with your financial goals or questions?
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 relative">
                <Input
                  placeholder="Ask Fintr about your finances..."
                  className="pr-12"
                />
                <Button
                  size="sm"
                  className="absolute right-1 top-1 h-8 w-10 bg-primary hover:bg-primary/80"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
    </div>
  );
};

export default InsightsTab;
