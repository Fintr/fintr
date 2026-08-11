import { format, subDays, subMonths, subYears } from "date-fns";

import { getPresetDateRange, type PresetDateRangeOptions } from "@/utils/dateFilterPresets";

export type AccountChartRangeId = "1w" | "1m" | "3m" | "1y" | "all";

export const ACCOUNT_CHART_RANGE_OPTIONS: {
  id: AccountChartRangeId;
  label: string;
  periodLabel: string;
}[] = [
  { id: "1w", label: "1W", periodLabel: "Past week" },
  { id: "1m", label: "1M", periodLabel: "Past month" },
  { id: "3m", label: "3M", periodLabel: "Past 3 months" },
  { id: "1y", label: "1Y", periodLabel: "Past year" },
  { id: "all", label: "ALL", periodLabel: "All time" },
];

const formatYmd = (date: Date): string => format(date, "yyyy-MM-dd");

export const getAccountChartDateRange = (
  rangeId: AccountChartRangeId,
  referenceDate: Date = new Date(),
  options: PresetDateRangeOptions = {},
): { startDate: string; endDate: string } => {
  const endDate = formatYmd(referenceDate);

  switch (rangeId) {
    case "1w":
      return { startDate: formatYmd(subDays(referenceDate, 7)), endDate };
    case "1m":
      return { startDate: formatYmd(subMonths(referenceDate, 1)), endDate };
    case "3m":
      return { startDate: formatYmd(subMonths(referenceDate, 3)), endDate };
    case "1y":
      return { startDate: formatYmd(subYears(referenceDate, 1)), endDate };
    case "all":
      return getPresetDateRange("all_time", referenceDate, options);
  }
};

export const getAccountChartPeriodLabel = (rangeId: AccountChartRangeId): string => {
  const option = ACCOUNT_CHART_RANGE_OPTIONS.find((item) => item.id === rangeId);
  return option?.periodLabel ?? "All time";
};
