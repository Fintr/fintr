import { monthYearToDateRange } from "@/atoms/dateFilterAtoms";
import {
  DateFilterPresetId,
  DateFilterTypeSelector,
  getPresetDateRange,
  type PresetDateRangeOptions,
} from "@/utils/dateFilterPresets";
import { clampEndDateToToday, getCurrentMonthDates } from "@/utils/dateUtils";
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
  const referenceDate = new Date();

  const withEndCappedAtToday = (
    queryStartDate: string,
    queryEndDate: string,
  ) => ({
    queryStartDate,
    queryEndDate: clampEndDateToToday(
      queryStartDate,
      queryEndDate,
      referenceDate,
    ),
  });

  if (filterTypeSelector === "single") {
    const { startDate, endDate } = monthYearToDateRange(
      selectedMonth,
      selectedYear,
      selectedMonth,
      selectedYear,
    );

    return withEndCappedAtToday(startDate, endDate);
  }

  if (filterTypeSelector === "predefined") {
    const { startDate, endDate } = getPresetDateRange(
      selectedPreset,
      referenceDate,
      presetOptions,
    );

    return withEndCappedAtToday(startDate, endDate);
  }

  if (dateRange?.from && dateRange?.to) {
    return withEndCappedAtToday(
      format(dateRange.from, "yyyy-MM-dd"),
      format(dateRange.to, "yyyy-MM-dd"),
    );
  }

  if (dateRange?.from) {
    const singleDate = format(dateRange.from, "yyyy-MM-dd");

    return withEndCappedAtToday(singleDate, singleDate);
  }

  const { firstDay, lastDay } = getCurrentMonthDates();

  return withEndCappedAtToday(firstDay, lastDay);
};
