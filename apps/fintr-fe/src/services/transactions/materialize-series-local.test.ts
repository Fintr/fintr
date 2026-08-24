import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const {
  upsertLocalIndexTransaction,
  upsertIndexTransactionsIntoQueryCaches,
} = vi.hoisted(() => ({
  upsertLocalIndexTransaction: vi.fn(async () => undefined),
  upsertIndexTransactionsIntoQueryCaches: vi.fn(),
}));

vi.mock("./local-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./local-cache")>();
  return {
    ...actual,
    upsertLocalIndexTransaction,
  };
});

vi.mock("./upsert-into-query-caches", () => ({
  upsertIndexTransactionsIntoQueryCaches,
}));

import { persistMaterializedSeriesTransactions } from "./materialize-series-local";

describe("persistMaterializedSeriesTransactions", () => {
  it("writes every returned installment child into IndexedDB", async () => {
    const queryClient = new QueryClient();
    const rows = await persistMaterializedSeriesTransactions({
      spaceId: "space-a",
      queryClient,
      transactions: [
        {
          id: "install-root",
          date: "2026-03-01",
          amount: 12500,
          amountCurrency: "PHP",
          type: "expense",
          scheduleType: "installment",
          installmentPeriod: 12,
          parentId: null,
        },
        {
          id: "install-may",
          date: "2027-05-01",
          amount: 12500,
          amountCurrency: "PHP",
          type: "expense",
          scheduleType: "installment",
          installmentPeriod: 12,
          parentId: "install-root",
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(upsertLocalIndexTransaction).toHaveBeenCalledTimes(2);
    expect(upsertLocalIndexTransaction).toHaveBeenCalledWith(
      "space-a",
      expect.objectContaining({
        id: "install-may",
        date: "2027-05-01",
      }),
    );
    expect(upsertIndexTransactionsIntoQueryCaches).toHaveBeenCalledWith(
      queryClient,
      expect.objectContaining({
        spaceId: "space-a",
      }),
    );
  });
});
