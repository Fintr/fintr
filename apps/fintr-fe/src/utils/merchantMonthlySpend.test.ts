import { CombinedTransactionTypeEnum, type IndexTransaction } from "@/types/transactionTypes";
import { merchantMonthlySpend } from "./merchantMonthlySpend";

const expense = (
  overrides: Partial<IndexTransaction> = {},
): IndexTransaction => ({
  id: "tx-1",
  date: "2026-08-10",
  description: "Lunch",
  amount: 100,
  amountCurrency: "PHP",
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("merchantMonthlySpend", () => {
  const referenceDate = new Date(2026, 7, 13);

  it("sums this month expenses and last month expenses separately", () => {
    const result = merchantMonthlySpend(
      [
        expense({ id: "a", date: "2026-08-02", amount: 200 }),
        expense({ id: "b", date: "2026-08-12", amount: 50 }),
        expense({ id: "c", date: "2026-07-20", amount: 80 }),
      ],
      referenceDate,
    );

    expect(result.thisMonth).toBe(250);
    expect(result.lastMonth).toBe(80);
    expect(result.currency).toBe("PHP");
  });

  it("ignores income when computing spent", () => {
    const result = merchantMonthlySpend(
      [
        expense({ amount: 40 }),
        expense({
          id: "income",
          type: CombinedTransactionTypeEnum.INCOME,
          amount: 999,
          fromAccountName: "",
          toAccountName: "Cash",
        }),
      ],
      referenceDate,
    );

    expect(result.thisMonth).toBe(40);
  });

  it("returns the top category for this month", () => {
    const result = merchantMonthlySpend(
      [
        expense({ id: "food-1", amount: 30, categoryName: "Food" }),
        expense({ id: "food-2", amount: 20, categoryName: "Food" }),
        expense({ id: "med", amount: 40, categoryName: "Medicine" }),
      ],
      referenceDate,
    );

    expect(result.topCategoryName).toBe("Food");
  });

  it("returns zeros when there are no expenses", () => {
    const result = merchantMonthlySpend([], referenceDate);

    expect(result.thisMonth).toBe(0);
    expect(result.lastMonth).toBe(0);
    expect(result.topCategoryName).toBeNull();
  });
});
