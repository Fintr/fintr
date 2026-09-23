import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_LOAN_CREATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { loadCachedLoanSnapshot } from "@/services/loans/local-cache";

vi.mock("./mutation", () => ({
  createLoan: vi.fn(),
}));

import { createLoan } from "./mutation";
import { createLoanLocalFirst } from "./create-local-first";

describe("createLoanLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("writes the loan into IndexedDB and the outbox before the network finishes", async () => {
    let resolveCreate: (value: unknown) => void = () => undefined;
    vi.mocked(createLoan).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    const queryClient = new QueryClient();
    const result = await createLoanLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          principalAmount: 1500,
          interestRate: 4,
          date: "2026-03-01",
          loanType: "borrowed",
          entityName: "Mina",
          accountName: "Cash",
          loanTermMonths: 12,
          description: "New bike",
        },
      },
      { queryClient, waitForSync: false, amountCurrency: "PHP" },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.data.id.startsWith("local:")).toBe(true);

    const stored = await loadCachedLoanSnapshot("space-a", result.data.id);
    expect(stored?.entityName).toBe("Mina");
    expect(stored?.principalAmount).toBe(1500);
    expect(stored?.outstandingBalance).toBe(1500);
    expect(stored?.accountName).toBe("Cash");

    const cachedList = queryClient.getQueryData<{
      pages: Array<{ loans: Array<{ id: string }> }>;
    }>(["loans"]);
    expect(cachedList?.pages[0]?.loans.map((loan) => loan.id)).toEqual([
      result.data.id,
    ]);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_LOAN_CREATE);

    resolveCreate({ data: { id: "loan-server-1" } });
    await result.syncPromise;
  });

  it("sends clientMutationId so server loan creates are idempotent for retries", async () => {
    vi.mocked(createLoan).mockResolvedValue({ data: { id: "loan-server-1" } });

    const result = await createLoanLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          principalAmount: 1500,
          interestRate: 4,
          date: "2026-03-01",
          loanType: "borrowed",
          entityName: "Mina",
          accountName: "Cash",
          loanTermMonths: 12,
          description: "New bike",
        },
      },
      { waitForSync: true, amountCurrency: "PHP" },
    );

    expect(createLoan).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        principalAmount: 1500,
        clientMutationId: expect.stringMatching(/\S+/),
      }),
    );
    expect(result.data.id).toBe("loan-server-1");
  });

  it("replaces the optimistic local loan with the server id without duplicating list rows", async () => {
    vi.mocked(createLoan).mockResolvedValue({ data: { id: "loan-server-1" } });

    const queryClient = new QueryClient();
    const result = await createLoanLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        data: {
          principalAmount: 1500,
          interestRate: 4,
          date: "2026-03-01",
          loanType: "borrowed",
          entityName: "Mina",
          accountName: "Cash",
          loanTermMonths: 12,
          description: "New bike",
        },
      },
      { queryClient, waitForSync: false, amountCurrency: "PHP" },
    );

    const localId = result.data.id;
    expect(localId.startsWith("local:")).toBe(true);

    await result.syncPromise;

    const readLoanIds = (
      key: readonly unknown[],
    ): string[] | undefined =>
      queryClient
        .getQueryData<{ pages: Array<{ loans: Array<{ id: string }> }> }>(key)
        ?.pages.flatMap((page) => page.loans.map((loan) => loan.id));

    expect(readLoanIds(["loans"])).toEqual(["loan-server-1"]);
    expect(readLoanIds(["loans", "local", "space-a"])).toEqual([
      "loan-server-1",
    ]);

    const stored = await loadCachedLoanSnapshot("space-a", "loan-server-1");
    expect(stored?.entityName).toBe("Mina");
    expect(await loadCachedLoanSnapshot("space-a", localId)).toBeUndefined();
  });
});
