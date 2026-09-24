import { describe, expect, it } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

import { enrichTransactionsForInsights } from "./load-local-sources";

const base = (
  overrides: Partial<IndexTransaction>,
): IndexTransaction => ({
  id: "tx-1",
  date: "2026-08-11",
  description: "Coffee",
  amount: 100,
  categoryName: "Dine Out & Entertainment",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("enrichTransactionsForInsights", () => {
  it("restores tags from meta when the primary row lost them after re-sync", () => {
    const tagId = "tag-japan";
    const enriched = enrichTransactionsForInsights(
      [
        base({
          amount: 41037.1,
          calculated: false,
        }),
      ],
      [
        base({
          amount: 100,
          tags: [{ id: tagId, name: "Japan 2026", color: "#f472b6" }],
          tagIds: [tagId],
        }),
      ],
    );

    expect(enriched[0]?.amount).toBe(41037.1);
    expect(enriched[0]?.tagIds).toEqual([tagId]);
    expect(enriched[0]?.tags?.[0]?.name).toBe("Japan 2026");
    expect(enriched[0]?.categoryName).toBe("Dine Out & Entertainment");
  });

  it("keeps category name from meta when the primary row omits it", () => {
    const enriched = enrichTransactionsForInsights(
      [
        base({
          categoryName: "",
          amount: 500,
        }),
      ],
      [
        base({
          categoryName: "Dine Out & Entertainment",
          amount: 1,
        }),
      ],
    );

    expect(enriched[0]?.categoryName).toBe("Dine Out & Entertainment");
    expect(enriched[0]?.amount).toBe(500);
  });
});
