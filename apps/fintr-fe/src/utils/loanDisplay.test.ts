import { loanCounterparty, loanHeadline, loanPurpose } from "@/utils/loanDisplay";

describe("loanPurpose", () => {
  it("returns the trimmed description", () => {
    expect(loanPurpose("  Car loan  ")).toBe("Car loan");
  });

  it("returns an empty string when the description is missing", () => {
    expect(loanPurpose(null)).toBe("");
  });
});

describe("loanHeadline", () => {
  it("uses the purpose as the headline when present", () => {
    expect(
      loanHeadline({
        description: "Car loan",
        entityName: "Bdo",
      }),
    ).toBe("Car loan");
  });

  it("falls back to the lender or borrower when there is no purpose", () => {
    expect(
      loanHeadline({
        description: null,
        entityName: "Jerry Oquendo",
      }),
    ).toBe("Jerry Oquendo");
  });
});

describe("loanCounterparty", () => {
  it("returns the lender when the headline is the purpose", () => {
    expect(
      loanCounterparty({
        description: "Car loan",
        entityName: "Bdo",
      }),
    ).toBe("Bdo");
  });

  it("hides the counterparty when it would duplicate the headline", () => {
    expect(
      loanCounterparty({
        description: null,
        entityName: "Bdo",
      }),
    ).toBe("");
  });
});
