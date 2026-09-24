import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { replaceSpaceAccounts } from "@/lib/local-db/accounts";
import { putSpaceTransactions } from "@/lib/local-db/transactions";
import { cacheLoanPayments, cacheLoansAllPages } from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import type { Account } from "@/types/accountTypes";
import {
  CombinedTransactionTypeEnum,
  type IndexTransaction,
} from "@/types/transactionTypes";

import { loadCachedAccountActivitiesPage } from "./account-activities-local";

const SPACE = "SPACE_1";

const cash: Account = {
  id: "acc-cash",
  name: "Cash",
  balance: "3200",
  balanceCurrency: "PHP",
  accountCategory: "cash",
};

const makeTx = (
  overrides: Partial<IndexTransaction> &
    Pick<IndexTransaction, "id" | "date" | "amount" | "type">,
): IndexTransaction => ({
  description: "",
  categoryName: "Food",
  fromAccountName: "",
  toAccountName: "",
  inSeries: false,
  hasImage: false,
  amountCurrency: "PHP",
  ...overrides,
});

const makeLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  date: "2026-05-04",
  description: "Borrowed float",
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2027-05-04",
  status: "active",
  paidOffDate: null,
  interestRate: 0,
  entityName: "Cebu Pacific",
  accountName: "Cash",
  principalAmount: 36000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 36000,
  outstandingBalanceCurrency: "PHP",
  value: 36000,
  income: 36000,
  expense: 0,
  totalValue: 36000,
  files: [],
  ...overrides,
});

describe("loadCachedAccountActivitiesPage", () => {
  beforeEach(async () => {
    await resetLocalDbForTests();
    await replaceSpaceAccounts(SPACE, [cash]);
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("assembles income, expense, transfer, loan, and loan payment rows that point at the account", async () => {
    await putSpaceTransactions(SPACE, [
      makeTx({
        id: "income-1",
        date: "2026-05-12",
        amount: 353.19,
        type: CombinedTransactionTypeEnum.INCOME,
        toAccountId: "acc-cash",
        toAccountName: "Renamed Cash",
        description: "Initial balance",
      }),
      makeTx({
        id: "expense-1",
        date: "2026-06-01",
        amount: 120,
        type: CombinedTransactionTypeEnum.EXPENSE,
        fromAccountId: "acc-cash",
        fromAccountName: "Old Cash",
        description: "Coffee",
      }),
      makeTx({
        id: "transfer-1",
        date: "2026-06-02",
        amount: 500,
        type: CombinedTransactionTypeEnum.TRANSFER,
        fromAccountId: "acc-cash",
        toAccountId: "acc-other",
        fromAccountName: "Cash",
        toAccountName: "Savings",
        description: "Move to savings",
      }),
      makeTx({
        id: "loan-1",
        date: "2026-05-04",
        amount: 36000,
        type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
        accountId: "acc-cash",
        toAccountId: "acc-cash",
        loanType: "borrowed",
        isLoanActivity: true,
        loanId: "loan-1",
        description: "Borrowed float",
      }),
      makeTx({
        id: "pay-1",
        date: "2026-06-10",
        amount: 1000,
        type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
        fromAccountId: "acc-cash",
        isLoanActivity: true,
        loanId: "loan-1",
        description: "Loan payment",
      }),
      makeTx({
        id: "other-account",
        date: "2026-06-03",
        amount: 80,
        type: CombinedTransactionTypeEnum.EXPENSE,
        fromAccountId: "acc-other",
        fromAccountName: "Savings",
        description: "Not this account",
      }),
    ]);

    const page = await loadCachedAccountActivitiesPage(SPACE, "Cash", {
      accountId: "acc-cash",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      categoryFilters: [],
      searchQuery: "",
      page: 1,
    });

    expect(page?.activities.map((row) => row.id)).toEqual([
      "pay-1",
      "transfer-1",
      "expense-1",
      "income-1",
      "loan-1",
    ]);
    expect(page?.activities.map((row) => row.type)).toEqual([
      CombinedTransactionTypeEnum.LOAN_PAYMENT,
      CombinedTransactionTypeEnum.TRANSFER,
      CombinedTransactionTypeEnum.EXPENSE,
      CombinedTransactionTypeEnum.INCOME,
      CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
    ]);
    expect(page?.totalCount).toBe(5);
  });

  it("includes loan and loan payment rows from local loan caches when they are missing from the transaction index", async () => {
    await cacheLoansAllPages(SPACE, [
      {
        loans: [makeLoan()],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
      },
    ]);

    const payment: LoanPayment = {
      id: "pay-local",
      loanId: "loan-1",
      accountId: "acc-cash",
      accountName: "Cash",
      date: "2026-06-10",
      principalPayment: 1000,
      interestPayment: 0,
      totalPayment: 1000,
      currency: "PHP",
    };

    await cacheLoanPayments(SPACE, "loan-1", [payment]);

    const page = await loadCachedAccountActivitiesPage(SPACE, "Cash", {
      accountId: "acc-cash",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      categoryFilters: [],
      searchQuery: "",
      page: 1,
    });

    expect(page?.activities.map((row) => row.id).sort()).toEqual([
      "loan-1",
      "pay-local",
    ]);
    expect(
      page?.activities.find((row) => row.id === "loan-1")?.type,
    ).toBe(CombinedTransactionTypeEnum.LOAN_DISBURSEMENT);
    expect(
      page?.activities.find((row) => row.id === "pay-local")?.type,
    ).toBe(CombinedTransactionTypeEnum.LOAN_PAYMENT);
  });

  it("returns an empty page instead of undefined when the account exists locally", async () => {
    const page = await loadCachedAccountActivitiesPage(SPACE, "Cash", {
      accountId: "acc-cash",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      categoryFilters: [],
      searchQuery: "",
      page: 1,
    });

    expect(page).toEqual(
      expect.objectContaining({
        activities: [],
        nextPage: null,
        totalCount: 0,
      }),
    );
  });
});
