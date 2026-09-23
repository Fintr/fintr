import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { listSpaceAccounts, resetLocalDbForTests } from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  applyAccountsResponseToCaches,
  applyLocalTransactionsToAccountBalances,
} from "./account-cache-ops";
import {
  cacheDashboardShell,
  loadCachedDashboardShell,
} from "@/services/monthly-financial-summaries/local-cache";
import {
  cacheAccountsResponse,
  extractAccountsFromResponse,
  loadCachedAccountsResponse,
} from "./local-cache";

const seedCashAccount = async (balance = "1000") => {
  await cacheAccountsResponse("space-a", {
    data: {
      accounts: [
        {
          id: "acc-cash",
          name: "Cash",
          balance,
          balanceCurrency: "PHP",
          accountCategory: "cash",
        },
      ],
      balanceTotals: {
        total: Number(balance),
        cashTotal: Number(balance),
        payableTotal: 0,
        currency: "PHP",
      },
    },
  });
};

const cashExpense = (params: {
  id?: string;
  amount?: number;
  date?: string;
  calculated?: boolean;
}) => ({
  id: params.id ?? "tx-1",
  date: params.date ?? "2026-09-07",
  description: "Lunch",
  amount: params.amount ?? 100,
  amountCurrency: "PHP",
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  fromAccountId: "acc-cash",
  accountId: "acc-cash",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  calculated: params.calculated,
});

describe("applyAccountsResponseToCaches", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("overlays accounts-list balances onto a stale dashboard shell picker snapshot", async () => {
    await cacheDashboardShell("space-a", {
      id: "dash-1",
      categoryOptions: [],
      accountOptions: [
        {
          label: "EastWest",
          value: "EastWest",
          currency: "PHP",
          accountCategory: "debit",
          balance: -24430110.77,
        },
      ],
      expenseCategoryOptions: [],
      incomeCategoryOptions: [],
      goalDescription: "Save",
    });

    await applyAccountsResponseToCaches({
      spaceId: "space-a",
      response: {
        data: {
          accounts: [
            {
              id: "acc-eastwest",
              name: "EastWest",
              balance: "569889.23",
              balanceCurrency: "PHP",
              accountCategory: "debit",
            },
          ],
        },
      },
    });

    const shell = await loadCachedDashboardShell("space-a");
    expect(
      Number(
        shell?.accountOptions.find((option) => option.value === "EastWest")
          ?.balance,
      ),
    ).toBe(569889.23);
  });
});

describe("applyLocalTransactionsToAccountBalances", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("deducts a calculated expense from the source account", async () => {
    await seedCashAccount("1000");
    const queryClient = new QueryClient();

    await applyLocalTransactionsToAccountBalances({
      spaceId: "space-a",
      transactions: [cashExpense({ calculated: true })],
      mode: "apply",
      queryClient,
    });

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts.find((row) => row.id === "acc-cash")?.balance).toBe("900");

    const cached = await loadCachedAccountsResponse("space-a");
    expect(extractAccountsFromResponse(cached)[0]?.balance).toBe("900");
    expect(
      (cached as { data: { balanceTotals: { total: number } } }).data
        .balanceTotals.total,
    ).toBe(900);
  });

  it("returns a calculated expense to the source account on revert", async () => {
    await seedCashAccount("900");

    await applyLocalTransactionsToAccountBalances({
      spaceId: "space-a",
      transactions: [cashExpense({ calculated: true })],
      mode: "revert",
    });

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts.find((row) => row.id === "acc-cash")?.balance).toBe("1000");
  });

  it("does not move cash for transfers or transfer fees", async () => {
    await seedCashAccount("1000");

    await applyLocalTransactionsToAccountBalances({
      spaceId: "space-a",
      transactions: [
        {
          ...cashExpense({ calculated: true, amount: 200 }),
          type: CombinedTransactionTypeEnum.TRANSFER,
          toAccountName: "Bank",
        },
        {
          ...cashExpense({ id: "fee-1", calculated: true, amount: 25 }),
          categoryName: "Transfer Fee",
        },
      ],
      mode: "apply",
    });

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts.find((row) => row.id === "acc-cash")?.balance).toBe("1000");
  });

  it("does not change the account for pending future occurrences", async () => {
    await seedCashAccount("900");

    await applyLocalTransactionsToAccountBalances({
      spaceId: "space-a",
      transactions: [
        cashExpense({
          id: "future",
          date: "2026-10-07",
          calculated: false,
        }),
      ],
      mode: "revert",
    });

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts.find((row) => row.id === "acc-cash")?.balance).toBe("900");
  });
});
