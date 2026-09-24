import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  listSpaceAccounts,
  listSpaceTransactions,
  putSpaceTransactions,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

import { cacheAccountsResponse } from "./local-cache";

vi.mock("./mutation", () => ({
  deleteAccount: vi.fn(),
}));

import { deleteAccount } from "./mutation";
import { deleteAccountLocalFirst } from "./delete-local-first";

const expense = (
  overrides: Partial<IndexTransaction> = {},
): IndexTransaction => ({
  id: "tx-coffee",
  date: "2026-09-01",
  description: "Coffee",
  amount: 40,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  accountId: "acc-cash",
  fromAccountId: "acc-cash",
  calculated: true,
  ...overrides,
});

describe("deleteAccountLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteAccount).mockImplementation(() => new Promise(() => {}));
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  const seedAccounts = async () => {
    await cacheAccountsResponse("space-a", {
      data: {
        accounts: [
          {
            id: "acc-cash",
            name: "Cash",
            balance: "900",
            balanceCurrency: "PHP",
            accountCategory: "cash",
          },
          {
            id: "acc-bank",
            name: "Bank",
            balance: "600",
            balanceCurrency: "PHP",
            accountCategory: "savings",
          },
        ],
      },
    });
  };

  it("leaves transactions in IndexedDB when removeTransactions is off", async () => {
    await seedAccounts();
    await putSpaceTransactions("space-a", [
      expense(),
      expense({
        id: "tx-bank",
        accountId: "acc-bank",
        fromAccountId: "acc-bank",
        fromAccountName: "Bank",
        description: "Rent",
      }),
    ]);

    await deleteAccountLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        accountId: "acc-cash",
      },
      { waitForSync: false },
    );

    const remaining = await listSpaceTransactions("space-a");
    expect(remaining.map((row) => row.id).sort()).toEqual([
      "tx-bank",
      "tx-coffee",
    ]);
    expect(await listSpaceAccounts("space-a")).toEqual([
      expect.objectContaining({ id: "acc-bank" }),
    ]);
  });

  it("removes the account transactions from IndexedDB and reverts the other account", async () => {
    await seedAccounts();
    await putSpaceTransactions("space-a", [
      expense(),
      expense({
        id: "tx-bank",
        accountId: "acc-bank",
        fromAccountId: "acc-bank",
        fromAccountName: "Bank",
        description: "Rent",
      }),
      {
        id: "tx-transfer",
        date: "2026-09-02",
        description: "Move",
        amount: 100,
        categoryName: "",
        fromAccountName: "Cash",
        toAccountName: "Bank",
        type: CombinedTransactionTypeEnum.TRANSFER,
        inSeries: false,
        hasImage: false,
        fromAccountId: "acc-cash",
        toAccountId: "acc-bank",
        calculated: true,
      },
      {
        id: "tx-loan",
        date: "2026-09-03",
        description: "Loan",
        amount: 1000,
        categoryName: "",
        fromAccountName: "",
        toAccountName: "Cash",
        type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
        inSeries: false,
        hasImage: false,
        accountId: "acc-cash",
        loanType: "borrowed",
        calculated: true,
      },
    ]);

    await deleteAccountLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        accountId: "acc-cash",
        removeTransactions: true,
      },
      { waitForSync: false },
    );

    const remaining = await listSpaceTransactions("space-a");
    expect(remaining.map((row) => row.id)).toEqual(["tx-bank"]);

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts.find((row) => row.id === "acc-cash")).toBeUndefined();
    expect(accounts.find((row) => row.id === "acc-bank")?.balance).toBe("500");

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox[0]?.payload).toMatchObject({
      accountId: "acc-cash",
      removeTransactions: true,
    });
    expect(deleteAccount).toHaveBeenCalledWith(
      expect.anything(),
      "acc-cash",
      { removeTransactions: true },
    );
  });
});
