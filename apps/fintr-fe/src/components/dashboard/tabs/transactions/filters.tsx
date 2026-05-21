"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryFilterComboBox } from "@/components/ui/category-filter-combobox";
import { FilterOptionPills } from "@/components/ui/filter-option-pills";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  getCurrentMonthDates,
  getYearOptions,
  monthNames,
} from "@/utils/dateUtils";
import { useAtomValue } from "jotai";
import {
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
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

interface TransactionFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applyFilters: (a: FilterTypes) => void;
  appliedFilters: FilterTypes;
}

export function TransactionFiltersSheet({
  open,
  onOpenChange,
  applyFilters,
  appliedFilters,
}: TransactionFiltersSheetProps) {
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const incomeCategoryOptions = useAtomValue(incomeCategoryOptionsAtom);
  const yearOptions = getYearOptions();
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();
  const currentMonthNumber = new Date().getMonth() + 1;

  const [startDate, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [endDate, setEndDate] = useAtom(dateFilterEndDateAtom);
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  const [filterType] = useAtom(dateFilterTypeAtom);

  const [filterTypeSelector, setFilterTypeSelector] = useState<"single" | "custom">(() => {
    return filterType === "single" ? "single" : "custom";
  });

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

  useEffect(() => {
    if (startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (filterType === "single") {
      setFilterTypeSelector("single");
    } else {
      setFilterTypeSelector("custom");
    }
  }, [filterType]);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [appliedMinAmount, setAppliedMinAmount] = useState("");
  const [appliedMaxAmount, setAppliedMaxAmount] = useState("");

  const [filters, setFilters] = useState({
    selectedMonth: monthYear.selectedMonth,
    selectedYear: monthYear.selectedYear,
    startMonth: monthYear.startMonth,
    startYear: monthYear.startYear,
    endMonth: monthYear.endMonth,
    endYear: monthYear.endYear,
  });

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

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setFilterTypeSelector(filterType === "single" ? "single" : "custom");
      setFilters({
        selectedMonth: appliedFilters.selectedMonth,
        selectedYear: appliedFilters.selectedYear,
        startMonth: appliedFilters.startMonth,
        startYear: appliedFilters.startYear,
        endMonth: appliedFilters.endMonth,
        endYear: appliedFilters.endYear,
      });
      setSelectedCategory(
        appliedFilters.selectedCategory === "all"
          ? ""
          : appliedFilters.selectedCategory,
      );
      setAppliedMinAmount(appliedFilters.appliedMinAmount);
      setAppliedMaxAmount(appliedFilters.appliedMaxAmount);

      if (appliedFilters.queryStartDate && appliedFilters.queryEndDate) {
        setDateRange({
          from: new Date(appliedFilters.queryStartDate),
          to: new Date(appliedFilters.queryEndDate),
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [open, appliedFilters, filterType]);

  function handleFilterChange(key: keyof typeof filters, value: string) {
    if (filters[key] === value) return;
    const updatedFilters = { ...filters, [key]: value };
    setFilters(updatedFilters);
  }

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

      if (hadIncompleteSelection && nowComplete) {
        setDateRangePickerOpen(false);
      }
    } else {
      setDateRange(undefined);
    }
  };

  const handleFilterTypeChange = (value: "single" | "custom") => {
    setFilterTypeSelector(value);
    if (value === "single") {
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
    } else if (startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    }
  };

  const buildAppliedFilters = (): FilterTypes => {
    let queryStartDate: string;
    let queryEndDate: string;

    if (filterTypeSelector === "single") {
      const { startDate: newStartDate, endDate: newEndDate } = monthYearToDateRange(
        filters.selectedMonth,
        filters.selectedYear,
        filters.selectedMonth,
        filters.selectedYear,
      );
      queryStartDate = newStartDate;
      queryEndDate = newEndDate;
    } else if (dateRange?.from && dateRange?.to) {
      queryStartDate = format(dateRange.from, "yyyy-MM-dd");
      queryEndDate = format(dateRange.to, "yyyy-MM-dd");
    } else if (dateRange?.from) {
      queryStartDate = format(dateRange.from, "yyyy-MM-dd");
      queryEndDate = format(dateRange.from, "yyyy-MM-dd");
    } else {
      const { firstDay, lastDay } = getCurrentMonthDates();
      queryStartDate = firstDay;
      queryEndDate = lastDay;
    }

    const categoryValue = selectedCategory || "all";

    return {
      ...filters,
      queryStartDate,
      queryEndDate,
      selectedCategory: categoryValue,
      appliedCategory: categoryValue,
      appliedMinAmount,
      appliedMaxAmount,
      searchQuery: appliedFilters.searchQuery,
    };
  };

  const handleApply = () => {
    const updatedFilters = buildAppliedFilters();
    setStartDate(updatedFilters.queryStartDate);
    setEndDate(updatedFilters.queryEndDate);
    applyFilters(updatedFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const { firstDay, lastDay } = getCurrentMonthDates();

    setStartDate(firstDay);
    setEndDate(lastDay);
    setFilterTypeSelector("single");
    setDateRange({
      from: new Date(firstDay),
      to: new Date(lastDay),
    });
    setSelectedCategory("");
    setAppliedMinAmount("");
    setAppliedMaxAmount("");

    const resetFiltersData: FilterTypes = {
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
      searchQuery: appliedFilters.searchQuery,
    };

    applyFilters(resetFiltersData);
    onOpenChange(false);
  };

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Transaction Filters"
      onReset={handleReset}
      onApply={handleApply}
    >
      <div className="space-y-2">
        <Label>Filter Type</Label>
        <FilterOptionPills
          ariaLabel="Filter type"
          value={filterTypeSelector}
          onChange={(value) =>
            handleFilterTypeChange(value as "single" | "custom")
          }
          options={[
            { value: "single", label: "Single Month" },
            { value: "custom", label: "Custom Range" },
          ]}
        />
      </div>

      {filterTypeSelector === "single" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Month</Label>
            <Select
              value={filters.selectedMonth}
              onValueChange={(value) =>
                handleFilterChange("selectedMonth", value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthNames
                  .filter(
                    (month, index) =>
                      parseInt(filters.selectedYear) !==
                        new Date().getFullYear() ||
                      index < currentMonthNumber,
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

          <div className="space-y-2">
            <Label>Year</Label>
            <Select
              value={filters.selectedYear}
              onValueChange={(value) =>
                handleFilterChange("selectedYear", value)
              }
            >
              <SelectTrigger className="w-full">
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
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Date Range</Label>
          <DateRangePicker
            open={dateRangePickerOpen}
            onOpenChange={setDateRangePickerOpen}
            selected={dateRange}
            onSelect={handleDateRangeSelect}
            trigger={
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "MMM d, yyyy")} –{" "}
                      {format(dateRange.to, "MMM d, yyyy")}
                    </>
                  ) : (
                    format(dateRange.from, "MMM d, yyyy")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            }
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Categories</Label>
        <CategoryFilterComboBox
          expenseOptions={expenseCategoryOptions}
          incomeOptions={incomeCategoryOptions}
          placeholder="Select categories"
          className="w-full"
          showAllOnFocus={true}
          value={selectedCategory}
          onChange={setSelectedCategory}
        />
      </div>

      <div className="space-y-2">
        <Label>Amount Range</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
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
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
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
    </FilterSheet>
  );
}

/** @deprecated Use TransactionFiltersSheet */
export const Filters = TransactionFiltersSheet;
