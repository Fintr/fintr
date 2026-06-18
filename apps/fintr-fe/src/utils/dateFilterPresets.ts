import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subMonths,
  subWeeks,
  subYears,
} from "date-fns";

export type DateFilterTypeSelector = "single" | "predefined" | "custom";

export type DateFilterMainPresetId =
  | "this_week"
  | "last_week"
  | "last_2_weeks"
  | "last_month"
  | "last_2_months"
  | "this_year"
  | "last_year";

export type DateFilterRelativePresetId = "a_month_ago" | "two_months_ago";

export type DateFilterPresetId =
  | DateFilterMainPresetId
  | DateFilterRelativePresetId;

export type DateFilterPreset = {
  id: DateFilterPresetId;
  label: string;
};

export const DATE_FILTER_TYPE_OPTIONS = [
  { value: "single", label: "Single Month" },
  { value: "predefined", label: "Predefined" },
  { value: "custom", label: "Custom Range" },
] as const;

export const DATE_FILTER_PRESETS: DateFilterPreset[] = [
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "last_2_weeks", label: "Last 2 Weeks" },
  { id: "last_month", label: "Last Month" },
  { id: "last_2_months", label: "Last 2 Months" },
  { id: "this_year", label: "This Year" },
  { id: "last_year", label: "Last Year" },
];

export const DATE_FILTER_RELATIVE_PRESETS: DateFilterPreset[] = [
  { id: "a_month_ago", label: "A Month Ago" },
  { id: "two_months_ago", label: "2 Months Ago" },
];

export const isRelativeDateFilterPreset = (
  presetId: DateFilterPresetId,
): presetId is DateFilterRelativePresetId =>
  DATE_FILTER_RELATIVE_PRESETS.some((preset) => preset.id === presetId);

export const getDateFilterPresetLabel = (
  presetId: DateFilterPresetId,
): string => {
  const preset = [...DATE_FILTER_PRESETS, ...DATE_FILTER_RELATIVE_PRESETS].find(
    (item) => item.id === presetId,
  );

  return preset?.label ?? presetId;
};

const WEEK_OPTIONS = { weekStartsOn: 0 as const };

const formatYmd = (date: Date): string => format(date, "yyyy-MM-dd");

export const getPresetDateRange = (
  presetId: DateFilterPresetId,
  referenceDate: Date = new Date(),
): { startDate: string; endDate: string } => {
  switch (presetId) {
    case "this_week":
      return {
        startDate: formatYmd(startOfWeek(referenceDate, WEEK_OPTIONS)),
        endDate: formatYmd(referenceDate),
      };
    case "last_week": {
      const lastWeek = subWeeks(referenceDate, 1);
      return {
        startDate: formatYmd(startOfWeek(lastWeek, WEEK_OPTIONS)),
        endDate: formatYmd(endOfWeek(lastWeek, WEEK_OPTIONS)),
      };
    }
    case "last_2_weeks": {
      const twoWeeksAgo = subWeeks(referenceDate, 2);
      const oneWeekAgo = subWeeks(referenceDate, 1);
      return {
        startDate: formatYmd(startOfWeek(twoWeeksAgo, WEEK_OPTIONS)),
        endDate: formatYmd(endOfWeek(oneWeekAgo, WEEK_OPTIONS)),
      };
    }
    case "last_month": {
      const month = subMonths(referenceDate, 1);
      return {
        startDate: formatYmd(startOfMonth(month)),
        endDate: formatYmd(endOfMonth(month)),
      };
    }
    case "last_2_months": {
      const endMonth = subMonths(referenceDate, 1);
      const startMonth = subMonths(referenceDate, 2);
      return {
        startDate: formatYmd(startOfMonth(startMonth)),
        endDate: formatYmd(endOfMonth(endMonth)),
      };
    }
    case "this_year":
      return {
        startDate: formatYmd(startOfYear(referenceDate)),
        endDate: formatYmd(referenceDate),
      };
    case "last_year": {
      const previousYear = subYears(referenceDate, 1);
      return {
        startDate: formatYmd(startOfYear(previousYear)),
        endDate: formatYmd(endOfYear(previousYear)),
      };
    }
    case "a_month_ago":
      return {
        startDate: formatYmd(subMonths(referenceDate, 1)),
        endDate: formatYmd(referenceDate),
      };
    case "two_months_ago":
      return {
        startDate: formatYmd(subMonths(referenceDate, 2)),
        endDate: formatYmd(referenceDate),
      };
  }
};

export const matchPresetFromDateRange = (
  startDate: string,
  endDate: string,
): DateFilterPresetId | null => {
  const allPresets = [...DATE_FILTER_PRESETS, ...DATE_FILTER_RELATIVE_PRESETS];

  for (const preset of allPresets) {
    const range = getPresetDateRange(preset.id);
    if (range.startDate === startDate && range.endDate === endDate) {
      return preset.id;
    }
  }

  return null;
};

export const inferDateFilterTypeSelector = (
  startDate: string,
  endDate: string,
): DateFilterTypeSelector => {
  if (matchPresetFromDateRange(startDate, endDate)) {
    return "predefined";
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const isFullMonth =
    start.getDate() === 1 &&
    end.getDate() === new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();

  return isFullMonth ? "single" : "custom";
};
