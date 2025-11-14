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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  MessageSquare,
  Target,
  Send,
  LineChart,
  PieChart,
  BarChart3,
  Filter,
} from "lucide-react";
import { useInsightsData } from "@/hooks/async/useInsightsData";
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
  BarChart as RechartsBarChart,
  Bar,
} from "recharts";
import { formatCurrency, getColor, getColorByIndex, shouldShowV2Features } from "@/lib/utils";
import { useMemo, useEffect, useState } from "react";
import { useAtom } from "jotai";
import LoadingSpinner from "@/components/ui/loading-spinner";
import ScoreTag from "@/components/ui/score-tag";
import AccountBreakdownComponent from "@/components/dashboard/account-breakdown";
import {
  dateFilterStartDateAtom,
  dateFilterEndDateAtom,
  dateFilterMonthYearAtom,
  dateFilterTypeAtom,
  monthYearToDateRange,
} from "@/atoms/dateFilterAtoms";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { getCurrentMonthDates } from "@/utils/dateUtils";

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
  const [showFilters, setShowFilters] = useState(false);
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentYear = new Date().getFullYear().toString();


  // Generate dynamic year options for the select dropdowns
  const generateYearOptions = () => {
    const year = new Date().getFullYear();
    const years = [];
    // Show current year, 1 future year, and 4 past years
    for (let i = year + 1; i >= year - 4; i--) {
      years.push({ value: i.toString(), label: i.toString() });
    }
    return years;
  };
  const yearOptions = generateYearOptions();

  // Use shared date filter atoms
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  const [filterType] = useAtom(dateFilterTypeAtom);
  const [startDate, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [endDate, setEndDate] = useAtom(dateFilterEndDateAtom);
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Local state for filter type selector (single month vs custom)
  const [filterTypeSelector, setFilterTypeSelector] = useState<"single" | "custom">(() => {
    return filterType === "single" ? "single" : "custom";
  });
  
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
  
  // Local state synced with atoms
  const [selectedMonth, setSelectedMonth] = useState(monthYear.selectedMonth);
  const [selectedYear, setSelectedYear] = useState(monthYear.selectedYear);
  
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
      setFilterTypeSelector("custom");
    }
  }, [filterType]);

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
        selectedCategory: "all",
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
        selectedCategory: "all",
      };
    }
  }, [filterType, monthYear]);
  
  // Fetch insights data from API
  const { data: insightsData, isLoading, isError, refetch } = useInsightsData(getInsightsParams);

  // Process expense breakdown data to show top 5 categories and group others
  const processedExpenseBreakdown = useMemo(() => {
    const data = insightsData?.expenseBreakdown || categoryExpenseData;
    
    console.log('Raw expense breakdown data:', data);
    console.log('Insights data:', insightsData);

    if (data.length <= 5) {
      const result = data.map((item, index) => ({
        ...item,
        color: getColorByIndex(index), // Ensure all items have colors
      }));
      console.log('Processed expense breakdown (≤5 items):', result);
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
    console.log('Processed expense breakdown (>5 items):', result);
    return result;
  }, [insightsData?.expenseBreakdown]);

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
      const monthNames = [
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
      ];
      const monthName = monthNames[currentMonthNum - 1];
      setSelectedMonth(monthName);
      setSelectedYear(currentYearNum.toString());
      setDateRange({
        from: new Date(firstDay),
        to: new Date(lastDay),
      });
    } else {
      // When switching to custom, initialize date range picker with current dates
      if (startDate && endDate) {
        setDateRange({
          from: new Date(startDate),
          to: new Date(endDate),
        });
      }
    }
  };
  
  // Handle filter application - update date atoms first
  const handleApplyFilters = () => {
    let queryStartDate: string;
    let queryEndDate: string;
    
    if (filterTypeSelector === "single") {
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
    
    // Update atoms
    setStartDate(queryStartDate);
    setEndDate(queryEndDate);
    refetch();
  };

  const showV2Features = shouldShowV2Features();

  return (
    <Card className="col-span-3 border-0 shadow-none bg-background">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Monthly Overview</CardTitle>
          <CardDescription>
            Your financial activity for{" "}
            {selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)}{" "}
            {selectedYear}
          </CardDescription>
        </div>
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
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Insights Filters */}
        {showFilters && (
          <Card className="mb-6">
            <CardHeader className="px-4">
              <CardTitle>Dashboard Filters</CardTitle> 
              <CardDescription>Customize your dashboard view</CardDescription>
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
                          defaultValue={selectedMonth}
                          value={selectedMonth}
                          onValueChange={(value) => {
                            setSelectedMonth(value);
                            // Don't update date atoms immediately - wait for Apply Filters button
                          }}
                        >
                          <SelectTrigger className="w-full md:w-[160px]">
                            <SelectValue placeholder="Select month" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="january">January</SelectItem>
                            <SelectItem value="february">February</SelectItem>
                            <SelectItem value="march">March</SelectItem>
                            <SelectItem value="april">April</SelectItem>
                            <SelectItem value="may">May</SelectItem>
                            <SelectItem value="june">June</SelectItem>
                            <SelectItem value="july">July</SelectItem>
                            <SelectItem value="august">August</SelectItem>
                            <SelectItem value="september">September</SelectItem>
                            <SelectItem value="october">October</SelectItem>
                            <SelectItem value="november">November</SelectItem>
                            <SelectItem value="december">December</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:w-auto md:min-w-[120px]">
                        <Label>Year</Label>
                        <Select
                          defaultValue={selectedYear}
                          value={selectedYear}
                          onValueChange={(value) => {
                            setSelectedYear(value);
                            // Don't update date atoms immediately - wait for Apply Filters button
                          }}
                        >
                          <SelectTrigger className="w-full md:w-[120px]">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((year) => (
                              <SelectItem key={year.value} value={year.value}>
                                {year.label}
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
                    {isLoading ? <LoadingSpinner size="small" className="mr-2" /> : "Apply Filters"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border border-primary/10">
          <CardHeader className="px-4">
            {/* Insights Summary */}
            <CardTitle>Dashboard Summary</CardTitle>
            <CardDescription>
              Overview of your financial performance
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            {isLoading ? (
              <div className="text-center py-8">
                <LoadingSpinner size="medium" />
              </div>
            ) : isError ? (
              <div className="text-center py-8 bg-red-800">
                Error loading insights. Please try again.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Income
                  </h4>
                  <div
                    className={`text-2xl font-bold ${(insightsData?.summary?.totalIncome || 0) >= 0 ? "text-teal-600" : "text-red-900"}`}
                  >
                    {formatCurrency(insightsData?.summary?.totalIncome || 0)}
                  </div>
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Expenses
                  </h4>
                  <div className="text-2xl font-bold text-red-900">
                    {formatCurrency(insightsData?.summary?.totalExpenses || 0)}
                  </div>
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Net Savings
                  </h4>
                  <div
                    className={`text-2xl font-bold ${(insightsData?.summary?.netSavings || 0) >= 0 ? "text-teal-600" : "text-red-900"}`}
                  >
                    {formatCurrency(insightsData?.summary?.netSavings || 0)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-6 md:gap-6">
          <Card className="border-0">
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
                    <div className="relative w-40 h-40 mb-4">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-4xl font-bold text-primary">
                          {insightsData?.healthScores?.score || 0}
                        </div>
                      </div>
                      <svg
                        className="w-full h-full"
                        viewBox="0 0 100 100"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="10"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          stroke="#0A3D62"
                          strokeWidth="10"
                          strokeDasharray="282.7"
                          strokeDashoffset={282.7 - (282.7 * (insightsData?.healthScores?.score || 0) / 100)}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    </div>
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
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Savings Rate</span>
                      <ScoreTag
                        percentage={insightsData?.healthScores?.savingsPercentage?.percentage || "0%"}
                        score={insightsData?.healthScores?.savingsPercentage?.score || 0}
                        color="bg-teal-600"
                      />
                    </div>
                    <Progress
                      value={insightsData?.healthScores?.savingsPercentage?.score || 0}
                      className="h-2 bg-gray-200"
                      indicatorClassName="bg-teal-600"
                    />

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Budget Usage</span>
                      <ScoreTag
                        percentage={insightsData?.healthScores?.budgetUsage?.percentage || "0%"}
                        score={insightsData?.healthScores?.budgetUsage?.score || 0}
                        color="bg-primary"
                      />
                    </div>
                    <Progress
                      value={insightsData?.healthScores?.budgetUsage?.score || 0}
                      className="h-2 bg-gray-200"
                      indicatorClassName="bg-primary"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {showV2Features ? (
            <Card className="col-span-2 border-0">
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
            <Card className="col-span-2 border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Expense Breakdown
                </CardTitle>
                <CardDescription>
                  How your expenses are distributed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <LoadingSpinner size="medium" />
                  </div>
                ) : processedExpenseBreakdown.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No expense data available</p>
                  </div>
                ) : (
                  <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={processedExpenseBreakdown} // Use processed data
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {processedExpenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number, name: string, props: any) => {
                            if (name === "Other" && props.payload.details) {
                              return (
                                <div>
                                  {formatCurrency(value)}<br/>
                                 {props.payload.details.map((detail: { name: string; value: number; percent: string; }) => (
                                    <div key={detail.name}>
                                      {detail.name}: {formatCurrency(detail.value)} ({detail.percent.includes('%') ? detail.percent : `${detail.percent}%`})
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return formatCurrency(value);
                          }}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Account Breakdown */}
        <AccountBreakdownComponent 
          data={insightsData?.accountBreakdown || { totalBalance: 0, breakdown: [] }} 
          isLoading={isLoading}
        />

        <Card className="border-0 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              Financial Trends
            </CardTitle>
            <CardDescription>
              Your income and expenses over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart
                  data={insightsData?.monthlySpending || monthlyFinancialData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888888" />
                  <YAxis stroke="#888888" />
                  <RechartsTooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Month: ${label}`}
                  />
                  <Legend />
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
                    dataKey="expenses"
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
          </CardContent>
        </Card>

        <Card className="border-0 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Weekly Spending
            </CardTitle>
            <CardDescription>Your daily expenses this week</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="day" stroke="#888888" />
                    <YAxis stroke="#888888" />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#0A3D62"
                      name="Spending"
                      radius={[4, 4, 0, 0]}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {showV2Features && (
          <Card className="mt-6 border-0">
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
  );
};

export default InsightsTab;
