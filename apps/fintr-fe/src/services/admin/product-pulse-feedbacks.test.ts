import { describe, it, expect } from "vitest";
import {
  coerceFeedbackAreaIds,
  normalizeProductPulseFeedbackRow,
} from "./product-pulse-feedbacks";

describe("coerceFeedbackAreaIds", () => {
  it("keeps array order and dedupes", () => {
    expect(coerceFeedbackAreaIds(["loans", "budgets", "loans"])).toEqual(["loans", "budgets"]);
  });

  it("coerces numeric-key object payloads into ordered ids", () => {
    expect(coerceFeedbackAreaIds({ "0": "loans", "1": "budgets" })).toEqual(["loans", "budgets"]);
  });

  it("parses JSON string arrays", () => {
    expect(coerceFeedbackAreaIds('["speed","visual_design"]')).toEqual(["speed", "visual_design"]);
  });
});

describe("normalizeProductPulseFeedbackRow", () => {
  it("merges snake_case and camelCase area keys", () => {
    const row = normalizeProductPulseFeedbackRow({
      id: "x",
      period_key: "2026-W20",
      liked_areas: { "0": "loans", "1": "budgets" },
      improve_areas: ["speed"],
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      user: { id: "u1", email: "a@b.com", full_name: "A" },
      space: { id: "s1", name: "Space", code: "sp" },
    });
    expect(row.likedAreas).toEqual(["loans", "budgets"]);
    expect(row.improveAreas).toEqual(["speed"]);
    expect(row.periodKey).toBe("2026-W20");
  });
});
