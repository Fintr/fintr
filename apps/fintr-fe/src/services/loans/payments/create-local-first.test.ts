import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_LOAN_PAYMENT_CREATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { cacheLoanDetail, loadCachedLoanPayments, loadCachedLoanSnapshot, cacheLoansAllPages } from "@/services/loans/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { getNextLoanPaymentDeadline } from "@/utils/loan-upcoming-deadlines";
import type { Loan } from "@/services/loans/queries";

vi.mock("../payments", () => ({
  createLoanPayment: vi.fn(),
}));

import { createLoanPayment } from "../payments";
import { createLoanPaymentLocalFirst } from "./create-local-first";

describe("createLoanPaymentLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("optimistically adds loan payments before the network finishes", async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.mocked(createLoanPayment).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const queryClient = new QueryClient();
    const resultPromise = createLoanPaymentLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        loanId: "loan-1",
        data: {
          accountName: "EastWest",
          date: "2026-08-08",
          totalPayment: 200,
          notes: "BAYAD1",
        },
      },
      { queryClient, waitForSync: false, currency: "PHP" },
    );

    const optimistic = await resultPromise;
    expect(optimistic.pendingSync).toBe(true);
    expect(optimistic.localPayment.id.startsWith("local:")).toBe(true);

    const cachedPayments = await loadCachedLoanPayments("space-a", "loan-1");
    expect(cachedPayments).toHaveLength(1);
    expect(cachedPayments?.[0]?.accountName).toBe("EastWest");

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe(CombinedTransactionTypeEnum.LOAN_PAYMENT);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_LOAN_PAYMENT_CREATE);

    resolveCreate({
      data: {
        id: "pay-server-1",
        loanId: "loan-1",
        accountId: "acct-1",
        accountName: "EastWest",
        date: "2026-08-08",
        principalPayment: 200,
        interestPayment: 0,
        totalPayment: 200,
        currency: "PHP",
        notes: "BAYAD1",
      },
    });

    const synced = await optimistic.syncPromise;
    expect(synced.pendingSync).toBe(false);
    expect(synced.data.id).toBe("pay-server-1");
    expect(createLoanPayment).toHaveBeenCalledWith(
      {},
      "loan-1",
      expect.objectContaining({
        accountName: "EastWest",
        totalPayment: 200,
      }),
    );

    const outboxAfter = await getLocalDb().outbox.toArray();
    expect(outboxAfter).toHaveLength(0);
  });

  it("patches the cached loan so the paid installment leaves Next loans to pay", async () => {
    vi.mocked(createLoanPayment).mockImplementation(() => new Promise(() => {}));

    const loan: Loan = {
      id: "loan-1",
      date: "2026-08-11",
      description: null,
      loanType: "borrowed",
      loanTermMonths: 12,
      maturityDate: "2027-08-11",
      status: "active",
      paidOffDate: null,
      interestRate: 0,
      entityName: "Bdo",
      accountName: "SAMPLE BDO LONG ASS NAME",
      principalAmount: 147,
      principalAmountCurrency: "PLN",
      outstandingBalance: 147,
      outstandingBalanceCurrency: "PLN",
      value: -920.91,
      income: 0,
      expense: 0,
      totalValue: 147,
      files: [],
    };

    await cacheLoansAllPages("space-a", [
      {
        loans: [loan],
        nextPage: null,
        totalPages: 1,
        totalCount: 1,
      },
    ]);

    const toLocalDateString = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const before = getNextLoanPaymentDeadline(loan);
    expect(toLocalDateString(before!.dueDate)).toBe("2026-09-11");

    const queryClient = new QueryClient();
    await createLoanPaymentLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        loanId: "loan-1",
        data: {
          accountName: "SAMPLE BDO LONG ASS NAME",
          date: "2026-08-14",
          totalPayment: 12.25,
          principalPayment: 10.41,
        },
      },
      { queryClient, waitForSync: false, currency: "PLN" },
    );

    const patched = await loadCachedLoanSnapshot("space-a", "loan-1");
    expect(patched).toBeDefined();
    expect(patched?.loanPayments).toHaveLength(1);

    const deadline = getNextLoanPaymentDeadline(patched!);
    expect(deadline).not.toBeNull();
    expect(toLocalDateString(deadline!.dueDate)).toBe("2026-10-11");
  });

  it("rejects payments on a retired loan without writing outbox", async () => {
    const loan: Loan = {
      id: "loan-1",
      date: "2026-01-01",
      description: null,
      loanType: "lent",
      loanTermMonths: 12,
      maturityDate: "2027-01-01",
      status: "defaulted",
      paidOffDate: null,
      interestRate: 0,
      entityName: "Ada",
      accountName: "Cash",
      principalAmount: 1000,
      principalAmountCurrency: "PHP",
      outstandingBalance: 800,
      outstandingBalanceCurrency: "PHP",
      value: 800,
      income: 0,
      expense: 0,
      totalValue: 1000,
      files: [],
    };

    await cacheLoanDetail("space-a", "loan-1", loan);

    await expect(
      createLoanPaymentLocalFirst(
        {} as never,
        {
          spaceId: "space-a",
          loanId: "loan-1",
          data: {
            accountName: "Cash",
            date: "2026-08-08",
            totalPayment: 100,
          },
        },
        { waitForSync: false, currency: "PHP" },
      ),
    ).rejects.toMatchObject({
      details: {
        loanId: ["cannot record payments on a retired loan"],
      },
    });

    expect(createLoanPayment).not.toHaveBeenCalled();
    expect(await getLocalDb().outbox.count()).toBe(0);
  });
});
