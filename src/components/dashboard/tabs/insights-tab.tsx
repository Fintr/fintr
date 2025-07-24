import { useState } from "react";
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
  Calendar,
  Send,
  LineChart,
  PieChart,
  BarChart3,
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
import { formatCurrency, getUniqueChartColor, resetChartColors } from "@/lib/utils";
import { useMemo, useEffect } from "react";

interface InsightsTabProps {
  filteredTransactions?: any[];
}

// Reset chart colors to ensure consistent colors for mock data
resetChartColors();

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
  { name: "Food", value: 8500, color: getUniqueChartColor("Food"), percentage: "19.54%" },
  { name: "Transportation", value: 3200, color: getUniqueChartColor("Transportation"), percentage: "6.51%" },
  { name: "Entertainment", value: 2800, color: getUniqueChartColor("Entertainment"), percentage: "4.34%" },
  { name: "Utilities", value: 4500, color: getUniqueChartColor("Utilities"), percentage: "13.03%" },
  { name: "Shopping", value: 6200, color: getUniqueChartColor("Shopping"), percentage: "10.86%" },
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

  // Local state for insights tab
  const [filterType, setFilterType] = useState("single");
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [startYear, setStartYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [endYear, setEndYear] = useState(currentYear);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch insights data from API
  const { data: insightsData, isLoading, isError, refetch } = useInsightsData({
    filterType,
    selectedMonth,
    selectedYear,
    startMonth,
    startYear,
    endMonth,
    endYear,
    selectedCategory,
  });

  // Process expense breakdown data to show top 5 categories and group others
  const processedExpenseBreakdown = useMemo(() => {
    const data = insightsData?.expenseBreakdown || categoryExpenseData;

    if (data.length <= 5) {
      return data;
    }

    // Sort data in descending order of value
    const sortedData = [...data].sort((a, b) => b.value - a.value);

    // Take top 5 categories
    const top5 = sortedData.slice(0, 5);

    // Sum up the rest for "Other" category
    const otherValue = sortedData
      .slice(5)
      .reduce((sum, item) => sum + item.value, 0);
    const otherDetails = sortedData.slice(5).map(item => ({
      name: item.name,
      value: item.value,
      percent: item.percentage, // Use percentage as string directly from API
    }));

    return [
      ...top5,
      { 
        name: "Other", 
        value: otherValue, 
        color: getUniqueChartColor("Other"), // Use our color function for "Other" category
        details: otherDetails 
      },
    ];
  }, [insightsData?.expenseBreakdown]);

  // Handle filter application
  const handleApplyFilters = () => {
    refetch();
  };

  return (
    <Card className="col-span-3 border-0 shadow-none bg-background">
      <CardHeader>
        <CardTitle>Monthly Overview</CardTitle>
        <CardDescription>
          Your financial activity for{" "}
          {selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)}{" "}
          {selectedYear}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Insights Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Insights Filters</CardTitle>
            <CardDescription>Customize your insights view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="space-y-2 md:w-1/4">
                <Label>View Type</Label>
                <Select
                  defaultValue="single"
                  onValueChange={(value) => setFilterType(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select view type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Month</SelectItem>
                    <SelectItem value="range">Month Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {filterType === "single" ? (
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
                      <Select
                        defaultValue={startYear}
                        value={startYear}
                        onValueChange={setStartYear}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Year" />
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
                      <Select
                        defaultValue={endYear}
                        value={endYear}
                        onValueChange={setEndYear}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Year" />
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
                  </div>
                </>
              )}

              <div className="space-y-2 md:w-1/4">
                <Label>Category</Label>
                <Select
                  defaultValue="all"
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="transportation">
                      Transportation
                    </SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="shopping">Shopping</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:self-end">
                <Button
                  className="bg-primary hover:bg-primary/80 w-full"
                  onClick={handleApplyFilters}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Apply Filters"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6 border border-primary/10">
          <CardHeader>
            <CardTitle>Insights Summary</CardTitle>
            <CardDescription>
              Overview of your financial performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading insights...</div>
            ) : isError ? (
              <div className="text-center py-8 text-red-500">
                Error loading insights. Please try again.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Income
                  </h4>
                  <div
                    className={`text-2xl font-bold ${(insightsData?.summary?.totalIncome || 0) >= 0 ? "text-[#008080]" : "text-[#800020]"}`}
                  >
                    {formatCurrency(insightsData?.summary?.totalIncome || 0)}
                  </div>
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Total Expenses
                  </h4>
                  <div className="text-2xl font-bold text-[#800020]">
                    {formatCurrency(insightsData?.summary?.totalExpenses || 0)}
                  </div>
                </div>
                <div className="bg-[#f9f7f5] p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-primary/70 mb-1">
                    Net Savings
                  </h4>
                  <div
                    className={`text-2xl font-bold ${(insightsData?.summary?.netSavings || 0) >= 0 ? "text-[#008080]" : "text-[#800020]"}`}
                  >
                    {formatCurrency(insightsData?.summary?.netSavings || 0)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0">
            <CardHeader>
              <CardTitle>Financial Health Score</CardTitle>
              <CardDescription>
                Based on your spending habits and savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading health score...</div>
              ) : (
                <>
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="relative w-40 h-40 mb-4">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-4xl font-bold text-primary">
                          {insightsData?.financialHealth?.score || 78}
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
                          strokeDashoffset={282.7 - (282.7 * (insightsData?.financialHealth?.score || 78) / 100)}
                          transform="rotate(-90 50 50)"
                        />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h3 className="text-lg font-medium text-primary">
                        {insightsData?.financialHealth?.rating || "Good"}
                      </h3>
                      <p className="text-sm text-primary/70 mt-1">
                        {insightsData?.financialHealth?.description || "You're on track to meet your financial goals"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Savings Rate</span>
                      <span className="text-sm font-medium text-green-600">
                        {(insightsData?.financialHealth?.savingsRate.toFixed(2) || 0)}%
                      </span>
                    </div>
                    <Progress
                      value={insightsData?.financialHealth?.savingsRate || 0}
                      className="h-2 bg-gray-200"
                      indicatorClassName="bg-green-600"
                    />

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Debt-to-Income</span>
                      <span className="text-sm font-medium text-yellow-600">
                        {(insightsData?.financialHealth?.debtToIncomeRatio.toFixed(2) || 0)}%
                      </span>
                    </div>
                    <Progress
                      value={insightsData?.financialHealth?.debtToIncomeRatio || 0}
                      className="h-2 bg-gray-200"
                      indicatorClassName="bg-yellow-600"
                    />

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Budget Adherence</span>
                      <span className="text-sm font-medium text-primary">
                        {(insightsData?.financialHealth?.budgetUsage.toFixed(2) || 0)}%
                      </span>
                    </div>
                    <Progress
                      value={insightsData?.financialHealth?.budgetUsage || 0}
                      className="h-2 bg-gray-200"
                      indicatorClassName="bg-primary"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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

                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-start">
                    <div className="bg-green-600 text-white p-2 rounded-full mr-3">
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
                          className="h-2 bg-green-100"
                          indicatorClassName="bg-green-600"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-start">
                    <div className="bg-blue-600 text-white p-2 rounded-full mr-3">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-800 mb-1">
                        Upcoming Bill Reminder
                      </h4>
                      <p className="text-sm text-blue-700">
                        Your electricity bill (approximately ₱4,500 based on
                        previous months) is due in 5 days. Make sure you have
                        sufficient funds in your account.
                      </p>
                      <div className="mt-3 flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 border-blue-300 text-blue-700"
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
        </div>

        {/* Financial Charts Section */}
        <Card className="border-0">
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
                    stroke="#e11d48"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Expenses"
                  />
                  <Line
                    type="monotone"
                    dataKey="savings"
                    stroke="#16a34a"
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Expense Categories Pie Chart */}
          <Card className="border-0">
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
                <div className="text-center py-8">Loading expense breakdown...</div>
              ) : (
                <div className="h-64 w-full">
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
                            // If "Other" category, show detailed breakdown
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

          {/* Weekly Spending Bar Chart */}
          <Card className="border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Weekly Spending
              </CardTitle>
              <CardDescription>Your daily expenses this week</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading weekly spending...</div>
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
        </div>

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
      </CardContent>
    </Card>
  );
};

export default InsightsTab;
