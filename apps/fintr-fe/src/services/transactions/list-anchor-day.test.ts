import { describe, expect, it } from "vitest";

import {
  findTransactionsListAnchorDayKey,
  isAnchorDayFullyLoaded,
  isoDayKeyInInclusiveRange,
} from "./list-anchor-day";

describe("findTransactionsListAnchorDayKey", () => {
  it("returns today when present among newer future days", () => {
    expect(
      findTransactionsListAnchorDayKey({
        dayKeysNewestFirst: [
          "2026-08-31",
          "2026-08-15",
          "2026-08-08",
          "2026-08-01",
        ],
        todayKey: "2026-08-08",
      }),
    ).toBe("2026-08-08");
  });

  it("returns the newest past day when today has no rows", () => {
    expect(
      findTransactionsListAnchorDayKey({
        dayKeysNewestFirst: ["2026-08-20", "2026-08-07", "2026-08-01"],
        todayKey: "2026-08-08",
      }),
    ).toBe("2026-08-07");
  });

  it("returns null when every loaded day is in the future", () => {
    expect(
      findTransactionsListAnchorDayKey({
        dayKeysNewestFirst: ["2026-08-31", "2026-08-15"],
        todayKey: "2026-08-08",
      }),
    ).toBeNull();
  });
});

describe("isoDayKeyInInclusiveRange", () => {
  it("includes boundary days", () => {
    expect(
      isoDayKeyInInclusiveRange({
        dayKey: "2026-08-01",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      }),
    ).toBe(true);
    expect(
      isoDayKeyInInclusiveRange({
        dayKey: "2026-08-31",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      }),
    ).toBe(true);
  });

  it("excludes days outside the range", () => {
    expect(
      isoDayKeyInInclusiveRange({
        dayKey: "2026-07-31",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      }),
    ).toBe(false);
  });
});

describe("isAnchorDayFullyLoaded", () => {
  it("is incomplete when the newest-first list still ends on the anchor day", () => {
    expect(
      isAnchorDayFullyLoaded({
        dayKeysNewestFirst: ["2026-08-15", "2026-08-08"],
        anchorDayKey: "2026-08-08",
        hasNextPage: true,
      }),
    ).toBe(false);
  });

  it("is complete once an older day has been loaded", () => {
    expect(
      isAnchorDayFullyLoaded({
        dayKeysNewestFirst: ["2026-08-15", "2026-08-08", "2026-08-07"],
        anchorDayKey: "2026-08-08",
        hasNextPage: true,
      }),
    ).toBe(true);
  });

  it("is complete when there are no further pages", () => {
    expect(
      isAnchorDayFullyLoaded({
        dayKeysNewestFirst: ["2026-08-15", "2026-08-08"],
        anchorDayKey: "2026-08-08",
        hasNextPage: false,
      }),
    ).toBe(true);
  });
});
