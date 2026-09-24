import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import {
  loadCachedLoanSnapshot,
  upsertLoanInCachedPages,
} from "@/services/loans/local-cache";
import { upsertLoanInQueryCaches } from "@/services/loans/loans-list-cache";
import type { Loan } from "@/services/loans/queries";
import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { applyLoanCreated } from "./apply-loan-change";

const buildLoan = (id: string): Loan => ({
  id,
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
});

describe("applyLoanCreated — optimistic reconcile", () => {
  const spaceId = "space-a";

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("renames local:cid to the server id before upsert (no duplicate loan)", async () => {
    const queryClient = new QueryClient();
    const clientMutationId = "cid-loan-1";
    const localId = `local:${clientMutationId}`;
    const serverId = "loan-server-1";
    const localLoan = buildLoan(localId);

    await upsertLocalIndexTransaction(spaceId, {
      id: localId,
      date: "2026-08-08",
      createdAt: "2026-08-08T10:00:00.000Z",
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
      loanId: localId,
      entityName: "Entity A",
    });
    await upsertLoanInCachedPages(spaceId, localLoan, {
      queryClient,
      seedListWhenEmpty: true,
    });
    upsertLoanInQueryCaches(queryClient, {
      spaceCode: spaceId,
      loan: localLoan,
      seedListWhenEmpty: true,
    });

    await applyLoanCreated({
      spaceId,
      queryClient,
      change: {
        seq: 4,
        op: "loan.created",
        occurredAt: "2026-08-08T10:00:00.100Z",
        originClientMutationId: clientMutationId,
        payload: {
          loan: buildLoan(serverId),
        },
      },
    });

    const readLoanIds = (
      key: readonly unknown[],
    ): string[] | undefined =>
      queryClient
        .getQueryData<{ pages: Array<{ loans: Array<{ id: string }> }> }>(key)
        ?.pages.flatMap((page) => page.loans.map((loan) => loan.id));

    expect(readLoanIds(["loans", spaceId])).toEqual([serverId]);
    expect(readLoanIds(["loans", "local", spaceId])).toEqual([serverId]);
    expect(await loadCachedLoanSnapshot(spaceId, localId)).toBeUndefined();
    expect(await loadCachedLoanSnapshot(spaceId, serverId)).toMatchObject({
      id: serverId,
      entityName: "Entity A",
    });
    expect(await loadLocalIndexTransactionById(spaceId, localId)).toBeUndefined();
    expect((await loadLocalIndexTransactionById(spaceId, serverId))?.id).toBe(
      serverId,
    );
  });
});
