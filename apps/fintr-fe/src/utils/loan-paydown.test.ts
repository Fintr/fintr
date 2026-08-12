import { describe, expect, it } from "vitest";

import {
  getCrossedPaydownMilestone,
  getLoanPaydownPercent,
  getPaydownMilestoneMessage,
} from "@/utils/loan-paydown";

describe("getLoanPaydownPercent", () => {
  it("returns 100 for paid-off loans", () => {
    expect(getLoanPaydownPercent(100_000, 0, "paid_off")).toBe(100);
  });

  it("calculates principal paid percentage for active loans", () => {
    expect(getLoanPaydownPercent(100_000, 50_000, "active")).toBe(50);
    expect(getLoanPaydownPercent(100_000, 75_000, "active")).toBe(25);
  });
});

describe("getCrossedPaydownMilestone", () => {
  it("detects when a milestone is crossed", () => {
    expect(getCrossedPaydownMilestone(20, 26)).toBe(25);
    expect(getCrossedPaydownMilestone(48, 52)).toBe(50);
    expect(getCrossedPaydownMilestone(70, 76)).toBe(75);
    expect(getCrossedPaydownMilestone(90, 100)).toBe(100);
  });

  it("returns null when no milestone is crossed", () => {
    expect(getCrossedPaydownMilestone(30, 35)).toBeNull();
    expect(getCrossedPaydownMilestone(50, 55)).toBeNull();
  });
});

describe("getPaydownMilestoneMessage", () => {
  it("includes remaining balance for the halfway milestone", () => {
    expect(getPaydownMilestoneMessage(50, "₱50,000.00")).toContain("₱50,000.00");
  });
});
