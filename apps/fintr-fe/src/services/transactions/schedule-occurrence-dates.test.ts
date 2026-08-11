import { describe, expect, it } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";

import {
  expandLocalSeriesOccurrenceDates,
  localSeriesChildId,
} from "./schedule-occurrence-dates";

describe("expandLocalSeriesOccurrenceDates", () => {
  it("returns empty for one-time schedules", () => {
    expect(
      expandLocalSeriesOccurrenceDates({
        parentDate: "2026-08-01",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        today: "2026-08-08",
      }),
    ).toEqual([]);
  });

  it("expands monthly repeats for past through today and future through +1 month", () => {
    expect(
      expandLocalSeriesOccurrenceDates({
        parentDate: "2026-06-08",
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "every_month",
        today: "2026-08-08",
      }),
    ).toEqual(["2026-07-08", "2026-08-08", "2026-09-08"]);
  });

  it("expands weekly repeats without including the parent date", () => {
    expect(
      expandLocalSeriesOccurrenceDates({
        parentDate: "2026-08-01",
        scheduleType: ScheduleTypeEnum.REPEAT,
        repeatInterval: "every_week",
        today: "2026-08-08",
      }),
    ).toEqual([
      "2026-08-08",
      "2026-08-15",
      "2026-08-22",
      "2026-08-29",
      "2026-09-05",
    ]);
  });

  it("expands installment children for the remaining periods", () => {
    expect(
      expandLocalSeriesOccurrenceDates({
        parentDate: "2026-08-01",
        scheduleType: ScheduleTypeEnum.INSTALLMENT,
        installmentPeriod: 3,
        today: "2026-08-08",
      }),
    ).toEqual(["2026-09-01"]);
  });
});

describe("localSeriesChildId", () => {
  it("builds deterministic child ids", () => {
    expect(localSeriesChildId("abc", 0)).toBe("local:abc:1");
  });
});
