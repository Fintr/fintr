import { describe, expect, it } from "vitest";

import { proYearlySavingsPercent } from "./pro-plan-pricing";

describe("proYearlySavingsPercent", () => {
  it("rounds the yearly discount against twelve monthly payments", () => {
    expect(
      proYearlySavingsPercent([
        { interval: "month", priceCents: 10_000 },
        { interval: "year", priceCents: 100_000 },
      ]),
    ).toBe(17);
  });

  it("returns null when the yearly price is not cheaper", () => {
    expect(
      proYearlySavingsPercent([
        { interval: "month", priceCents: 10_000 },
        { interval: "year", priceCents: 120_000 },
      ]),
    ).toBeNull();
  });
});
