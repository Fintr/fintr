"use client";

import { Label } from "@/components/ui/label";
import { CategoryFilterComboBox } from "@/components/ui/category-filter-combobox";
import { AccountFilterComboBox } from "@/components/ui/account-filter-combobox";
import { DateFilterFields } from "@/components/ui/date-filter-fields";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import { useAtomValue } from "jotai";
import {
  accountOptionsAtom,
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";
import {
  dateFilterStartDateAtom,
  dateFilterEndDateAtom,
  dateFilterMonthYearAtom,
  dateFilterTypeAtom,
  dateRangeToMonthYear,
  monthYearToDateRange,
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
  normalizeFilterValues,
} from "@/utils/transactionFilterValues";
import {
  FILTER_CLEAR_ALL_MIN_COUNT,
  FilterClearAllButton,
} from "@/components/ui/filter-selection-pills";

export interface FilterTypes {
  selectedMonth: string;
  selectedYear: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  selectedCategories: string[];
  appliedCategories: string[];
  queryStartDate: string;
  queryEndDate: string;
  appliedMinAmount: string;
  appliedMaxAmount: string;
  searchQuery: string;
  appliedAccounts: string[];
  selectedTags: string[];
  appliedTags: string[];
}

interface TransactionFiltersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applyFilters: (a: FilterTypes) => void;
  appliedFilters: FilterTypes;
  title?: string;
  expenseCategoryOptionsOverride?: CategoryTreeOption[];
  incomeCategoryOptionsOverride?: CategoryTreeOption[];
  showAccountFilter?: boolean;
  categoryDefaultValues?: string[];
  useCategoryDefaultsWhenEmpty?: boolean;
  /** When set, Reset restores this predefined period instead of the current month. */
  defaultPresetId?: DateFilterPresetId;
}

export function TransactionFiltersSheet({
  open,
  onOpenChange,
  applyFilters,
  appliedFilters,
  title = "Transaction Filters",
  expenseCategoryOptionsOverride,
  incomeCategoryOptionsOverride,
  showAccountFilter = false,
  categoryDefaultValues = [],
  useCategoryDefaultsWhenEmpty = false,
  defaultPresetId,
}: TransactionFiltersSheetProps) {
  const presetOptions = usePresetDateRangeOptions();
  const expenseCategoryOptionsFromAtom = useAtomValue(expenseCategoryOptionsAtom);
  const incomeCategoryOptionsFromAtom = useAtomValue(incomeCategoryOptionsAtom);
  const accountOptions = useAtomValue(accountOptionsAtom);
  const { tags: transactionTags } = useTransactionTags();
  const expenseCategoryOptions =
    expenseCategoryOptionsOverride ?? expenseCategoryOptionsFromAtom;
  const incomeCategoryOptions =
    incomeCategoryOptionsOverride ?? incomeCategoryOptionsFromAtom;
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
      inferDateFilterTypeSelector(startDate, endDate, presetOptions),
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

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
      const queryStartDate =
        appliedFilters.queryStartDate || startDate;
      const queryEndDate =
        appliedFilters.queryEndDate || endDate;
      const monthYearFromQuery = dateRangeToMonthYear(
        queryStartDate,
        queryEndDate,
      );
      const inferredType = inferDateFilterTypeSelector(
        queryStartDate,
        queryEndDate,
        presetOptions,
      );
      setFilterTypeSelector(inferredType);
      const matchedPreset = matchPresetFromDateRange(
        queryStartDate,
        queryEndDate,
        presetOptions,
      );
      if (matchedPreset) {
        setSelectedPreset(matchedPreset);
      }
      setFilters({
        selectedMonth: monthYearFromQuery.selectedMonth,
        selectedYear: monthYearFromQuery.selectedYear,
        startMonth: monthYearFromQuery.startMonth,
        startYear: monthYearFromQuery.startYear,
        endMonth: monthYearFromQuery.endMonth,
        endYear: monthYearFromQuery.endYear,
      });
      setSelectedCategories(normalizeFilterValues(appliedFilters.selectedCategories));
      setSelectedAccounts(normalizeFilterValues(appliedFilters.appliedAccounts));
      setSelectedTags(normalizeFilterValues(appliedFilters.selectedTags));
      setAppliedMinAmount(appliedFilters.appliedMinAmount);
      setAppliedMaxAmount(appliedFilters.appliedMaxAmount);

      if (queryStartDate && queryEndDate) {
        setDateRange({
          from: new Date(queryStartDate),
          to: new Date(queryEndDate),
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [open, appliedFilters, filterType, presetOptions, startDate, endDate]);

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
      const viewingMonthYear = dateRangeToMonthYear(startDate, endDate);
      const { startDate: rangeStart, endDate: rangeEnd } = monthYearToDateRange(
        viewingMonthYear.selectedMonth,
        viewingMonthYear.selectedYear,
        viewingMonthYear.selectedMonth,
        viewingMonthYear.selectedYear,
      );
      setFilters({
        selectedMonth: viewingMonthYear.selectedMonth,
        selectedYear: viewingMonthYear.selectedYear,
        startMonth: viewingMonthYear.selectedMonth,
        startYear: viewingMonthYear.selectedYear,
        endMonth: viewingMonthYear.selectedMonth,
        endYear: viewingMonthYear.selectedYear,
      });
      setDateRange({
        from: new Date(rangeStart),
        to: new Date(rangeEnd),
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

  const buildAppliedFilters = (): FilterTypes => {
    const { queryStartDate, queryEndDate } = resolveQueryDateRange({
      filterTypeSelector,
      selectedMonth: filters.selectedMonth,
      selectedYear: filters.selectedYear,
      selectedPreset,
      dateRange,
      presetOptions,
    });

    const resolvedCategoryValues =
      useCategoryDefaultsWhenEmpty && selectedCategories.length === 0
        ? categoryDefaultValues
        : selectedCategories;

    const categoryValues = normalizeFilterValues(resolvedCategoryValues);

    return {
      ...filters,
      queryStartDate,
      queryEndDate,
      selectedCategories: categoryValues,
      appliedCategories: categoryValues,
      appliedAccounts: normalizeFilterValues(selectedAccounts),
      selectedTags: normalizeFilterValues(selectedTags),
      appliedTags: normalizeFilterValues(selectedTags),
      appliedMinAmount,
      appliedMaxAmount,
      searchQuery: appliedFilters.searchQuery,
    };
  };

  const handleApply = () => {
    setDateRangePickerOpen(false);

    const updatedFilters = buildAppliedFilters();
    setStartDate(updatedFilters.queryStartDate);
    setEndDate(updatedFilters.queryEndDate);
    applyFilters(updatedFilters);
  };

  const handleReset = () => {
    setDateRangePickerOpen(false);

    if (defaultPresetId) {
      const { startDate: presetStart, endDate: presetEnd } =
        getPresetDateRange(defaultPresetId, new Date(), presetOptions);

      setStartDate(presetStart);
      setEndDate(presetEnd);
      setFilterTypeSelector("predefined");
      setSelectedPreset(defaultPresetId);
      setDateRange({
        from: new Date(presetStart),
        to: new Date(presetEnd),
      });
      setSelectedCategories([]);
      setSelectedAccounts([]);
      setSelectedTags([]);
      setAppliedMinAmount("");
      setAppliedMaxAmount("");

      const resetCategories = normalizeFilterValues(
        useCategoryDefaultsWhenEmpty ? categoryDefaultValues : [],
      );

      const resetFiltersData: FilterTypes = {
        selectedMonth: currentMonth,
        selectedYear: currentYear,
        startMonth: currentMonth,
        startYear: currentYear,
        endMonth: currentMonth,
        endYear: currentYear,
        selectedCategories: resetCategories,
        appliedCategories: resetCategories,
        queryStartDate: presetStart,
        queryEndDate: presetEnd,
        appliedMinAmount: "",
        appliedMaxAmount: "",
        appliedAccounts: [],
        selectedTags: [],
        appliedTags: [],
        searchQuery: appliedFilters.searchQuery,
      };

      applyFilters(resetFiltersData);
      return;
    }

    const { firstDay, lastDay } = getCurrentMonthDates();

    setStartDate(firstDay);
    setEndDate(lastDay);
    setFilterTypeSelector("single");
    setSelectedPreset("this_week");
    setDateRange({
      from: new Date(firstDay),
      to: new Date(lastDay),
    });
    setSelectedCategories([]);
    setSelectedAccounts([]);
    setSelectedTags([]);
    setAppliedMinAmount("");
    setAppliedMaxAmount("");

    const resetCategories = normalizeFilterValues(
      useCategoryDefaultsWhenEmpty ? categoryDefaultValues : [],
    );

    const resetFiltersData: FilterTypes = {
      selectedMonth: currentMonth,
      selectedYear: currentYear,
      startMonth: currentMonth,
      startYear: currentYear,
      endMonth: currentMonth,
      endYear: currentYear,
      selectedCategories: resetCategories,
      appliedCategories: resetCategories,
      queryStartDate: firstDay,
      queryEndDate: lastDay,
      appliedMinAmount: "",
      appliedMaxAmount: "",
      appliedAccounts: [],
      selectedTags: [],
      appliedTags: [],
      searchQuery: appliedFilters.searchQuery,
    };

    applyFilters(resetFiltersData);
  };

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
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
        <div className="flex items-center justify-between gap-3">
          <Label>Categories</Label>
          {selectedCategories.length >= FILTER_CLEAR_ALL_MIN_COUNT ? (
            <FilterClearAllButton onClick={() => setSelectedCategories([])} />
          ) : null}
        </div>
        <CategoryFilterComboBox
          expenseOptions={expenseCategoryOptions}
          incomeOptions={incomeCategoryOptions}
          placeholder="Select categories"
          className="w-full"
          showAllOnFocus={true}
          multiple={true}
          values={selectedCategories}
          onValuesChange={setSelectedCategories}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Tags</Label>
          {selectedTags.length >= FILTER_CLEAR_ALL_MIN_COUNT ? (
            <FilterClearAllButton onClick={() => setSelectedTags([])} />
          ) : null}
        </div>
        <TagFilterComboBox
          tags={transactionTags}
          placeholder="Select tags"
          className="w-full"
          showAllOnFocus={true}
          values={selectedTags}
          onValuesChange={setSelectedTags}
        />
      </div>

      {showAccountFilter ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Accounts</Label>
            {selectedAccounts.length >= FILTER_CLEAR_ALL_MIN_COUNT ? (
              <FilterClearAllButton onClick={() => setSelectedAccounts([])} />
            ) : null}
          </div>
          <AccountFilterComboBox
            options={accountOptions}
            placeholder="Select accounts"
            className="w-full"
            showAllOnFocus={true}
            values={selectedAccounts}
            onValuesChange={setSelectedAccounts}
          />
        </div>
      ) : null}

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
