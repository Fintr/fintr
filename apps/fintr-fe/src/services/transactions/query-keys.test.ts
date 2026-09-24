import { describe, expect, it } from "vitest";

import {
  buildTransactionsFilterKeyFromInfiniteQueryKey,
  buildTransactionsInfiniteQueryKey,
} from "./query-keys";

describe("buildTransactionsFilterKeyFromInfiniteQueryKey", () => {
  it("rebuilds the IndexedDB filter key including entry type", () => {
    const infiniteQueryKey = buildTransactionsInfiniteQueryKey({
      spaceCode: "space-a",
      categoriesSerialized: "[]",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
      entryType: "loans",
      mode: "local",
    });

    expect(
      buildTransactionsFilterKeyFromInfiniteQueryKey(infiniteQueryKey),
    ).toBe(
      "[]|2026-08-01|2026-08-31||||[]|[]|loans",
    );
  });
});
