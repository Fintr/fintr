import { describe, expect, it } from "vitest";
import {
  convertLoanTermDisplay,
  formatLoanTermUnitLabel,
  loanTermToMonths,
} from "./formatLoanTerm";

describe("loan term input helpers", () => {
  it("converts years to months for submit", () => {
    expect(loanTermToMonths("2", "years")).toBe(24);
    expect(loanTermToMonths("1.5", "years")).toBe(18);
  });

  it("keeps months as months for submit", () => {
    expect(loanTermToMonths("24", "months")).toBe(24);
  });

  it("converts display values when toggling units", () => {
    expect(convertLoanTermDisplay("24", "months", "years")).toBe("2");
    expect(convertLoanTermDisplay("2", "years", "months")).toBe("24");
    expect(convertLoanTermDisplay("18", "months", "years")).toBe("1.5");
    expect(convertLoanTermDisplay("1", "years", "months")).toBe("12");
  });

  it("labels the active unit with correct pluralization", () => {
    expect(formatLoanTermUnitLabel("months", "1")).toBe("Month");
    expect(formatLoanTermUnitLabel("months", "2")).toBe("Months");
    expect(formatLoanTermUnitLabel("years", "1")).toBe("Year");
    expect(formatLoanTermUnitLabel("years", "2")).toBe("Years");
  });
});
