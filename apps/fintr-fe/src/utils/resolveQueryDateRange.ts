import { monthYearToDateRange } from "@/atoms/dateFilterAtoms";
import {
  DateFilterPresetId,
  DateFilterTypeSelector,
  getPresetDateRange,
  type PresetDateRangeOptions,
} from "@/utils/dateFilterPresets";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import { format } from "date-fns";

export const resolveQueryDateRange = ({
  filterTypeSelector,
  selectedMonth,
  selectedYear,
  selectedPreset,
  dateRange,
  presetOptions = {},
}: {
  filterTypeSelector: DateFilterTypeSelector;
  selectedMonth: string;
  selectedYear: string;
  selectedPreset: DateFilterPresetId;
  dateRange?: { from?: Date; to?: Date };
  presetOptions?: PresetDateRangeOptions;
}): { queryStartDate: string; queryEndDate: string } => {
  if (filterTypeSelector === "single") {
    const { startDate, endDate } = monthYearToDateRange(
      selectedMonth,
      selectedYear,
      selectedMonth,
      selectedYear,
    );

    return {
      queryStartDate: startDate,
      queryEndDate: endDate,
    };
  }

  if (filterTypeSelector === "predefined") {
    const { startDate, endDate } = getPresetDateRange(
      selectedPreset,
      new Date(),
      presetOptions,
    );

    return {
      queryStartDate: startDate,
      queryEndDate: endDate,
    };
  }

  if (dateRange?.from && dateRange?.to) {
    return {
      queryStartDate: format(dateRange.from, "yyyy-MM-dd"),
      queryEndDate: format(dateRange.to, "yyyy-MM-dd"),
    };
  }

  if (dateRange?.from) {
    const singleDate = format(dateRange.from, "yyyy-MM-dd");

    return {
      queryStartDate: singleDate,
      queryEndDate: singleDate,
    };
  }

  const { firstDay, lastDay } = getCurrentMonthDates();

  return {
    queryStartDate: firstDay,
    queryEndDate: lastDay,
  };
};
