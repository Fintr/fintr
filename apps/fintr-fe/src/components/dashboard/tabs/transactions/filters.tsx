"use client";

import { Label } from "@/components/ui/label";
import { CategoryFilterComboBox } from "@/components/ui/category-filter-combobox";
import { DateFilterFields } from "@/components/ui/date-filter-fields";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import {
  getCurrentMonthDates,
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
} from "@/atoms/dateFilterAtoms";
import {
  DateFilterPresetId,
  DateFilterTypeSelector,
  getPresetDateRange,
  inferDateFilterTypeSelector,
  matchPresetFromDateRange,
} from "@/utils/dateFilterPresets";
import { resolveQueryDateRange } from "@/utils/resolveQueryDateRange";

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
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = new Date()
    .toLocaleString("default", { month: "long" })
    .toLowerCase();

  const [startDate, setStartDate] = useAtom(dateFilterStartDateAtom);
  const [endDate, setEndDate] = useAtom(dateFilterEndDateAtom);
  const [monthYear] = useAtom(dateFilterMonthYearAtom);
  const [filterType] = useAtom(dateFilterTypeAtom);

  const [filterTypeSelector, setFilterTypeSelector] =
    useState<DateFilterTypeSelector>(() =>
      inferDateFilterTypeSelector(startDate, endDate),
    );
  const [selectedPreset, setSelectedPreset] =
    useState<DateFilterPresetId>("this_week");

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
      const matchedPreset = matchPresetFromDateRange(startDate, endDate);
      if (matchedPreset) {
        setFilterTypeSelector("predefined");
        setSelectedPreset(matchedPreset);
      } else {
        setFilterTypeSelector("custom");
      }
    }
  }, [filterType, startDate, endDate]);

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
      const inferredType = inferDateFilterTypeSelector(
        appliedFilters.queryStartDate,
        appliedFilters.queryEndDate,
      );
      setFilterTypeSelector(inferredType);
      const matchedPreset = matchPresetFromDateRange(
        appliedFilters.queryStartDate,
        appliedFilters.queryEndDate,
      );
      if (matchedPreset) {
        setSelectedPreset(matchedPreset);
      }
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

  const handleFilterTypeChange = (value: DateFilterTypeSelector) => {
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

  const buildAppliedFilters = (): FilterTypes => {
    const { queryStartDate, queryEndDate } = resolveQueryDateRange({
      filterTypeSelector,
      selectedMonth: filters.selectedMonth,
      selectedYear: filters.selectedYear,
      selectedPreset,
      dateRange,
    });

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
    setSelectedPreset("this_week");
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
      <DateFilterFields
        filterTypeSelector={filterTypeSelector}
        onFilterTypeChange={handleFilterTypeChange}
        selectedMonth={filters.selectedMonth}
        selectedYear={filters.selectedYear}
        onMonthChange={(value) => handleFilterChange("selectedMonth", value)}
        onYearChange={(value) => handleFilterChange("selectedYear", value)}
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
