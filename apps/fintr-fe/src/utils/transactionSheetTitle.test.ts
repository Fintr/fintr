import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { buildTransactionSheetTitle } from "@/utils/transactionSheetTitle";

describe("buildTransactionSheetTitle", () => {
  it("prefers a written description over the category", () => {
    expect(
      buildTransactionSheetTitle({
        type: CombinedTransactionTypeEnum.EXPENSE,
        categoryName: "Medicine",
        description: "Lunch",
        amount: 200,
        currency: "GBP",
      }),
    ).toBe("Lunch · GBP 200");
  });

  it("falls back to category when there is no description", () => {
    expect(
      buildTransactionSheetTitle({
        type: CombinedTransactionTypeEnum.EXPENSE,
        categoryName: "Medicine",
        amount: 200,
        currency: "GBP",
      }),
    ).toBe("Medicine · GBP 200");
  });

  it("falls back to category when there is no merchant", () => {
    expect(
      buildTransactionSheetTitle({
        type: CombinedTransactionTypeEnum.EXPENSE,
        categoryName: "Food",
        amount: 100,
        currency: "GBP",
      }),
    ).toBe("Food · GBP 100");
  });

  it("names a transfer from the account route", () => {
    expect(
      buildTransactionSheetTitle({
        type: CombinedTransactionTypeEnum.TRANSFER,
        fromAccountName: "Cash",
        toAccountName: "BDO",
        amount: 50,
        currency: "PHP",
      }),
    ).toBe("Cash → BDO · PHP 50");
  });
});
