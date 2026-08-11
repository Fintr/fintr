import { describe, expect, it } from "vitest";

import { activityShowsCalculatedIndicator } from "./activityDisplay";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

describe("activityShowsCalculatedIndicator", () => {
  it("returns true for loan activities", () => {
    expect(
      activityShowsCalculatedIndicator({
        isLoanActivity: true,
        date: "2099-01-01",
      }),
    ).toBe(true);
  });

  it("uses the explicit calculated flag when present", () => {
    expect(
      activityShowsCalculatedIndicator({
        calculated: false,
        date: "2020-01-01",
      }),
    ).toBe(false);
  });

  it("derives calculated from date when the flag is missing", () => {
    expect(
      activityShowsCalculatedIndicator({
        date: "2026-08-01",
        type: CombinedTransactionTypeEnum.EXPENSE,
      }),
    ).toBe(true);

    expect(
      activityShowsCalculatedIndicator({
        date: "2099-01-01",
        type: CombinedTransactionTypeEnum.EXPENSE,
      }),
    ).toBe(false);
  });
});
