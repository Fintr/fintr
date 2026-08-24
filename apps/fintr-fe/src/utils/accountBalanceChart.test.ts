import { describe, expect, it } from "vitest";

import {
  extendBalanceChartToRange,
  formatBalanceChartAxisAmount,
  resolveBalanceChartXDomain,
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
  it("pads only through the selected end date", () => {
    const extended = extendBalanceChartToRange(
      [point("2026-08-12", 1000)],
      "2025-01-10",
      "2026-08-13",
    );

    expect(extended.map((row) => row.date)).toEqual([
      "2026-08-12",
      "2026-08-13",
    ]);
    expect(extended[0]?.balance).toBe(1000);
    expect(extended[extended.length - 1]?.balance).toBe(1000);
  });
});

describe("resolveBalanceChartXDomain", () => {
  it("starts ALL at the first plotted activity date", () => {
    expect(
      resolveBalanceChartXDomain({
        rangeId: "all",
        startDate: "2005-08-03",
        endDate: "2026-08-17",
        firstPointDate: "2024-03-15",
      }),
    ).toEqual(
      resolveBalanceChartXDomain({
        rangeId: "1y",
        startDate: "2024-03-15",
        endDate: "2026-08-17",
        firstPointDate: "2024-03-15",
      }),
    );
  });

  it("keeps bounded ranges on the selected window", () => {
    const domain = resolveBalanceChartXDomain({
      rangeId: "1y",
      startDate: "2025-08-17",
      endDate: "2026-08-17",
      firstPointDate: "2026-01-10",
    });
    const fullWindow = resolveBalanceChartXDomain({
      rangeId: "1y",
      startDate: "2025-08-17",
      endDate: "2026-08-17",
      firstPointDate: "2025-08-17",
    });

    expect(domain).toEqual(fullWindow);
  });
});
