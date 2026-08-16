import { describe, expect, it } from "vitest";

import {
  extendBalanceChartToRange,
  formatBalanceChartAxisAmount,
  type NormalizedBalanceTimelinePoint,
} from "./accountBalanceChart";

const point = (
  date: string,
  balance: number,
): NormalizedBalanceTimelinePoint => ({
  date,
  occurredAt: date,
  balance,
  change: null,
  chartX: 0,
});

describe("formatBalanceChartAxisAmount", () => {
  it("compacts millions for axis labels", () => {
    expect(formatBalanceChartAxisAmount(3_236_831.89, "PHP")).toMatch(/3\.2M$/);
  });
});

describe("extendBalanceChartToRange", () => {
  it("pads the series to the selected start and end dates", () => {
    const extended = extendBalanceChartToRange(
      [point("2026-08-12", 1000)],
      "2025-01-10",
      "2026-08-13",
    );

    expect(extended.map((row) => row.date)).toEqual([
      "2025-01-10",
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(extended[0]?.balance).toBe(1000);
    expect(extended[extended.length - 1]?.balance).toBe(1000);
  });
});
