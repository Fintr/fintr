import { describe, expect, it } from "vitest";

import { buildInsightsApiParams } from "./params";

const PARENT_ID = "11111111-1111-4111-8111-111111111111";

describe("buildInsightsApiParams", () => {
  it("prefers explicit startDate and endDate over month reconstruction", () => {
    const params = buildInsightsApiParams({
      filterType: "single",
      selectedMonth: "august",
      selectedYear: "2026",
      startDate: "2026-08-04",
      endDate: "2026-08-10",
    });

    expect(params.startDate).toBe("2026-08-04");
    expect(params.endDate).toBe("2026-08-10");
  });

  it("passes canonical categoryName from selectedCategoryName", () => {
    const params = buildInsightsApiParams({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      selectedCategoryId: PARENT_ID,
      selectedCategoryName: "Food & Groceries",
    });

    expect(params.categoryId).toBe(PARENT_ID);
    expect(params.categoryName).toBe("Food & Groceries");
  });

  it("includes tagIds when provided", () => {
    const params = buildInsightsApiParams({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      selectedTagIds: ["tag-a", "tag-b"],
    });

    expect(params.tagIds).toEqual(["tag-a", "tag-b"]);
  });
});
