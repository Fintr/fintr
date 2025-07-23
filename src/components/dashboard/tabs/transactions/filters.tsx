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
import { useState } from "react";
import {
  getCurrentMonthDates,
  getYearOptions,
  monthNames,
  getMonthNumber,
  getMonthDateRange,
} from "@/utils/dateUtils";
import { useDashboardData } from "@/hooks/async/useDashboardData";

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
}

interface FiltersProps {
  transactionFilterType: "single" | "range";
  applyFilters: (a: FilterTypes) => void;
}
export function Filters({
  transactionFilterType,
  applyFilters,
}: FiltersProps) {
  const { data: dashboardData } = useDashboardData();
  const yearOptions = getYearOptions();
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentMonthNumber = new Date().getMonth() + 1;
  const { firstDay, lastDay } = getCurrentMonthDates();
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
  };
  const [filters, setFilters] = useState(initialFilters);
  function handleFilterChange(key: keyof typeof filters, value: string) {
    if (filters[key] === value) return;
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    const { firstDay, lastDay } = getCurrentMonthDates();

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
    };

    setFilters(resetFiltersData);
    applyFilters(resetFiltersData);
  }
  return (
    <Card className="mb-6">
      <CardHeader className="px-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Transaction Filters</CardTitle>
            <CardDescription>Customize your transaction view</CardDescription>
          </div>
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
      </CardHeader>
      <CardContent className="px-2">
        <div className="flex flex-col md:flex-row gap-4">
          {transactionFilterType === "single" ? (
            <>
              <div className="space-y-2 md:w-1/4">
                <Label>Month</Label>
                <Select
                  defaultValue={filters.selectedMonth}
                  value={filters.selectedMonth}
                  onValueChange={(value) =>
                    handleFilterChange("selectedMonth", value)
                  }
                >
                  <SelectTrigger>
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

              <div className="space-y-2 md:w-1/4">
                <Label>Year</Label>
                <Select
                  defaultValue={filters.selectedYear}
                  value={filters.selectedYear}
                  onValueChange={(value) =>
                    handleFilterChange("selectedYear", value)
                  }
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
                    defaultValue={filters.startMonth}
                    value={filters.startMonth}
                    onValueChange={(value) =>
                      handleFilterChange("startMonth", value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Start Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames
                        .filter(
                          (month, index) =>
                            parseInt(filters.startYear) !==
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
                  <Select
                    defaultValue={filters.startYear}
                    value={filters.startYear}
                    onValueChange={(value) =>
                      handleFilterChange("startYear", value)
                    }
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
                    defaultValue={filters.endMonth}
                    value={filters.endMonth}
                    onValueChange={(value) =>
                      handleFilterChange("endMonth", value)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="End Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames
                        .filter(
                          (month, index) =>
                            parseInt(filters.endYear) !==
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
                  <Select
                    defaultValue={filters.endYear}
                    value={filters.endYear}
                    onValueChange={(value) =>
                      handleFilterChange("endYear", value)
                    }
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
                value={filters.selectedCategory}
                onChange={(value) =>
                  handleFilterChange("selectedCategory", value)
                }
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
                  value={filters.appliedMinAmount}
                  onChange={(e) =>
                    handleFilterChange("appliedMinAmount", e.target.value)
                  }
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
                  value={filters.appliedMaxAmount}
                  onChange={(e) =>
                    handleFilterChange("appliedMaxAmount", e.target.value)
                  }
                  className="w-full pl-7"
                />
              </div>
            </div>
          </div>

          <div className="md:self-end flex gap-2">
            <Button
              className={` hover:bg-primary/80 flex-1 flex items-center gap-1`}
              onClick={() => {
                // Calculate the proper date range based on selected months and years
                let queryStartDate: string;
                let queryEndDate: string;

                if (transactionFilterType === "single") {
                  // For single month filter, use selectedMonth and selectedYear
                  const monthNumber = getMonthNumber(filters.selectedMonth);
                  const year = parseInt(filters.selectedYear);
                  const dateRange = getMonthDateRange(year, monthNumber);
                  queryStartDate = dateRange.startDate;
                  queryEndDate = dateRange.endDate;
                } else {
                  // For range filter, use startMonth/Year and endMonth/Year
                  const startMonthNumber = getMonthNumber(filters.startMonth);
                  const startYear = parseInt(filters.startYear);
                  const endMonthNumber = getMonthNumber(filters.endMonth);
                  const endYear = parseInt(filters.endYear);
                  
                  const startDateRange = getMonthDateRange(startYear, startMonthNumber);
                  const endDateRange = getMonthDateRange(endYear, endMonthNumber);
                  
                  queryStartDate = startDateRange.startDate;
                  queryEndDate = endDateRange.endDate;
                }

                // Create the updated filters object with calculated dates
                const updatedFilters = {
                  ...filters,
                  queryStartDate,
                  queryEndDate,
                  appliedCategory: filters.selectedCategory,
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
