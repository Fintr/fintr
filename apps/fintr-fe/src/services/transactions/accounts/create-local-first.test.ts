import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listSpaceAccounts, resetLocalDbForTests } from "@/lib/local-db";

import { cacheAccountsResponse, loadCachedAccountsResponse } from "./local-cache";

vi.mock("./mutation", () => ({
  createAccount: vi.fn(),
}));

vi.mock("./queries", () => ({
  fetchAccounts: vi.fn(),
}));

import { createAccount } from "./mutation";
import { fetchAccounts } from "./queries";
import { createAccountLocalFirst } from "./create-local-first";

describe("createAccountLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAccount).mockImplementation(() => new Promise(() => {}));
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("writes a foreign-currency account to IndexedDB and keeps space currency on totals", async () => {
    await cacheAccountsResponse("space-a", {
      data: {
        accounts: [
          {
            id: "acc-cash",
            name: "Cash",
            balance: "1000",
            balanceCurrency: "PHP",
            accountCategory: "cash",
          },
        ],
        balanceTotals: {
          total: 1000,
          cashTotal: 1000,
          payableTotal: 0,
          currency: "PHP",
        },
      },
    });

    const result = await createAccountLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          name: "USD Wallet",
          balance: 50,
          accountCategory: "cash",
          balanceCurrency: "USD",
        },
      },
      { waitForSync: false, balanceCurrency: "PHP" },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.localAccount.balanceCurrency).toBe("USD");

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts.find((row) => row.name === "USD Wallet")).toMatchObject({
      balance: "50",
      balanceCurrency: "USD",
    });

    const cached = await loadCachedAccountsResponse("space-a");
    const totals = (
      cached as {
        data: { balanceTotals: { total: number; currency: string } };
      }
    ).data.balanceTotals;
    expect(totals.currency).toBe("PHP");
    expect(totals.total).toBe(1000);
  });

  it("replaces the local snapshot with the server list in the space currency", async () => {
    await cacheAccountsResponse("space-a", {
      data: {
        accounts: [
          {
            id: "acc-cash",
            name: "Cash",
            balance: "1000",
            balanceCurrency: "PHP",
            accountCategory: "cash",
          },
        ],
        balanceTotals: {
          total: 1000,
          cashTotal: 1000,
          payableTotal: 0,
          currency: "PHP",
        },
      },
    });

    vi.mocked(createAccount).mockResolvedValue({
      data: {
        id: "acc-usd",
        name: "USD Wallet",
        balance: "50",
        balanceCurrency: "USD",
        accountCategory: "cash",
      },
    });
    vi.mocked(fetchAccounts).mockResolvedValue({
      data: {
        accounts: [
          {
            id: "acc-cash",
            name: "Cash",
            balance: "1000",
            balanceCurrency: "PHP",
            accountCategory: "cash",
          },
          {
            id: "acc-usd",
            name: "USD Wallet",
            balance: "50",
            balanceCurrency: "USD",
            accountCategory: "cash",
          },
        ],
        balanceTotals: {
          total: 3750,
          cashTotal: 3750,
          payableTotal: 0,
          currency: "PHP",
        },
      },
    });

    const result = await createAccountLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          name: "USD Wallet",
          balance: 50,
          accountCategory: "cash",
          balanceCurrency: "USD",
        },
      },
      { waitForSync: true, balanceCurrency: "PHP" },
    );

    expect(result.pendingSync).toBe(false);
    expect(result.data.id).toBe("acc-usd");

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts.find((row) => row.id === "acc-usd")).toMatchObject({
      balanceCurrency: "USD",
    });

    const cached = await loadCachedAccountsResponse("space-a");
    const totals = (
      cached as {
        data: { balanceTotals: { total: number; currency: string } };
      }
    ).data.balanceTotals;
    expect(totals.currency).toBe("PHP");
    expect(totals.total).toBe(3750);
  });
});
