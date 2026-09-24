import {
  transactionRowTitle,
  transactionSecondaryLine,
} from "@/utils/transactionDescription";

describe("transactionRowTitle", () => {
  it("uses the written description", () => {
    expect(
      transactionRowTitle({
        description: "Lunch",
        fallback: "Medicine",
      }),
    ).toBe("Lunch");
  });

  it("falls through to category when description is blank", () => {
    expect(
      transactionRowTitle({
        description: "   ",
        fallback: "Medicine",
      }),
    ).toBe("Medicine");
  });

  it("does not use merchant as the title", () => {
    expect(
      transactionRowTitle({
        description: "",
        fallback: "Medicine",
      }),
    ).toBe("Medicine");
  });
});

describe("transactionSecondaryLine", () => {
  it("shows merchant and category when there is a description", () => {
    expect(
      transactionSecondaryLine({
        description: "Lunch",
        entityName: "Jollibee",
        categoryName: "Medicine",
      }),
    ).toBe("Jollibee · Medicine");
  });

  it("shows only merchant when the title already fell back to category", () => {
    expect(
      transactionSecondaryLine({
        description: "",
        entityName: "Jollibee",
        categoryName: "Medicine",
      }),
    ).toBe("Jollibee");
  });
});
