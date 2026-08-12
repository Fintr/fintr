import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_LOAN_PAYMENT_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import {
  cacheLoanPayments,
  loadCachedLoanPayments,
} from "@/services/loans/local-cache";
import type { LoanPayment } from "@/services/loans/payments";

vi.mock("../payments", () => ({
  updateLoanPayment: vi.fn(),
}));

import { updateLoanPayment } from "../payments";
import { updateLoanPaymentLocalFirst } from "./update-local-first";

const basePayment = (): LoanPayment => ({
  id: "pay-1",
  loanId: "loan-1",
  accountId: "acc-1",
  accountName: "Cash",
  date: "2026-08-01",
  principalPayment: 100,
  interestPayment: 0,
  totalPayment: 100,
  currency: "PHP",
  notes: "First",
  adjustsAccountBalance: true,
});

describe("updateLoanPaymentLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("patches payment and clears outbox on success", async () => {
    await cacheLoanPayments("space-a", "loan-1", [basePayment()]);
    vi.mocked(updateLoanPayment).mockResolvedValue({
      data: { ...basePayment(), totalPayment: 250, notes: "Updated" },
    });

    const result = await updateLoanPaymentLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        loanId: "loan-1",
        paymentId: "pay-1",
        data: { totalPayment: 250, notes: "Updated" },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(false);
    const stored = await loadCachedLoanPayments("space-a", "loan-1");
    expect(stored?.[0]?.totalPayment).toBe(250);
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("keeps pending outbox when network fails", async () => {
    await cacheLoanPayments("space-a", "loan-1", [basePayment()]);
    vi.mocked(updateLoanPayment).mockRejectedValue(
      new Error("Failed to update loan payment"),
    );

    const result = await updateLoanPaymentLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        loanId: "loan-1",
        paymentId: "pay-1",
        data: { totalPayment: 250 },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_LOAN_PAYMENT_UPDATE);
  });
});
