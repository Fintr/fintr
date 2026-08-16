import { describe, expect, it } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { transactionMatchesEntryTypeFilter } from "@/utils/transactionEntryTypeFilter";

describe("transactionMatchesEntryTypeFilter", () => {
  it("includes every type when filter is all", () => {
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.TRANSFER,
        "all",
      ),
    ).toBe(true);
  });

  it("matches STI and plural type strings used in local caches", () => {
    expect(
      transactionMatchesEntryTypeFilter("Transactions::Expense", "expense"),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter("Transactions::Income", "income"),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter("transfers", "transfers"),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter("Transactions::Loan", "loans"),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter("Transactions::LoanPayment", "loans"),
    ).toBe(true);
  });

  it("infers loan rows from loan activity metadata", () => {
    expect(
      transactionMatchesEntryTypeFilter(
        undefined,
        "loans",
        {
          isLoanActivity: true,
          categoryName: "Loan payment",
        },
      ),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter(
        undefined,
        "transfers",
        {
          fromAccountName: "Cash",
          toAccountName: "Savings",
        },
      ),
    ).toBe(true);
  });

  it("infers expense and income from account names when type is missing", () => {
    expect(
      transactionMatchesEntryTypeFilter(
        undefined,
        "expense",
        {
          fromAccountName: "Cash",
          toAccountName: "",
        },
      ),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter(
        undefined,
        "income",
        {
          fromAccountName: "",
          toAccountName: "Cash",
        },
      ),
    ).toBe(true);
  });

  it("matches expense only for expense filter", () => {
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.EXPENSE,
        "expense",
      ),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.INCOME,
        "expense",
      ),
    ).toBe(false);
  });

  it("matches income only for income filter", () => {
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.INCOME,
        "income",
      ),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.EXPENSE,
        "income",
      ),
    ).toBe(false);
  });

  it("matches transfers only for transfers filter", () => {
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.TRANSFER,
        "transfers",
      ),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.EXPENSE,
        "transfers",
      ),
    ).toBe(false);
  });

  it("matches loan disbursements and payments for loans filter", () => {
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
        "loans",
      ),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.LOAN_PAYMENT,
        "loans",
      ),
    ).toBe(true);
    expect(
      transactionMatchesEntryTypeFilter(
        CombinedTransactionTypeEnum.INCOME,
        "loans",
      ),
    ).toBe(false);
  });
});
