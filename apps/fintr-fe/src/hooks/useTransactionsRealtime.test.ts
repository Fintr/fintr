import { describe, expect, it } from "vitest";

import {
  normalizeRealtimeIndexTransaction,
  parseRealtimeTransactionTags,
} from "./useTransactionsRealtime";

describe("parseRealtimeTransactionTags", () => {
  it("maps tag payloads from realtime broadcasts", () => {
    expect(
      parseRealtimeTransactionTags({
        tags: [
          {
            id: "tag-1",
            name: "Japan 2026",
            color: "#ff0000",
            isDefault: true,
          },
        ],
      }),
    ).toEqual([
      {
        id: "tag-1",
        name: "Japan 2026",
        color: "#ff0000",
        isDefault: true,
        styleImageUrl: undefined,
      },
    ]);
  });
});

describe("normalizeRealtimeIndexTransaction", () => {
  it("preserves tags on index rows", () => {
    const row = normalizeRealtimeIndexTransaction({
      id: "tx-1",
      date: "2026-08-08",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: "expense",
      inSeries: false,
      hasImage: false,
      tags: [
        {
          id: "tag-1",
          name: "Japan 2026",
          color: "#ff0000",
        },
      ],
    });

    expect(row?.tags).toEqual([
      {
        id: "tag-1",
        name: "Japan 2026",
        color: "#ff0000",
        isDefault: false,
        styleImageUrl: undefined,
      },
    ]);
    expect(row?.tagIds).toEqual(["tag-1"]);
  });

  it("preserves account and entity ids used by offline account activity", () => {
    const row = normalizeRealtimeIndexTransaction({
      id: "tx-1",
      date: "2026-08-08",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      fromAccountName: "Old Cash",
      toAccountName: "",
      type: "expense",
      inSeries: false,
      hasImage: false,
      accountId: "acc-cash",
      fromAccountId: "acc-cash",
      toAccountId: null,
      entityId: "merchant-1",
    });

    expect(row?.accountId).toBe("acc-cash");
    expect(row?.fromAccountId).toBe("acc-cash");
    expect(row?.toAccountId).toBeNull();
    expect(row?.entityId).toBe("merchant-1");
  });

  it("maps detail account_id onto fromAccountId for expenses", () => {
    const row = normalizeRealtimeIndexTransaction({
      id: "tx-1",
      date: "2026-08-08",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      type: "expense",
      account_id: "acc-1",
      account_name: "Cash",
      has_image: false,
    });

    expect(row?.accountId).toBe("acc-1");
    expect(row?.fromAccountId).toBe("acc-1");
    expect(row?.fromAccountName).toBe("Cash");
  });

  it("treats parentId as in-series for recurring children", () => {
    const row = normalizeRealtimeIndexTransaction({
      id: "child-1",
      date: "2026-08-08",
      description: "Recurring2",
      amount: 100,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: "expense",
      in_series: false,
      parent_id: "parent-1",
      has_image: false,
    });

    expect(row?.parentId).toBe("parent-1");
    expect(row?.inSeries).toBe(true);
  });

  it("does not attach empty tag arrays from incomplete realtime payloads", () => {
    const row = normalizeRealtimeIndexTransaction({
      id: "tx-1",
      date: "2026-08-08",
      description: "Coffee",
      amount: 120,
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: "expense",
      inSeries: false,
      hasImage: false,
      tags: [],
    });

    expect(row?.tags).toBeUndefined();
    expect(row?.tagIds).toBeUndefined();
  });
});
