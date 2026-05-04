import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ComboBox from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import {
  getCurrentMonthDates,
  getYearOptions,
  monthNames,
  getMonthNumber,
  getMonthDateRange,
} from "@/utils/dateUtils";
import { useDashboardData } from "@/hooks/async/useDashboardData";
import {
  dateFilterStartDateAtom,
  dateFilterEndDateAtom,
  dateFilterMonthYearAtom,
  dateFilterTypeAtom,
  monthYearToDateRange,
} from "@/atoms/dateFilterAtoms";

export interface FilterTypes {
  selectedMonth: string;
  selectedYear: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  selectedCategory: string;
  appliedCategory: string;
  queryStartDate: string;
  queryEndDate: string;
  appliedMinAmount: string;
  appliedMaxAmount: string;
  searchQuery: string;
}

interface FiltersProps {
  transactionFilterType: "single" | "range";
  applyFilters: (a: FilterTypes) => void;
  isCollapsible?: boolean;
  defaultCollapsed?: boolean;
}
export function Filters({
  transactionFilterType: _transactionFilterType,
  applyFilters,
}: FiltersProps) {
  const { data: dashboardData } = useDashboardData();
  const yearOptions = getYearOptions();
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentMonthNumber = new Date().getMonth() + 1;
  
  // Use shared date filter atoms
  const [startDate, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [endDate, setEndDate] = useAtom(dateFilterEndDateAtom);
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  const [filterType] = useAtom(dateFilterTypeAtom);
  
  // Local state for filter type selector (single month vs custom)
  const [filterTypeSelector, setFilterTypeSelector] = useState<"single" | "custom">(() => {
    // Default to "single" if it's a single month, otherwise "custom"
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
  const [dateRangePickerOpen, setDateRangePickerOpen] = useState(false);
  
  // Sync dateRange with atoms when they change externally
  useEffect(() => {
    if (startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    }
  }, [startDate, endDate]);
  
  // Update filter type selector when filterType changes
  useEffect(() => {
    if (filterType === "single") {
      setFilterTypeSelector("single");
    } else {
      setFilterTypeSelector("custom");
    }
  }, [filterType]);
  
  // Local state for non-date filters
  const [selectedCategory, setSelectedCategory] = useState("");
  const [appliedMinAmount, setAppliedMinAmount] = useState("");
  const [appliedMaxAmount, setAppliedMaxAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sync local month/year state with atoms
  const [filters, setFilters] = useState({
    selectedMonth: monthYear.selectedMonth,
    selectedYear: monthYear.selectedYear,
    startMonth: monthYear.startMonth,
    startYear: monthYear.startYear,
    endMonth: monthYear.endMonth,
    endYear: monthYear.endYear,
  });
  
  // Update local state when atoms change
  useEffect(() => {
    setFilters({
      selectedMonth: monthYear.selectedMonth,
      selectedYear: monthYear.selectedYear,
      startMonth: monthYear.startMonth,
      startYear: monthYear.startYear,
      endMonth: monthYear.endMonth,
      endYear: monthYear.endYear,
    });
  }, [monthYear]);
  
  function handleFilterChange(key: keyof typeof filters, value: string) {
    if (filters[key] === value) return;
    const updatedFilters = { ...filters, [key]: value };
    setFilters(updatedFilters);
    // Don't update date atoms immediately - wait for Apply Filters button
  }
  
  // Handle custom date range selection
  const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      const updatedRange: { from: Date | undefined; to: Date | undefined } = {
        from: range.from,
        to: range.to,
      };
      setDateRange(updatedRange);
      if (updatedRange.from && updatedRange.to) {
        setDateRangePickerOpen(false);
      }
      // Don't update date atoms immediately - wait for Apply Filters button
    } else {
      setDateRange(undefined);
    }
  }
  
  // Handle filter type selector change
  const handleFilterTypeChange = (value: "single" | "custom") => {
    setFilterTypeSelector(value);
    if (value === "single") {
      // Reset local state to current month when switching to single
      const { firstDay, lastDay } = getCurrentMonthDates();
      const currentMonthNum = new Date().getMonth() + 1;
      const currentYearNum = new Date().getFullYear();
      const monthName = monthNames[currentMonthNum - 1].value;
      setFilters({
        selectedMonth: monthName,
        selectedYear: currentYearNum.toString(),
        startMonth: monthName,
        startYear: currentYearNum.toString(),
        endMonth: monthName,
        endYear: currentYearNum.toString(),
      });
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
    // Don't update date atoms immediately - wait for Apply Filters button
  }

  function resetFilters() {
    const { firstDay, lastDay } = getCurrentMonthDates();
    
    // Reset date atoms
    setStartDate(firstDay);
    setEndDate(lastDay);
    
    // Reset filter type selector to single
    setFilterTypeSelector("single");
    
    // Reset date range picker
    setDateRange({
      from: new Date(firstDay),
      to: new Date(lastDay),
    });
    
    // Reset local filters
    setSelectedCategory("all");
    setAppliedMinAmount("");
    setAppliedMaxAmount("");
    setSearchQuery("");
    
    // Apply reset filters
    const resetFiltersData = {
      selectedMonth: currentMonth,
      selectedYear: currentYear,
      startMonth: currentMonth,
      startYear: currentYear,
      endMonth: currentMonth,
      endYear: currentYear,
      selectedCategory: "all",
      appliedCategory: "all",
      queryStartDate: firstDay,
      queryEndDate: lastDay,
      appliedMinAmount: "",
      appliedMaxAmount: "",
      searchQuery: "",
    };

    applyFilters(resetFiltersData);
  }

  return (
    <Card className="mb-6">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Transaction Filters</CardTitle>
              <CardDescription>Customize your transaction view</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={resetFilters}
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
              Reset Filters
            </Button>
          </div>
        </div>
      </CardHeader>
        <CardContent className="px-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Filter Type Selector */}
            <div className="space-y-2 md:flex-1">
              <Label>Filter Type</Label>
              <Select
                value={filterTypeSelector}
                onValueChange={(value) => handleFilterTypeChange(value as "single" | "custom")}
              >
                <SelectTrigger className="w-full">
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
                <div className="space-y-2 md:w-auto md:flex-shrink-0">
                  <Label>Month</Label>
                  <Select
                    defaultValue={filters.selectedMonth}
                    value={filters.selectedMonth}
                    onValueChange={(value) =>
                      handleFilterChange("selectedMonth", value)
                    }
                  >
                    <SelectTrigger className="w-full md:w-auto md:min-w-[150px]">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames
                        .filter(
                          (month, index) =>
                            parseInt(filters.selectedYear) !==
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

                <div className="space-y-2 md:w-auto md:flex-shrink-0">
                  <Label>Year</Label>
                  <Select
                    defaultValue={filters.selectedYear}
                    value={filters.selectedYear}
                    onValueChange={(value) =>
                      handleFilterChange("selectedYear", value)
                    }
                  >
                    <SelectTrigger className="w-full md:w-auto md:min-w-[100px]">
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
              <div className="space-y-2 md:w-auto md:flex-shrink-0">
                <Label>Date Range</Label>
                <Popover
                  open={dateRangePickerOpen}
                  onOpenChange={setDateRangePickerOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full md:w-auto md:min-w-[250px] justify-start text-left font-normal text-sm"
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

            <div className="space-y-2 md:flex-1">
              <Label>Categories</Label>
              <div className="relative">
                <ComboBox
                  filterType="frontend"
                  data={dashboardData?.categoryOptions}
                  placeholder="Select categories"
                  className="w-full"
                  showAllOnFocus={true}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                />
              </div>
            </div>

            <div className="space-y-2 md:flex-1">
              <Label>Amount Range</Label>
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    ₱
                  </span>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={appliedMinAmount}
                    onChange={(e) => setAppliedMinAmount(e.target.value)}
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
                    value={appliedMaxAmount}
                    onChange={(e) => setAppliedMaxAmount(e.target.value)}
                    className="w-full pl-7"
                  />
                </div>
              </div>
            </div>

            <div className="md:self-end flex gap-2">
              <Button
                className={` hover:bg-primary/80 flex-1 flex items-center gap-1`}
                onClick={() => {
                  // Calculate dates based on current filter selection
                  let queryStartDate: string;
                  let queryEndDate: string;

                  if (filterTypeSelector === "single") {
                    // For single month filter, use selectedMonth and selectedYear
                    const { startDate: newStartDate, endDate: newEndDate } = monthYearToDateRange(
                      filters.selectedMonth,
                      filters.selectedYear,
                      filters.selectedMonth,
                      filters.selectedYear
                    );
                    queryStartDate = newStartDate;
                    queryEndDate = newEndDate;
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

                  // Update date atoms
                  setStartDate(queryStartDate);
                  setEndDate(queryEndDate);

                  // Create the updated filters object with calculated dates
                  const updatedFilters = {
                    ...filters,
                    queryStartDate,
                    queryEndDate,
                    selectedCategory,
                    appliedCategory: selectedCategory,
                    appliedMinAmount,
                    appliedMaxAmount,
                    searchQuery,
                  };

                  applyFilters(updatedFilters);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
    </Card>
  );
}

// Alternative floating filter button component
export function FloatingFilterButton({
  transactionFilterType,
  applyFilters,
  children,
}: {
  transactionFilterType: "single" | "range";
  applyFilters: (a: FilterTypes) => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 shadow-lg"
      >
        <Filter className="h-4 w-4 mr-2" />
        Filters
      </Button>
      
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Transaction Filters</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
