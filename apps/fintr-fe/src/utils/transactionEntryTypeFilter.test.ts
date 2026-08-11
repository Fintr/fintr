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
