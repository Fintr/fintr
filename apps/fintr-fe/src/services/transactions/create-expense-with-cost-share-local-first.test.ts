import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  getLocalDb,
  listSpaceAccounts,
  OUTBOX_COMMAND_LOAN_CREATE,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { loadCachedLoanSnapshot, loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import { applyLoanCreated } from "@/services/local-sync/apply-loan-change";
import { applyTransactionCreated } from "@/services/local-sync/apply-transaction-change";
import { loadCachedMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/local-cache";
import { cacheAccountsResponse } from "@/services/transactions/accounts/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("./mutation", () => ({
  createTransaction: vi.fn(),
}));

vi.mock("@/services/loans/mutation", () => ({
  createLoan: vi.fn(),
}));

import { createLoan } from "@/services/loans/mutation";

import { createTransaction } from "./mutation";
import { createExpenseWithCostShareLocalFirst } from "./create-expense-with-cost-share-local-first";

const neverResolves = () => new Promise(() => undefined);

const seedCashAccount = async (balance = "2000") => {
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

describe("createExpenseWithCostShareLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createTransaction).mockImplementation(neverResolves);
    vi.mocked(createLoan).mockImplementation(neverResolves);
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("records your share as the expense and a 0% lent loan for the other person", async () => {
    await seedCashAccount("2000");
    const queryClient = new QueryClient();

    const result = await createExpenseWithCostShareLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 1000,
          description: "Dinner",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-08",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
        costShare: {
          mode: "equal",
          participants: [{ entityName: "Entity A" }],
        },
        amountCurrency: "PHP",
      },
      { queryClient, waitForSync: false },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.allocation.yourShare).toBe(500);
    expect(result.allocation.participants).toEqual([
      { entityName: "Entity A", amount: 500 },
    ]);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    const expense = rows.find(
      (row) => row.type === CombinedTransactionTypeEnum.EXPENSE,
    );
    const loanRow = rows.find(
      (row) => row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
    );
    expect(expense?.amount).toBe(500);
    expect(expense?.description).toBe("Dinner");
    expect(loanRow?.amount).toBe(500);
    expect(loanRow?.loanType).toBe("lent");
    expect(loanRow?.entityName).toBe("Entity A");

    const loan = await loadCachedLoanSnapshot(
      "space-a",
      result.loans[0]!.data.id,
    );
    expect(loan?.loanType).toBe("lent");
    expect(loan?.interestRate).toBe(0);
    expect(loan?.principalAmount).toBe(500);
    expect(loan?.entityName).toBe("Entity A");
    expect(loan?.description).toBe("Share of Dinner");
    expect(loan?.loanTermMonths).toBe(1);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox.map((record) => record.commandType).sort()).toEqual([
      OUTBOX_COMMAND_LOAN_CREATE,
      OUTBOX_COMMAND_TRANSACTION_CREATE,
    ]);
    expect(outbox.find((record) => record.commandType === OUTBOX_COMMAND_LOAN_CREATE)?.payload).toEqual(
      expect.objectContaining({
        loanType: "lent",
        interestRate: 0,
        principalAmount: 500,
        entityName: "Entity A",
        adjustsAccountBalance: true,
      }),
    );

    const summaries = await loadCachedMonthlyFinancialSummaries("space-a");
    expect(summaries?.[0]?.totalExpenses).toBe(500);

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts[0]?.balance).toBe("1000");
  });

  it("records a 100 percent share as a loan and skips a zero expense", async () => {
    await seedCashAccount("2000");
    const queryClient = new QueryClient();

    const result = await createExpenseWithCostShareLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 1000,
          description: "Dinner",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-08",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
        costShare: {
          mode: "percent",
          participants: [{ entityName: "Entity A", percent: 100 }],
        },
        amountCurrency: "PHP",
      },
      { queryClient, waitForSync: false },
    );

    expect(result.allocation.yourShare).toBe(0);
    expect(result.expense).toBeNull();
    expect(result.loans).toHaveLength(1);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(
      rows.find((row) => row.type === CombinedTransactionTypeEnum.EXPENSE),
    ).toBeUndefined();
    expect(
      rows.find((row) => row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT)
        ?.amount,
    ).toBe(1000);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox.map((record) => record.commandType)).toEqual([
      OUTBOX_COMMAND_LOAN_CREATE,
    ]);

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts[0]?.balance).toBe("1000");
  });

  it("converts each person's lent share into space currency using the expense rate", async () => {
    await seedCashAccount("50000");
    const queryClient = new QueryClient();

    const result = await createExpenseWithCostShareLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 300,
          description: "Split Bill",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-09-20",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
          original_currency: "GBP",
          exchange_rate: 100,
          exchange_rate_source: "manual",
        },
        costShare: {
          mode: "equal",
          participants: [{ entityName: "Miko2" }],
        },
        entryCurrency: "GBP",
        spaceCurrency: "PHP",
      },
      { queryClient, waitForSync: false },
    );

    expect(result.allocation.yourShare).toBe(150);
    expect(result.allocation.participants).toEqual([
      { entityName: "Miko2", amount: 150 },
    ]);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-09-01",
      "2026-09-30",
    );
    const expense = rows.find(
      (row) => row.type === CombinedTransactionTypeEnum.EXPENSE,
    );
    const loanRow = rows.find(
      (row) => row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
    );

    expect(expense?.amount).toBe(15000);
    expect(expense?.amountCurrency).toBe("PHP");
    expect(loanRow?.amount).toBe(15000);
    expect(loanRow?.amountCurrency).toBe("PHP");

    const loan = await loadCachedLoanSnapshot(
      "space-a",
      result.loans[0]!.data.id,
    );
    expect(loan?.principalAmount).toBe(15000);
    expect(loan?.principalAmountCurrency).toBe("PHP");

    const outbox = await getLocalDb().outbox.toArray();
    expect(
      outbox.find((record) => record.commandType === OUTBOX_COMMAND_LOAN_CREATE)
        ?.payload,
    ).toEqual(
      expect.objectContaining({
        principalAmount: 15000,
        entityName: "Miko2",
      }),
    );

    const accounts = await listSpaceAccounts("space-a");
    expect(accounts[0]?.balance).toBe("20000");
  });

  it("replaces the optimistic split rows when the server create arrives", async () => {
    await seedCashAccount("2000");
    const queryClient = new QueryClient();

    const result = await createExpenseWithCostShareLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          amount: 1000,
          description: "Dinner",
          transactionType: "expense",
          categoryName: "Food",
          accountName: "Cash",
          date: "2026-08-08",
          scheduleType: ScheduleTypeEnum.ONE_TIME,
        },
        costShare: {
          mode: "equal",
          participants: [{ entityName: "Entity A" }],
        },
        amountCurrency: "PHP",
      },
      { queryClient, waitForSync: false },
    );

    const localLoanId = result.loans[0]!.data.id;
    const clientMutationId = localLoanId.slice("local:".length);
    const serverLoanId = "loan-server-split-1";

    await applyLoanCreated({
      spaceId: "space-a",
      queryClient,
      change: {
        seq: 1,
        op: "loan.created",
        occurredAt: "2026-08-08T10:00:00.000Z",
        originClientMutationId: clientMutationId,
        payload: {
          loan: {
            id: serverLoanId,
            date: "2026-08-08",
            description: "Share of Dinner",
            loanType: "lent",
            loanTermMonths: 1,
            maturityDate: "2026-09-08",
            status: "active",
            paidOffDate: null,
            interestRate: 0,
            adjustsAccountBalance: true,
            entityName: "Entity A",
            accountName: "Cash",
            principalAmount: 500,
            principalAmountCurrency: "PHP",
            outstandingBalance: 500,
            outstandingBalanceCurrency: "PHP",
            value: 500,
            income: 0,
            expense: 0,
            totalValue: 500,
            files: [],
            loanPayments: [],
          },
        },
      },
    });

    await applyTransactionCreated({
      spaceId: "space-a",
      queryClient,
      notifyActor: false,
      change: {
        seq: 2,
        op: "transaction.created",
        occurredAt: "2026-08-08T10:00:00.100Z",
        originClientMutationId: clientMutationId,
        payload: {
          transaction: {
            id: serverLoanId,
            date: "2026-08-08",
            createdAt: "2026-08-08T10:00:00.050Z",
            description: "Share of Dinner",
            amount: 500,
            amountCurrency: "PHP",
            categoryName: "Loan",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
            inSeries: false,
            hasImage: false,
            isLoanActivity: true,
            loanType: "lent",
            loanId: serverLoanId,
            entityName: "Entity A",
          },
        },
      },
    });

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    const loanRows = rows.filter(
      (row) => row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
    );
    expect(loanRows.map((row) => row.id)).toEqual([serverLoanId]);

    const cachedLoans = await loadCachedLoansInfiniteData("space-a");
    expect(
      cachedLoans?.pages.flatMap((page) => page.loans.map((loan) => loan.id)),
    ).toEqual([serverLoanId]);
    expect(await loadCachedLoanSnapshot("space-a", localLoanId)).toBeUndefined();
  });
});
