import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  cacheAccountsResponse,
  extractAccountsFromResponse,
  loadCachedAccountsResponse,
} from "./local-cache";

describe("accounts local-cache", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("extracts accounts from nested data.accounts", () => {
    const accounts = extractAccountsFromResponse({
      data: {
        accounts: [
          {
            id: "1",
            name: "Cash",
            balance: "10",
            balanceCurrency: "PHP",
            accountCategory: "cash",
          },
        ],
        accountCategoryOptions: [{ label: "Cash", value: "cash" }],
      },
    });

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.name).toBe("Cash");
  });

  it("caches and reloads the full API response", async () => {
    const response = {
      data: {
        accounts: [
          {
            id: "1",
            name: "Cash",
            balance: "10",
            balanceCurrency: "PHP",
            accountCategory: "cash",
          },
        ],
        accountCategoryOptions: [{ label: "Cash", value: "cash" }],
        balanceTotals: {
          total: 10,
          cashTotal: 10,
          payableTotal: 0,
          currency: "PHP",
        },
      },
    };

    await cacheAccountsResponse("space-a", response);

    const cached = await loadCachedAccountsResponse("space-a");
    expect(cached).toEqual(response);
  });
});
