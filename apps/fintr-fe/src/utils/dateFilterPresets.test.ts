import { describe, expect, it } from "vitest";

import {
  getPresetDateRange,
  resolveAllTimeStartDate,
} from "@/utils/dateFilterPresets";

describe("resolveAllTimeStartDate", () => {
  it("prefers the earliest transaction date when provided", () => {
    expect(
      resolveAllTimeStartDate(
        {
          earliestTransactionDate: "2019-03-10",
          spaceCreatedAt: "2024-06-15T10:30:00.000Z",
        },
        new Date("2026-08-08"),
      ),
    ).toBe("2019-03-10");
  });

  it("uses the space creation date when earliest transaction date is missing", () => {
    expect(
      resolveAllTimeStartDate(
        {
          spaceCreatedAt: "2024-06-15T10:30:00.000Z",
        },
        new Date("2026-08-08"),
      ),
    ).toBe("2024-06-15");
  });

  it("falls back to the reference date when no anchors are available", () => {
    expect(resolveAllTimeStartDate({}, new Date("2026-08-08"))).toBe(
      "2026-08-08",
    );
  });
});

describe("getPresetDateRange all_time", () => {
  it("starts from the earliest transaction date instead of space creation", () => {
    const range = getPresetDateRange(
      "all_time",
      new Date("2026-08-08"),
      {
        earliestTransactionDate: "2018-11-01",
        spaceCreatedAt: "2025-01-20T00:00:00.000Z",
      },
    );

    expect(range.startDate).toBe("2018-11-01");
    expect(range.endDate).toBe("2026-08-08");
    expect(range.startDate).not.toBe("2025-01-20");
    expect(range.startDate).not.toBe("2000-01-01");
  });
});
