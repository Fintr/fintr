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
