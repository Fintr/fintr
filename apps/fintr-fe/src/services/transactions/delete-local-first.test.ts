import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeleteScopeEnum } from "@/constants/transactionConstants";
import {
  enqueueOutboxRecord,
  getLocalDb,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  OUTBOX_COMMAND_TRANSACTION_DELETE,
  OUTBOX_COMMAND_TRANSFER_DELETE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { upsertLocalIndexTransaction } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("./mutation", () => ({
  deleteTransaction: vi.fn(),
}));

vi.mock("./transfers/mutation", () => ({
  deleteTransfer: vi.fn(),
}));

vi.mock("@/services/loans/payments", () => ({
  deleteLoanPayment: vi.fn(),
}));

vi.mock("@/services/loans/mutation", () => ({
  deleteLoan: vi.fn(),
}));

import { deleteTransaction } from "./mutation";
import { deleteTransfer } from "./transfers/mutation";
import { deleteLoanPayment } from "@/services/loans/payments";
import { deleteLoan } from "@/services/loans/mutation";
import { deleteTransactionLocalFirst } from "./delete-local-first";

const listQueryKey = [
  "transactions",
  "space-a",
  "[]",
  "2026-08-01",
  "2026-08-31",
  "",
  "",
  "",
  "[]",
  "local",
] as const;

const seedExpense = async (params: {
  id: string;
  date?: string;
  description?: string;
  inSeries?: boolean;
}) => {
  await upsertLocalIndexTransaction("space-a", {
    id: params.id,
    date: params.date ?? "2026-08-08",
    description: params.description ?? "Lunch",
    amount: 50,
    amountCurrency: "PHP",
    categoryName: "Food",
    fromAccountName: "Cash",
    toAccountName: "",
    type: CombinedTransactionTypeEnum.EXPENSE,
    inSeries: params.inSeries ?? false,
    hasImage: false,
  });
};

describe("deleteTransactionLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("removes locally then clears outbox when the server succeeds", async () => {
    await seedExpense({ id: "server-tx-1" });
    vi.mocked(deleteTransaction).mockResolvedValue({ success: true });

    const result = await deleteTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      transactionId: "server-tx-1",
      deleteScope: DeleteScopeEnum.THIS_ONLY,
    });

    expect(result.pendingSync).toBe(false);
    expect(result.removedIds).toEqual(["server-tx-1"]);
    expect(deleteTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "server-tx-1",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
      }),
    );

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("keeps the local delete and a pending outbox when the network fails", async () => {
    await seedExpense({ id: "server-tx-2" });
    vi.mocked(deleteTransaction).mockRejectedValue(
      new Error("Failed to delete transaction"),
    );

    const result = await deleteTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      transactionId: "server-tx-2",
      deleteScope: DeleteScopeEnum.THIS_ONLY,
    });

    expect(result.pendingSync).toBe(true);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);

    const pending = await getLocalDb()
      .outbox.where("status")
      .equals("pending")
      .toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.commandType).toBe(OUTBOX_COMMAND_TRANSACTION_DELETE);
  });

  it("keeps the local delete when the server says not found", async () => {
    await seedExpense({ id: "server-tx-3" });
    vi.mocked(deleteTransaction).mockRejectedValue({
      success: false,
      message: "Validation failed",
      details: { id: ["Transaction not found"] },
    });

    const result = await deleteTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      transactionId: "server-tx-3",
      deleteScope: DeleteScopeEnum.THIS_ONLY,
    });

    expect(result.pendingSync).toBe(false);
    expect(result.removedIds).toEqual(["server-tx-3"]);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("does not delete a fingerprint twin one-time expense under stale all_in_series", async () => {
    await seedExpense({ id: "expense-a", date: "2026-08-10" });
    await seedExpense({ id: "expense-b", date: "2026-08-09" });
    vi.mocked(deleteTransaction).mockResolvedValue({ success: true });

    const listRow = {
      id: "expense-a",
      date: "2026-08-10",
      description: "Lunch",
      amount: 50,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };

    const queryClient = new QueryClient();
    queryClient.setQueryData(listQueryKey, {
      pages: [
        {
          transactions: [
            listRow,
            { ...listRow, id: "expense-b", date: "2026-08-09" },
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
          totals: { income: 0, expense: 100, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    const result = await deleteTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        transactionId: "expense-a",
        deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
        listRow,
      },
      { queryClient, waitForSync: false },
    );

    expect(result.removedIds).toEqual(["expense-a"]);
    expect(
      queryClient.getQueryData<{
        pages: Array<{ transactions: Array<{ id: string }> }>;
      }>(listQueryKey)?.pages[0]?.transactions.map((row) => row.id),
    ).toEqual(["expense-b"]);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows.map((row) => row.id)).toEqual(["expense-b"]);
  });

  it("cancels a pending create for never-synced local ids", async () => {
    const clientMutationId = "cid-local-1";
    const localId = `local:${clientMutationId}`;
    await seedExpense({ id: localId });
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
      clientMutationId,
      payload: {
        amount: 50,
        description: "Lunch",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
      },
    });

    const result = await deleteTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      transactionId: localId,
      deleteScope: DeleteScopeEnum.THIS_ONLY,
    });

    expect(result.pendingSync).toBe(false);
    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(await getLocalDb().outbox.count()).toBe(0);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);
  });

  it("optimistically removes expenses from React Query before the network finishes", async () => {
    const expense = {
      id: "exp-1",
      date: "2026-08-08",
      description: "Lunch",
      amount: 50,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    };
    await upsertLocalIndexTransaction("space-a", expense);

    let resolveDelete: (value: unknown) => void = () => undefined;
    vi.mocked(deleteTransaction).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const queryClient = new QueryClient();
    queryClient.setQueryData(listQueryKey, {
      pages: [
        {
          transactions: [expense],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 50, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    const result = await deleteTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        transactionId: "exp-1",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
        listRow: expense,
      },
      {
        queryClient,
        waitForSync: false,
      },
    );

    expect(result.pendingSync).toBe(true);
    expect(
      queryClient.getQueryData<{
        pages: Array<{ transactions: unknown[] }>;
      }>(listQueryKey)?.pages[0]?.transactions,
    ).toHaveLength(0);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);

    resolveDelete({ success: true });
    const synced = await result.syncPromise;
    expect(synced.pendingSync).toBe(false);
    expect(deleteTransaction).toHaveBeenCalledOnce();
  });

  it("optimistically removes transfers from React Query before the network finishes", async () => {
    const transfer = {
      id: "xfer-1",
      date: "2026-08-08",
      createdAt: "2026-08-08T10:00:00.000Z",
      description: "Move money",
      amount: 100,
      amountCurrency: "PHP",
      categoryName: "Transfer",
      fromAccountName: "Cash",
      toAccountName: "Bank",
      type: CombinedTransactionTypeEnum.TRANSFER,
      inSeries: false,
      hasImage: false,
    };
    await upsertLocalIndexTransaction("space-a", transfer);

    let resolveDelete: (value: unknown) => void = () => undefined;
    vi.mocked(deleteTransfer).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const queryClient = new QueryClient();
    queryClient.setQueryData(listQueryKey, {
      pages: [
        {
          transactions: [transfer],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 0, transfer: 100 },
        },
      ],
      pageParams: [1],
    });

    const result = await deleteTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        transactionId: "xfer-1",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
        listRow: transfer,
      },
      {
        queryClient,
        waitForSync: false,
      },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.removedIds).toEqual(["xfer-1"]);
    expect(
      queryClient.getQueryData<{
        pages: Array<{ transactions: unknown[] }>;
      }>(listQueryKey)?.pages[0]?.transactions,
    ).toHaveLength(0);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);

    const syncing = await getLocalDb()
      .outbox.where("status")
      .equals("syncing")
      .toArray();
    expect(syncing).toHaveLength(1);
    expect(syncing[0]?.commandType).toBe(OUTBOX_COMMAND_TRANSFER_DELETE);

    resolveDelete({ success: true });
    const synced = await result.syncPromise;
    expect(synced.pendingSync).toBe(false);
    expect(deleteTransfer).toHaveBeenCalledOnce();
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("removes transfer series siblings and fees from React Query for all_in_series", async () => {
    // Parent may still carry optimistic categoryName "Transfer" while children
    // from Combined have "". Series delete must still drop the parent instantly.
    const transferA = {
      id: "xfer-30",
      date: "2026-08-30",
      description: "Transfer4",
      amount: 200,
      amountCurrency: "PHP",
      categoryName: "Transfer",
      fromAccountName: "BDO CC - Ella",
      toAccountName: "Cash - Ella",
      type: CombinedTransactionTypeEnum.TRANSFER,
      inSeries: true,
      hasImage: false,
    };
    const transferB = {
      ...transferA,
      id: "xfer-31",
      date: "2026-08-31",
      categoryName: "",
    };
    const feeA = {
      id: "fee-30",
      date: "2026-08-30",
      description: "Transfer fee for: Transfer4, amount: 200",
      amount: 20,
      amountCurrency: "PHP",
      categoryName: "Transfer Fee",
      fromAccountName: "BDO CC - Ella",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: true,
      hasImage: false,
    };
    const feeB = {
      ...feeA,
      id: "fee-31",
      date: "2026-08-31",
    };

    await upsertLocalIndexTransaction("space-a", transferA);
    await upsertLocalIndexTransaction("space-a", transferB);
    await upsertLocalIndexTransaction("space-a", feeA);
    await upsertLocalIndexTransaction("space-a", feeB);

    vi.mocked(deleteTransfer).mockResolvedValue({ success: true });

    const queryClient = new QueryClient();
    queryClient.setQueryData(listQueryKey, {
      pages: [
        {
          transactions: [transferB, feeB, transferA, feeA],
          nextPage: null,
          totalPages: 1,
          totalCount: 4,
          totals: { income: 0, expense: 40, transfer: 400 },
        },
      ],
      pageParams: [1],
    });

    const result = await deleteTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        transactionId: "xfer-31",
        deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
        listRow: transferB,
      },
      {
        queryClient,
        waitForSync: false,
      },
    );

    expect(result.removedIds.sort()).toEqual([
      "fee-30",
      "fee-31",
      "xfer-30",
      "xfer-31",
    ]);
    expect(
      queryClient.getQueryData<{
        pages: Array<{ transactions: unknown[] }>;
      }>(listQueryKey)?.pages[0]?.transactions,
    ).toHaveLength(0);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);
  });

  it("removes matching series rows for this_and_future", async () => {
    await seedExpense({
      id: "tx-past",
      date: "2026-07-01",
      inSeries: true,
    });
    await seedExpense({
      id: "tx-current",
      date: "2026-08-08",
      inSeries: true,
    });
    await seedExpense({
      id: "tx-future",
      date: "2026-09-08",
      inSeries: true,
    });
    vi.mocked(deleteTransaction).mockResolvedValue({ success: true });

    const result = await deleteTransactionLocalFirst({} as never, {
      spaceId: "space-a",
      transactionId: "tx-current",
      deleteScope: DeleteScopeEnum.THIS_AND_FUTURE,
    });

    expect(result.removedIds.sort()).toEqual(["tx-current", "tx-future"]);
    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-07-01",
      "2026-09-30",
    );
    expect(rows.map((row) => row.id)).toEqual(["tx-past"]);
  });

  it("optimistically removes loan payments before the network finishes", async () => {
    const payment = {
      id: "loan-pay-1",
      date: "2026-08-08",
      description: "Loan payment",
      amount: 500,
      amountCurrency: "PHP",
      categoryName: "Loan payment",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
      inSeries: false,
      hasImage: false,
      loanId: "loan-1",
    };
    await upsertLocalIndexTransaction("space-a", payment);

    let resolveDelete: (value: unknown) => void = () => undefined;
    vi.mocked(deleteLoanPayment).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const queryClient = new QueryClient();
    const resultPromise = deleteTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        transactionId: "loan-pay-1",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
        listRow: payment,
      },
      { queryClient, waitForSync: false },
    );

    const optimistic = await resultPromise;
    expect(optimistic.pendingSync).toBe(true);
    expect(optimistic.removedIds).toEqual(["loan-pay-1"]);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);

    resolveDelete({ success: true });
    const synced = await optimistic.syncPromise;
    expect(synced.pendingSync).toBe(false);
    expect(deleteLoanPayment).toHaveBeenCalledWith(
      {},
      "loan-1",
      "loan-pay-1",
    );
  });

  it("optimistically removes loan disbursements before the network finishes", async () => {
    const loanRow = {
      id: "loan-1",
      date: "2026-08-08",
      description: "Car loan",
      amount: 10000,
      amountCurrency: "PHP",
      categoryName: "Loan",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
      inSeries: false,
      hasImage: false,
      isLoanActivity: true,
      loanId: "loan-1",
      entityName: "Bank",
    };
    await upsertLocalIndexTransaction("space-a", loanRow);

    let resolveDelete: (value: unknown) => void = () => undefined;
    vi.mocked(deleteLoan).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const queryClient = new QueryClient();
    const resultPromise = deleteTransactionLocalFirst(
      {} as never,
      {
        spaceId: "space-a",
        transactionId: "loan-1",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
        listRow: loanRow,
      },
      { queryClient, waitForSync: false },
    );

    const optimistic = await resultPromise;
    expect(optimistic.pendingSync).toBe(true);
    expect(optimistic.removedIds).toEqual(["loan-1"]);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows).toHaveLength(0);

    resolveDelete({ success: true });
    const synced = await optimistic.syncPromise;
    expect(synced.pendingSync).toBe(false);
    expect(deleteLoan).toHaveBeenCalledWith({}, "loan-1");
  });
});
