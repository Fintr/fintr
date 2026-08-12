import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DeleteScopeEnum,
  ScheduleTypeEnum,
} from "@/constants/transactionConstants";
import {
  enqueueOutboxRecord,
  getLocalDb,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  OUTBOX_COMMAND_TRANSACTION_DELETE,
  OUTBOX_COMMAND_TRANSACTION_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { upsertLocalIndexTransaction } from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("@/services/transactions/mutation", () => ({
  createTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  updateTransaction: vi.fn(),
}));

import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/services/transactions/mutation";
import { drainOutboxForSpace } from "./drain-outbox";

describe("drainOutboxForSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("drains pending creates in createdAt order", async () => {
    const firstId = "cid-first";
    const secondId = "cid-second";

    await upsertLocalIndexTransaction("space-a", {
      id: `local:${firstId}`,
      date: "2026-08-08",
      description: "First",
      amount: 10,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await upsertLocalIndexTransaction("space-a", {
      id: `local:${secondId}`,
      date: "2026-08-08",
      description: "Second",
      amount: 20,
      amountCurrency: "PHP",
      categoryName: "Food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
      clientMutationId: firstId,
      payload: {
        amount: 10,
        description: "First",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
      clientMutationId: secondId,
      payload: {
        amount: 20,
        description: "Second",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });

    const order: string[] = [];
    vi.mocked(createTransaction).mockImplementation(async (_api, data) => {
      order.push(String(data.clientMutationId));
      return { data: { id: `server-${data.clientMutationId}` } };
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(2);
    expect(order).toEqual([firstId, secondId]);
    expect(createTransaction).toHaveBeenCalledTimes(2);
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("stops on network failure and leaves later rows pending", async () => {
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
      clientMutationId: "cid-a",
      payload: {
        amount: 1,
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
      clientMutationId: "cid-b",
      payload: {
        amount: 2,
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });

    vi.mocked(createTransaction).mockRejectedValue(
      new Error("Failed to create transaction"),
    );

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.stoppedEarly).toBe(true);
    expect(result.processed).toBe(0);
    expect(createTransaction).toHaveBeenCalledOnce();

    const remaining = await getLocalDb().outbox.toArray();
    expect(remaining).toHaveLength(2);
    expect(remaining.every((row) => row.status === "pending")).toBe(true);
  });

  it("drains pending deletes", async () => {
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_DELETE,
      clientMutationId: "cid-del-1",
      payload: {
        id: "server-tx-1",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
        removedTransactions: [],
      },
    });

    vi.mocked(deleteTransaction).mockResolvedValue({ success: true });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(deleteTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "server-tx-1",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
      }),
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("treats delete not-found as success and does not restore local rows", async () => {
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_DELETE,
      clientMutationId: "cid-del-missing",
      payload: {
        id: "already-gone",
        deleteScope: DeleteScopeEnum.THIS_ONLY,
        removedTransactions: [
          {
            id: "already-gone",
            date: "2026-08-08",
            description: "Ghost",
            amount: 10,
            amountCurrency: "PHP",
            categoryName: "Food",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          },
        ],
      },
    });

    vi.mocked(deleteTransaction).mockRejectedValue({
      success: false,
      details: { id: ["Transaction not found"] },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("hydrates attachment blobs from IndexedDB when draining creates", async () => {
    const clientMutationId = "cid-with-receipt";
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    const { putLocalAttachment } = await import(
      "@/services/attachments/local-store"
    );
    const attachmentKey = await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: `local:${clientMutationId}`,
      file,
    });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_CREATE,
      clientMutationId,
      payload: {
        amount: 10,
        description: "Receipt expense",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        attachmentLocalKeys: [attachmentKey],
      },
    });

    vi.mocked(createTransaction).mockResolvedValue({
      data: { id: "server-tx-receipt" },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(createTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        description: "Receipt expense",
        clientMutationId,
        file: expect.any(File),
      }),
    );
    expect(
      (vi.mocked(createTransaction).mock.calls[0]?.[1] as { file?: File }).file
        ?.name,
    ).toBe("receipt.jpg");
  });

  it("drains pending transaction updates", async () => {
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_UPDATE,
      clientMutationId: "cid-upd-1",
      payload: {
        id: "server-tx-1",
        amount: 10_000_000,
        description: "Loan repayment Cash",
        transactionType: "income",
        categoryName: "Freelance",
        accountName: "Cash",
        date: "2026-08-11",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
      },
    });

    vi.mocked(updateTransaction).mockResolvedValue({ success: true });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(updateTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "server-tx-1",
        amount: 10_000_000,
      }),
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });
});
