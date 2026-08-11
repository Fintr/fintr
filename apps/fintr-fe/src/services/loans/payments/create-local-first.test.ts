import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_LOAN_PAYMENT_CREATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { loadCachedLoanPayments } from "@/services/loans/local-cache";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

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
});
