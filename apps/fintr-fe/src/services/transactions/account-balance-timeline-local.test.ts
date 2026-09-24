import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Account } from "@/types/accountTypes";
import {
  CombinedTransactionTypeEnum,
  type IndexTransaction,
} from "@/types/transactionTypes";

vi.mock("@/services/insights/space-currency-amount", () => ({
  preloadExchangeRatesForTransactions: vi.fn(async () => undefined),
  toSpaceDecimal: ({ amount }: { amount: number }) => amount,
}));

vi.mock("@/services/transactions/local-cache", () => ({
  loadCachedTransactionsInRange: vi.fn(),
}));

vi.mock("@/services/transactions/accounts/local-cache", () => ({
  extractAccountsFromResponse: vi.fn(),
}));

import { extractAccountsFromResponse } from "@/services/transactions/accounts/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import {
  buildAccountBalanceTimelineFromCache,
  signedAccountBalanceEffect,
  transactionTouchesAccount,
} from "@/services/transactions/account-balance-timeline-local";

const account: Account = {
  id: "acc-cash",
  name: "Cash",
  balance: "1000",
  balanceCurrency: "PHP",
  accountCategory: "cash",
};

const makeTx = (
  overrides: Partial<IndexTransaction> &
    Pick<IndexTransaction, "id" | "date" | "amount" | "type">,
): IndexTransaction => ({
  description: "",
  categoryName: "",
  fromAccountName: "",
  toAccountName: "",
  inSeries: false,
  hasImage: false,
  amountCurrency: "PHP",
  ...overrides,
});

describe("signedAccountBalanceEffect", () => {
  it("matches by account id even when names differ", () => {
    const tx = makeTx({
      id: "1",
      date: "2025-01-10",
      amount: 200,
      type: CombinedTransactionTypeEnum.INCOME,
      toAccountName: "Old Cash",
      toAccountId: "acc-cash",
    });

    expect(transactionTouchesAccount(tx, account)).toBe(true);
    expect(signedAccountBalanceEffect(tx, account)).toBe(200);
  });

  it("does not match a different account id with the same name", () => {
    const tx = makeTx({
      id: "1",
      date: "2025-01-10",
      amount: 200,
      type: CombinedTransactionTypeEnum.INCOME,
      toAccountName: "Cash",
      toAccountId: "acc-other",
    });

    expect(transactionTouchesAccount(tx, account)).toBe(false);
    expect(signedAccountBalanceEffect(tx, account)).toBe(0);
  });

  it("uses booked amount when it is already in the account currency", () => {
    const tx = makeTx({
      id: "1",
      date: "2025-01-10",
      amount: 20,
      amountCurrency: "USD",
      bookedAmount: 1150,
      bookedAmountCurrency: "PHP",
      type: CombinedTransactionTypeEnum.EXPENSE,
      fromAccountId: "acc-cash",
      fromAccountName: "Cash",
    });

    expect(signedAccountBalanceEffect(tx, account)).toBe(-1150);
  });

  it("signs borrowed loan disbursement as money in", () => {
    const tx = makeTx({
      id: "1",
      date: "2025-01-10",
      amount: 500,
      type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
      loanType: "borrowed",
      toAccountId: "acc-cash",
      toAccountName: "Cash",
    });

    expect(signedAccountBalanceEffect(tx, account)).toBe(500);
  });

  it("signs lent loan disbursement as money out", () => {
    const tx = makeTx({
      id: "1",
      date: "2025-01-10",
      amount: 500,
      type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
      loanType: "lent",
      fromAccountId: "acc-cash",
      fromAccountName: "Cash",
    });

    expect(signedAccountBalanceEffect(tx, account)).toBe(-500);
  });
});

describe("buildAccountBalanceTimelineFromCache", () => {
  beforeEach(() => {
    vi.mocked(extractAccountsFromResponse).mockReturnValue([account]);
  });

  it("plots backdated activity on the transaction date, not createdAt", async () => {
    vi.mocked(loadCachedTransactionsInRange).mockResolvedValue([
      makeTx({
        id: "past",
        date: "2025-01-15",
        createdAt: "2026-08-13T10:00:00.000Z",
        amount: 200,
        type: CombinedTransactionTypeEnum.EXPENSE,
        fromAccountId: "acc-cash",
        fromAccountName: "Cash",
      }),
      makeTx({
        id: "income",
        date: "2025-01-10",
        createdAt: "2026-08-13T11:00:00.000Z",
        amount: 500,
        type: CombinedTransactionTypeEnum.INCOME,
        toAccountId: "acc-cash",
        toAccountName: "Cash",
      }),
    ]);

    const timeline = await buildAccountBalanceTimelineFromCache(
      "space-1",
      {},
      "acc-cash",
      {
        accountId: "acc-cash",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      },
    );

    expect(timeline?.points.map((point) => point.date)).toEqual([
      "2025-01-10",
      "2025-01-15",
    ]);
    expect(timeline?.points.map((point) => point.occurredAt)).toEqual([
      "2025-01-10",
      "2025-01-15",
    ]);
    expect(timeline?.points.map((point) => point.balance)).toEqual([
      1200,
      1000,
    ]);
  });

  it("keeps a window opening when this account already had activity", async () => {
    vi.mocked(loadCachedTransactionsInRange).mockImplementation(
      async (_space, startDate, endDate) => {
        const prior = makeTx({
          id: "prior",
          date: "2024-12-01",
          amount: 800,
          type: CombinedTransactionTypeEnum.INCOME,
          toAccountId: "acc-cash",
          toAccountName: "Cash",
        });
        const inRange = makeTx({
          id: "income",
          date: "2025-01-10",
          amount: 200,
          type: CombinedTransactionTypeEnum.INCOME,
          toAccountId: "acc-cash",
          toAccountName: "Cash",
        });

        if (endDate < "2025-01-01") {
          return startDate <= prior.date ? [prior] : [];
        }

        return [inRange];
      },
    );

    const timeline = await buildAccountBalanceTimelineFromCache(
      "space-1",
      {},
      "acc-cash",
      {
        accountId: "acc-cash",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      },
    );

    expect(timeline?.points.map((point) => point.date)).toEqual([
      "2025-01-01",
      "2025-01-10",
    ]);
    expect(timeline?.points.map((point) => point.balance)).toEqual([
      800,
      1000,
    ]);
  });
});
