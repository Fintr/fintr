import { describe, expect, it } from "vitest";

import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  filterInsightsTransactions,
  INITIAL_BALANCE_CATEGORY_NAME,
  isInsightsCalculatedTransaction,
} from "./filter-insights-transactions";

const tx = (
  overrides: Partial<IndexTransaction>,
): IndexTransaction => ({
  id: "1",
  date: "2026-08-01",
  description: "",
  amount: 100,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("filterInsightsTransactions", () => {
  it("removes Initial Balance rows like backend insights queries", () => {
    const filtered = filterInsightsTransactions([
      tx({ id: "1", categoryName: "Food" }),
      tx({
        id: "2",
        categoryName: INITIAL_BALANCE_CATEGORY_NAME,
        type: CombinedTransactionTypeEnum.INCOME,
      }),
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("excludes pending future-dated transactions", () => {
    const filtered = filterInsightsTransactions(
      [
        tx({ id: "1", date: "2026-08-01" }),
        tx({ id: "2", date: "2099-01-01", calculated: false }),
      ],
      "2026-08-12",
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
    expect(
      isInsightsCalculatedTransaction(
        tx({ id: "3", date: "2099-01-01" }),
        "2026-08-12",
      ),
    ).toBe(false);
  });

  it("keeps past-dated rows even when sync marked calculated false", () => {
    expect(
      isInsightsCalculatedTransaction(
        tx({ id: "4", date: "2026-08-11", calculated: false }),
        "2026-08-12",
      ),
    ).toBe(true);

    const filtered = filterInsightsTransactions(
      [
        tx({
          id: "japan",
          date: "2026-08-11",
          calculated: false,
          categoryName: "Dine Out & Entertainment",
        }),
      ],
      "2026-08-12",
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("japan");
  });
});
