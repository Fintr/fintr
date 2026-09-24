import { describe, expect, it } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { buildRecentTransactionsList } from "./recent-transactions-list";

const expense = (params: {
  id: string;
  date: string;
  description?: string;
  inSeries?: boolean;
}) => ({
  id: params.id,
  date: params.date,
  description: params.description ?? "Rent",
  amount: 1000,
  amountCurrency: "PHP",
  categoryName: "Housing",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: params.inSeries ?? false,
  hasImage: false,
});

describe("buildRecentTransactionsList", () => {
  it("collapses series siblings to the newest occurrence on or before today", () => {
    const rows = [
      expense({ id: "r-3", date: "2026-08-08", inSeries: true }),
      expense({ id: "r-2", date: "2026-08-07", inSeries: true }),
      expense({ id: "r-1", date: "2026-08-06", inSeries: true }),
    ];

    const result = buildRecentTransactionsList(rows, 5, {
      today: new Date("2026-08-08T12:00:00.000Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("r-3");
  });

  it("groups siblings with stale inSeries false on the parent", () => {
    const rows = [
      expense({ id: "child", date: "2026-08-08", inSeries: true }),
      expense({ id: "parent", date: "2026-08-01", inSeries: false }),
    ];

    const result = buildRecentTransactionsList(rows, 5, {
      today: new Date("2026-08-08T12:00:00.000Z"),
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("child");
  });

  it("keeps one-time transactions and fills the limit with other rows", () => {
    const rows = [
      expense({ id: "coffee", date: "2026-08-08", description: "Coffee" }),
      expense({ id: "r-2", date: "2026-08-07", inSeries: true }),
      expense({ id: "r-1", date: "2026-08-06", inSeries: true }),
      expense({ id: "groceries", date: "2026-08-05", description: "Groceries" }),
    ];

    const result = buildRecentTransactionsList(rows, 3, {
      today: new Date("2026-08-08T12:00:00.000Z"),
    });

    expect(result.map((row) => row.id)).toEqual(["coffee", "r-2", "groceries"]);
  });

  it("omits standalone transactions dated after today", () => {
    const rows = [
      expense({ id: "future", date: "2026-11-01", description: "Future lunch" }),
      expense({ id: "coffee", date: "2026-08-08", description: "Coffee" }),
    ];

    const result = buildRecentTransactionsList(rows, 5, {
      today: new Date("2026-08-08T12:00:00.000Z"),
    });

    expect(result.map((row) => row.id)).toEqual(["coffee"]);
  });

  it("omits series rows when every occurrence is after today", () => {
    const rows = [
      expense({ id: "future-2", date: "2026-08-10", inSeries: true }),
      expense({ id: "future-1", date: "2026-08-09", inSeries: true }),
      expense({ id: "coffee", date: "2026-08-08", description: "Coffee" }),
    ];

    const result = buildRecentTransactionsList(rows, 5, {
      today: new Date("2026-08-08T12:00:00.000Z"),
    });

    expect(result.map((row) => row.id)).toEqual(["coffee"]);
  });
});
