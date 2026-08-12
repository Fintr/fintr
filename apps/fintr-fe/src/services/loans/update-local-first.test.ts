import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_LOAN_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { cacheLoanDetail, loadCachedLoanDetail } from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";

vi.mock("./mutation", () => ({
  updateLoan: vi.fn(),
}));

import { updateLoan } from "./mutation";
import { updateLoanLocalFirst } from "./update-local-first";

const baseLoan = (): Loan => ({
  id: "loan-1",
  date: "2026-01-01",
  description: "Old notes",
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2027-01-01",
  status: "active",
  paidOffDate: null,
  interestRate: 5,
  entityName: "Alice",
  accountName: "Cash",
  principalAmount: 1000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 1000,
  outstandingBalanceCurrency: "PHP",
  value: 1000,
  income: 0,
  expense: 0,
  totalValue: 1000,
  files: [],
});

describe("updateLoanLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("patches loan detail and clears outbox on success", async () => {
    await cacheLoanDetail("space-a", "loan-1", baseLoan());
    vi.mocked(updateLoan).mockResolvedValue({ success: true });

    const queryClient = new QueryClient();
    const result = await updateLoanLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          id: "loan-1",
          entityName: "Bob",
          description: "New notes",
        },
      },
      { queryClient, waitForSync: true },
    );

    expect(result.pendingSync).toBe(false);
    expect(result.localLoan.entityName).toBe("Bob");
    const stored = await loadCachedLoanDetail("space-a", "loan-1");
    expect(stored?.entityName).toBe("Bob");
    expect(stored?.description).toBe("New notes");
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("keeps pending outbox when network fails", async () => {
    await cacheLoanDetail("space-a", "loan-1", baseLoan());
    vi.mocked(updateLoan).mockRejectedValue(new Error("Failed to update loan"));

    const result = await updateLoanLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: { id: "loan-1", entityName: "Bob" },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_LOAN_UPDATE);
  });
});
