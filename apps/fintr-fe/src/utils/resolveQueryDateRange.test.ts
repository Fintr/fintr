import { describe, expect, it } from "vitest";

import { getCurrentMonthDates, getLocalIsoDateKey } from "@/utils/dateUtils";
import { resolveQueryDateRange } from "@/utils/resolveQueryDateRange";

const monthNames = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

describe("resolveQueryDateRange", () => {
  it("caps the current month at today for single-month filters", () => {
    const { firstDay, lastDay } = getCurrentMonthDates();
    const today = new Date();
    const selectedMonth = monthNames[today.getMonth()];
    const selectedYear = String(today.getFullYear());

    const range = resolveQueryDateRange({
      filterTypeSelector: "single",
      selectedMonth,
      selectedYear,
      selectedPreset: "this_week",
      presetOptions: {},
    });

    expect(range.queryStartDate).toBe(firstDay);
    expect(range.queryEndDate).toBe(lastDay);
    expect(range.queryEndDate).toBe(getLocalIsoDateKey(today));
  });

  it("keeps past months at their full calendar end date", () => {
    const today = new Date();
    const pastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 15);
    const selectedMonth = monthNames[pastMonthDate.getMonth()];
    const selectedYear = String(pastMonthDate.getFullYear());
    const lastDay = new Date(
      pastMonthDate.getFullYear(),
      pastMonthDate.getMonth() + 1,
      0,
    ).getDate();

    const range = resolveQueryDateRange({
      filterTypeSelector: "single",
      selectedMonth,
      selectedYear,
      selectedPreset: "this_week",
      presetOptions: {},
    });

    expect(range.queryStartDate).toBe(
      `${selectedYear}-${String(pastMonthDate.getMonth() + 1).padStart(2, "0")}-01`,
    );
    expect(range.queryEndDate).toBe(
      `${selectedYear}-${String(pastMonthDate.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    );
  });

  it("caps custom ranges that extend beyond today", () => {
    const { firstDay, lastDay } = getCurrentMonthDates();
    const today = new Date();
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const range = resolveQueryDateRange({
      filterTypeSelector: "custom",
      selectedMonth: monthNames[today.getMonth()],
      selectedYear: String(today.getFullYear()),
      selectedPreset: "this_week",
      dateRange: {
        from: new Date(firstDay),
        to: monthEnd,
      },
      presetOptions: {},
    });

    expect(range.queryStartDate).toBe(firstDay);
    expect(range.queryEndDate).toBe(lastDay);
  });
});
