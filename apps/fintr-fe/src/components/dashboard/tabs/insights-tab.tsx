import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Target,
  Send,
  LineChart,
  CalendarIcon,
} from "lucide-react";
import { useInsightsQueries } from "@/hooks/async/useInsightsQueries";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import {
  healthScoresFromLocalData,
  periodDaysBetween,
  expenseBreakdownFromTransactions,
  weeklySpendingFromTransactions,
} from "@/services/insights/offline-calculations";
import {
  financialTrendsDateRange,
  monthlySpendingFromBuckets,
} from "@/services/insights/from-monthly-buckets";
import type { InsightsSummary } from "@/services/insights/types";
import { InsightNarrativeCards } from "@/components/dashboard/insights/insight-narrative-cards";
import { InsightMetricCards } from "@/components/dashboard/insights/insight-metric-cards";
import { DashboardSummarySection } from "@/components/dashboard/insights/dashboard-summary-section";
import { ExpenseBreakdownCard } from "@/components/dashboard/insights/expense-breakdown-card";
import { FinancialHealthGauge } from "@/components/dashboard/insights/financial-health-gauge";
import { WeeklySpendingCard } from "@/components/dashboard/insights/weekly-spending-card";
import { ChartTooltipContent } from "@/components/dashboard/insights/chart-tooltip-content";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { formatCurrency, getColor, getColorByIndex, shouldShowV2Features } from "@/lib/utils";
import { useMemo, useEffect, useState } from "react";
import {
  buildTransactionCategoryFields,
  isCategoryPickerId,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import { useAtom, useAtomValue } from "jotai";
import {
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import { CategoryFilterComboBox } from "@/components/ui/category-filter-combobox";
import { DateFilterFields } from "@/components/ui/date-filter-fields";
import { FilterSheet } from "@/components/ui/filter-sheet";
import {
  getCategoryFilterDisplayLabel,
  isExpenseCategoryFilterValue,
  isIncomeCategoryFilterValue,
} from "@/utils/categoryFilterOptions";
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
import { usePresetDateRangeOptions } from "@/hooks/usePresetDateRangeOptions";
import { TagFilterComboBox } from "@/components/ui/tag-filter-combobox";
import { useTransactionTags } from "@/hooks/async/useTransactionTags";
import {
  hasAppliedTagFilters,
  normalizeFilterValues,
} from "@/utils/transactionFilterValues";
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

const InsightsTab = () => {
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("fintr-insights-screen");

    return () => {
      document.documentElement.classList.remove("fintr-insights-screen");
    };
  }, []);

  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();

  // Get API and space context for currency
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const presetOptions = usePresetDateRangeOptions();

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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const { tags: transactionTags } = useTransactionTags();
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const incomeCategoryOptions = useAtomValue(incomeCategoryOptionsAtom);
  
  // Local state for filter type selector (single month vs predefined vs custom)
  const [filterTypeSelector, setFilterTypeSelector] =
    useState<DateFilterTypeSelector>(() =>
      inferDateFilterTypeSelector(startDate, endDate, presetOptions),
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

    return !isDefaultDateRange || selectedCategory !== "all" || hasAppliedTagFilters(selectedTagIds);
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
      const matchedPreset = matchPresetFromDateRange(
        startDate,
        endDate,
        presetOptions,
      );
      if (matchedPreset) {
        setFilterTypeSelector("predefined");
        setSelectedPreset(matchedPreset);
      } else {
        setFilterTypeSelector("custom");
      }
    }
  }, [filterType, presetOptions, startDate, endDate]);

  // Calculate query params from applied date atoms + category/tag filters
  const getInsightsParams = useMemo(() => {
    const categoryFields =
      selectedCategory === "all"
        ? null
        : buildTransactionCategoryFields(
            selectedCategory,
            expenseCategoryOptions,
            incomeCategoryOptions,
          );
    const categoryDisplayName =
      selectedCategory === "all"
        ? ""
        : getCategoryFilterDisplayLabel(
            selectedCategory,
            expenseCategoryOptions,
            incomeCategoryOptions,
          );

    return {
      filterType: filterType === "single" ? "single" : "range",
      selectedMonth: monthYear.selectedMonth,
      selectedYear: monthYear.selectedYear,
      startMonth: monthYear.startMonth,
      startYear: monthYear.startYear,
      endMonth: monthYear.endMonth,
      endYear: monthYear.endYear,
      startDate,
      endDate,
      selectedCategory: selectedCategory === "all" ? "all" : selectedCategory,
      selectedCategoryId: categoryFields?.categoryId ?? null,
      selectedSubcategoryId: categoryFields?.subcategoryId ?? null,
      selectedCategoryName:
        (
          categoryFields?.categoryName
          && categoryFields.categoryName.trim().length > 0
            ? categoryFields.categoryName
            : undefined
        )
        || (
          categoryDisplayName
          && categoryDisplayName.trim().length > 0
          && !isCategoryPickerId(categoryDisplayName)
            ? categoryDisplayName
            : undefined
        ),
      selectedTagIds: normalizeFilterValues(selectedTagIds),
    };
  }, [
    filterType,
    monthYear,
    startDate,
    endDate,
    selectedCategory,
    selectedTagIds,
    expenseCategoryOptions,
    incomeCategoryOptions,
  ]);
  
  const {
    summary,
    narratives,
    healthScores: healthScoresData,
    totalBudget: insightsTotalBudget,
    monthlyDebt: insightsMonthlyDebt,
    expenseBreakdown,
    merchantBreakdown,
    subcategoryBreakdown,
    monthlySpending,
    weeklySpending,
    // accountBreakdown,
    isLoading,
    isError,
    // isAccountLoading,
    isChartsLoading,
    refetch,
  } = useInsightsQueries(getInsightsParams);

  const filterStartDate = useAtomValue(dateFilterStartDateAtom);
  const filterEndDate = useAtomValue(dateFilterEndDateAtom);

  const { data: dashboardData, summaries: dashboardSummaries, periodTransactions: dashboardPeriodTransactions, isLoading: isDashboardLoading } =
    useDashboardData(filterStartDate, filterEndDate);

  const isUnfilteredView =
    selectedCategory === "all" && !hasAppliedTagFilters(selectedTagIds);

  const dashboardSummary = useMemo((): InsightsSummary | undefined => {
    const financialSummary = dashboardData?.financialSummary;
    if (!financialSummary) {
      return undefined;
    }

    return {
      totalIncome: Number.parseFloat(financialSummary.totalIncome) || 0,
      totalExpenses: Number.parseFloat(financialSummary.totalExpenses) || 0,
      netSavings: Number.parseFloat(financialSummary.netSavings) || 0,
    };
  }, [dashboardData?.financialSummary]);

  const displaySummary = isUnfilteredView
    ? dashboardSummary ?? summary
    : summary;

  const displayHealthScores = useMemo(() => {
    if (!displaySummary) {
      return healthScoresData;
    }

    // Always derive health from the same totals shown in Net Income so the
    // gauge cannot stay at 0 / "Good" defaults while chips show real money.
    return healthScoresFromLocalData({
      summary: displaySummary,
      periodDays: periodDaysBetween(startDate, endDate),
      totalBudget: insightsTotalBudget,
      monthlyDebt: insightsMonthlyDebt,
    });
  }, [
    displaySummary,
    healthScoresData,
    insightsTotalBudget,
    insightsMonthlyDebt,
    startDate,
    endDate,
  ]);

  const displayLoading = isUnfilteredView
    ? (!displaySummary && (isLoading || isDashboardLoading))
    : (!displaySummary && isLoading);

  const dashboardExpenseBreakdown = useMemo(() => {
    if (!isUnfilteredView || dashboardPeriodTransactions.length === 0) {
      return [];
    }

    return expenseBreakdownFromTransactions(dashboardPeriodTransactions);
  }, [isUnfilteredView, dashboardPeriodTransactions]);

  const dashboardMonthlySpending = useMemo(() => {
    if (!isUnfilteredView || !dashboardSummaries?.length) {
      return [];
    }

    const trendsRange = financialTrendsDateRange(endDate);
    return monthlySpendingFromBuckets(
      dashboardSummaries,
      trendsRange.startDate,
      trendsRange.endDate,
    ).map((row) => ({
      ...row,
      expenses: -Math.abs(row.expenses),
    }));
  }, [isUnfilteredView, dashboardSummaries, endDate]);

  const dashboardWeeklySpending = useMemo(() => {
    if (!isUnfilteredView) {
      return [];
    }

    return weeklySpendingFromTransactions(
      dashboardPeriodTransactions,
      new Date(),
    );
  }, [isUnfilteredView, dashboardPeriodTransactions]);

  const chartHasSignal = (
    rows: Array<{ income?: number; expenses?: number; savings?: number; amount?: number; value?: number }>,
  ) =>
    rows.some(
      (row) =>
        Math.abs(row.income ?? 0) > 0
        || Math.abs(row.expenses ?? 0) > 0
        || Math.abs(row.savings ?? 0) > 0
        || Math.abs(row.amount ?? 0) > 0
        || Math.abs(row.value ?? 0) > 0,
    );

  const insightsData = {
    summary: displaySummary,
    healthScores: displayHealthScores,
    expenseBreakdown: chartHasSignal(expenseBreakdown)
      ? expenseBreakdown
      : dashboardExpenseBreakdown,
    merchantBreakdown,
    subcategoryBreakdown,
    monthlySpending: chartHasSignal(monthlySpending)
      ? monthlySpending
      : dashboardMonthlySpending,
    weeklySpending: chartHasSignal(weeklySpending)
      ? weeklySpending
      : dashboardWeeklySpending,
  };

  const monthlySpendingChartData = insightsData.monthlySpending;

  // Weekly spending is always "this week" (calendar), so only show it for the current month.
  const showWeeklySpending = useMemo(() => {
    const now = new Date();
    const currentMonth = monthNames[now.getMonth()]?.value;
    const currentYear = String(now.getFullYear());

    if (filterType === "single") {
      return (
        monthYear.selectedMonth === currentMonth &&
        monthYear.selectedYear === currentYear
      );
    }

    return (
      monthYear.startMonth === currentMonth &&
      monthYear.startYear === currentYear &&
      monthYear.endMonth === currentMonth &&
      monthYear.endYear === currentYear
    );
  }, [filterType, monthYear]);

  // Whether we actually have negative savings in the series
  const hasNegativeSavings = useMemo(() => {
    return monthlySpendingChartData.some((item) => (item.savings || 0) < 0);
  }, [monthlySpendingChartData]);

  const financialTrendsSeriesMode = useMemo(() => {
    if (selectedCategory === "all") {
      return "all" as const;
    }

    if (isIncomeCategoryFilterValue(selectedCategory, incomeCategoryOptions)) {
      return "income" as const;
    }

    if (isExpenseCategoryFilterValue(selectedCategory, expenseCategoryOptions)) {
      return "expense" as const;
    }

    return "all" as const;
  }, [selectedCategory, expenseCategoryOptions, incomeCategoryOptions]);

  // Calculate Y-axis domain for bar chart with padding
  const barChartYAxisDomain = useMemo(() => {
    const data = monthlySpendingChartData;

    if (!data || data.length === 0) {
      return [0, 100000];
    }

    const values = data.flatMap((item) => {
      if (financialTrendsSeriesMode === "expense") {
        return [Math.abs(item.expenses) || 0];
      }
      if (financialTrendsSeriesMode === "income") {
        return [item.income || 0];
      }
      return [
        item.income || 0,
        Math.abs(item.expenses) || 0,
        item.savings || 0,
      ];
    });

    const maxValue = Math.max(...values, 0);
    const minValue =
      financialTrendsSeriesMode === "all"
        ? Math.min(...data.map((item) => item.savings || 0))
        : 0;

    const domainMax = maxValue * 1.2 || 100000;
    const domainMin = minValue < 0 ? minValue * 1.1 : 0;

    return [domainMin, domainMax];
  }, [monthlySpendingChartData, financialTrendsSeriesMode]);
  // Calculate Y-axis domain for financial trends chart with padding
  const yAxisDomain = useMemo(() => {
    const data = monthlySpendingChartData;
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
  }, [monthlySpendingChartData]);

  // Process expense breakdown data to show top 5 categories and group others
  const processBreakdownTop5 = (
    data: Array<{
      name: string;
      value: number;
      color?: string;
      percentage?: string;
    }>,
  ) => {
    if (data.length <= 5) {
      return data.map((item, index) => ({
        ...item,
        color: getColorByIndex(index),
      }));
    }

    const sortedData = [...data].sort((a, b) => b.value - a.value);

    const top5 = sortedData.slice(0, 5).map((item, index) => ({
      ...item,
      color: getColorByIndex(index),
    }));

    const otherValue = sortedData
      .slice(5)
      .reduce((sum, item) => sum + item.value, 0);
    const otherDetails = sortedData.slice(5).map((item) => ({
      name: item.name,
      value: item.value,
      percent: item.percentage ?? "",
    }));

    return [
      ...top5,
      {
        name: "Others",
        value: otherValue,
        color: getColorByIndex(5),
        details: otherDetails,
      },
    ];
  };

  const processedExpenseBreakdown = useMemo(() => {
    return processBreakdownTop5(insightsData.expenseBreakdown);
  }, [insightsData.expenseBreakdown]);

  const processedMerchantBreakdown = useMemo(() => {
    return processBreakdownTop5(insightsData?.merchantBreakdown ?? []);
  }, [insightsData?.merchantBreakdown]);

  const processedSubcategoryBreakdown = useMemo(() => {
    return processBreakdownTop5(insightsData?.subcategoryBreakdown ?? []);
  }, [insightsData?.subcategoryBreakdown]);

  const showExpenseCategoryInsights = financialTrendsSeriesMode === "expense";
  const showFinancialHealthScore = !showExpenseCategoryInsights;

  const showSubcategoryExpenseBreakdown = useMemo(() => {
    if (!showExpenseCategoryInsights || selectedCategory === "all") {
      return false;
    }

    const assignment = parseCategoryPickerValue(selectedCategory);
    if (!assignment || assignment.subcategoryId) {
      return false;
    }

    const parent = expenseCategoryOptions.find(
      (option) => option.id === assignment.categoryId,
    );

    return Boolean(parent?.children && parent.children.length > 0);
  }, [
    showExpenseCategoryInsights,
    selectedCategory,
    expenseCategoryOptions,
  ]);
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
        getPresetDateRange(selectedPreset, new Date(), presetOptions);
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
      getPresetDateRange(preset, new Date(), presetOptions);
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
        startDate,
        endDate,
        presetOptions,
      );
      setFilterTypeSelector(inferredType);
      const matchedPreset = matchPresetFromDateRange(
        startDate,
        endDate,
        presetOptions,
      );
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
  }, [filtersOpen, monthYear, filterType, presetOptions, startDate, endDate]);

  const handleResetFilters = () => {
    const { firstDay, lastDay } = getCurrentMonthDates();
    const monthName = currentMonth;

    setFilterTypeSelector("single");
    setSelectedPreset("this_week");
    setSelectedMonth(monthName);
    setSelectedYear(currentYear);
    setSelectedCategory("all");
    setSelectedTagIds([]);
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
      presetOptions,
    });

    setStartDate(queryStartDate);
    setEndDate(queryEndDate);
    setFiltersOpen(false);
    refetch();
  };

  const showV2Features = shouldShowV2Features();

  const getDateFilterLabel = () => {
    if (filterType === "range") {
      const startMonth =
        monthYear.startMonth.charAt(0).toUpperCase() +
        monthYear.startMonth.slice(1);
      const endMonth =
        monthYear.endMonth.charAt(0).toUpperCase() +
        monthYear.endMonth.slice(1);

      if (
        startMonth === endMonth &&
        monthYear.startYear === monthYear.endYear
      ) {
        return `${startMonth} ${monthYear.startYear}`;
      }

      return `${startMonth} ${monthYear.startYear} – ${endMonth} ${monthYear.endYear}`;
    }

    const month =
      monthYear.selectedMonth.charAt(0).toUpperCase() +
      monthYear.selectedMonth.slice(1);
    return `${month} ${monthYear.selectedYear}`;
  };

  const getCategoryFilterLabel = () => {
    if (selectedCategory === "all") {
      return "All categories";
    }

    return (
      getCategoryFilterDisplayLabel(
        selectedCategory,
        expenseCategoryOptions,
        incomeCategoryOptions,
      ) || "Category"
    );
  };

  const getTagFilterLabel = () => {
    if (selectedTagIds.length === 0) {
      return null;
    }

    const names = selectedTagIds
      .map((tagId) => transactionTags.find((tag) => tag.id === tagId)?.name)
      .filter(Boolean) as string[];

    if (names.length === 0) {
      return selectedTagIds.length === 1 ? "1 tag" : `${selectedTagIds.length} tags`;
    }

    if (names.length === 1) {
      return names[0];
    }

    return `${names.length} tags`;
  };

  return (
    <div className="space-y-6 pb-6 md:space-y-8">
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

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagFilterComboBox
              tags={transactionTags}
              placeholder="Search or select tags"
              className="w-full"
              showAllOnFocus={true}
              values={selectedTagIds}
              onValuesChange={setSelectedTagIds}
            />
          </div>
        </FilterSheet>

        <DashboardSummarySection
          summary={displaySummary}
          isLoading={displayLoading}
          isError={isError}
          formatAmount={formatAmount}
          dateFilterLabel={getDateFilterLabel()}
          categoryFilterLabel={getCategoryFilterLabel()}
          tagFilterLabel={getTagFilterLabel()}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        {(displayLoading ||
          (narratives?.metrics?.length ?? 0) > 0 ||
          (narratives?.insights?.length ?? 0) > 0) && (
          <div className="space-y-5">
            <InsightMetricCards
              metrics={narratives?.metrics ?? []}
              isLoading={displayLoading}
              isBusiness={currentSpace?.isOrganization ?? false}
            />

            <div className="px-4">
              <InsightNarrativeCards
                insights={narratives?.insights ?? []}
                isLoading={displayLoading}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 px-4 md:grid-cols-3 md:gap-6 md:px-0">
          {showFinancialHealthScore ? (
            <Card
              className="border border-border/50 bg-card shadow-none max-md:-mr-4 max-md:w-[calc(100%+1rem)]"
              data-tutorial-target="financial-health-score"
            >
              <CardHeader className="px-4">
                <CardTitle>Financial Health Score</CardTitle>
                <CardDescription>
                  Based on your spending habits and savings
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4">
                {displayLoading ? (
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
          ) : null}

          {showV2Features ? (
            <Card className="col-span-2 border border-border/50 bg-card shadow-none">
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
          ) : showExpenseCategoryInsights ? (
            <div className="col-span-1 space-y-5 md:col-span-3">
              {showSubcategoryExpenseBreakdown ? (
                <ExpenseBreakdownCard
                  items={processedSubcategoryBreakdown}
                  isLoading={isLoading || isChartsLoading}
                  formatAmount={formatAmount}
                  title="Subcategory Expense Breakdown"
                  description="How spending in this category is split across its subcategories. Expenses without a subcategory are grouped as Unassigned."
                  testId="subcategory-expense-breakdown"
                  className="col-span-1"
                />
              ) : null}
              <ExpenseBreakdownCard
                items={processedMerchantBreakdown}
                isLoading={isLoading || isChartsLoading}
                formatAmount={formatAmount}
                title="Merchant Expense Breakdown"
                description="Assign merchants on expenses to see this split. Expenses without a merchant are grouped as Unassigned."
                testId="merchant-expense-breakdown"
                className="col-span-1"
              />
            </div>
          ) : (
            <ExpenseBreakdownCard
              items={processedExpenseBreakdown}
              isLoading={isLoading || isChartsLoading}
              formatAmount={formatAmount}
            />
          )}
        </div>

        <Card className="mx-4 border border-border/50 bg-card shadow-none md:mx-0">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary dark:text-primary-dark-mode" />
              Financial Trends
            </CardTitle>
            <CardDescription>
              {financialTrendsSeriesMode === "expense"
                ? "Track your expenses over time for the selected category"
                : financialTrendsSeriesMode === "income"
                  ? "Track your income over time for the selected category"
                  : "Track your income (blue), expenses (red), and net savings (green) over time"}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <div className="h-80 w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 320, height: 320 }}
              >
                <RechartsLineChart
                  data={monthlySpendingChartData.map(item => ({
                    ...item,
                    expensesPositive: Math.abs(item.expenses), // Show expenses as positive for better visibility
                  }))}
                  margin={{ top: 15, right: 16, left: 0, bottom: 15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    stroke="var(--muted-foreground)"
                    style={{ fontSize: "14px" }}
                  />
                  <YAxis
                    hide
                    domain={barChartYAxisDomain}
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
                  {financialTrendsSeriesMode !== "expense" ? (
                    <Line
                      type="monotone"
                      dataKey="income"
                      stroke="#0A3D62"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Income"
                    />
                  ) : null}
                  {financialTrendsSeriesMode !== "income" ? (
                    <Line
                      type="monotone"
                      dataKey="expensesPositive"
                      stroke="oklch(39.6% 0.141 25.723)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Expenses"
                    />
                  ) : null}
                  {financialTrendsSeriesMode === "all" ? (
                    <Line
                      type="monotone"
                      dataKey="savings"
                      stroke="oklch(59.6% 0.145 163.225)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      name="Savings"
                    />
                  ) : null}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {showWeeklySpending ? (
          <WeeklySpendingCard
            data={
              insightsData.weeklySpending.length > 0
                ? insightsData.weeklySpending
                : weeklySpendingData
            }
            isLoading={isLoading || isChartsLoading}
            formatAmount={formatAmount}
          />
        ) : null}

        {/* @ai-context INSIGHTS_ACCOUNT_BREAKDOWN_CARD — hidden; see account-breakdown.tsx to restore */}

        {showV2Features && (
          <Card className="mx-4 mt-2 border border-border/50 bg-card shadow-none md:mx-0">
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
    </div>
  );
};

export default InsightsTab;
