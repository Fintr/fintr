import { describe, expect, it } from "vitest";

import {
  canRecordLoanPayment,
  formatLoanStatusLabel,
  isCompletedLoanStatus,
  isRetiredLoan,
} from "./loan-status";

describe("loan-status", () => {
  it("labels defaulted as Retired", () => {
    expect(formatLoanStatusLabel("defaulted")).toBe("Retired");
  });

  it("labels paid_off as Paid off", () => {
    expect(formatLoanStatusLabel("paid_off")).toBe("Paid off");
  });

  it("blocks payments on retired loans", () => {
    expect(canRecordLoanPayment("defaulted")).toBe(false);
  });

  it("allows payments on active loans", () => {
    expect(canRecordLoanPayment("active")).toBe(true);
  });

  it("treats defaulted as completed for list grouping", () => {
    expect(isCompletedLoanStatus("defaulted")).toBe(true);
    expect(isRetiredLoan("defaulted")).toBe(true);
  });
});
