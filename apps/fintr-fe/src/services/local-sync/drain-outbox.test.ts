import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DeleteScopeEnum,
  ScheduleTypeEnum,
} from "@/constants/transactionConstants";
import {
  enqueueOutboxRecord,
  getLocalDb,
  OUTBOX_COMMAND_BUDGET_CREATE,
  OUTBOX_COMMAND_BUDGET_DELETE,
  OUTBOX_COMMAND_BUDGET_ENSURE_MONTH,
  OUTBOX_COMMAND_BUDGET_UPDATE,
  OUTBOX_COMMAND_CATEGORY_CONVERT,
  OUTBOX_COMMAND_CATEGORY_CREATE,
  OUTBOX_COMMAND_ACCOUNT_DELETE,
  OUTBOX_COMMAND_TAG_CREATE,
  OUTBOX_COMMAND_TAG_DELETE,
  OUTBOX_COMMAND_LOAN_CREATE,
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

vi.mock("@/services/loans/mutation", () => ({
  createLoan: vi.fn(),
}));

vi.mock("@/services/budgets/mutations", () => ({
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn(),
}));

vi.mock("@/services/budgets/queries", () => ({
  fetchBudgetsPage: vi.fn(),
}));

vi.mock("@/services/transactions/categories/mutation", () => ({
  convertCategoryHierarchy: vi.fn(),
  createTransactionCategory: vi.fn(),
}));

vi.mock("@/services/transactions/tags/mutation", () => ({
  createTransactionTag: vi.fn(),
  deleteTransactionTag: vi.fn(),
}));

vi.mock("@/services/transactions/accounts/mutation", () => ({
  deleteAccount: vi.fn(),
}));

import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/services/transactions/mutation";
import { createLoan } from "@/services/loans/mutation";
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from "@/services/budgets/mutations";
import { fetchBudgetsPage } from "@/services/budgets/queries";
import { convertCategoryHierarchy, createTransactionCategory } from "@/services/transactions/categories/mutation";
import { deleteTransactionTag, createTransactionTag } from "@/services/transactions/tags/mutation";
import { deleteAccount } from "@/services/transactions/accounts/mutation";
import { cacheTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { CategoryTypeEnum } from "@/types/categoryTypes";
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

  it("hydrates attachment blobs from IndexedDB when draining updates", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });
    const { putLocalAttachment } = await import(
      "@/services/attachments/local-store"
    );
    const attachmentKey = await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "server-tx-1",
      file,
    });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TRANSACTION_UPDATE,
      clientMutationId: "cid-upd-file",
      payload: {
        id: "server-tx-1",
        amount: 40,
        description: "Receipt expense",
        transactionType: "expense",
        categoryName: "Food",
        accountName: "Cash",
        date: "2026-08-08",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        attachmentLocalKeys: [attachmentKey],
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
        file: expect.any(File),
      }),
    );
    expect(
      (vi.mocked(updateTransaction).mock.calls[0]?.[1] as { file?: File }).file
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

  it("drains pending budget create, update, and delete commands", async () => {
    vi.mocked(createBudget).mockResolvedValue({
      data: { id: "server-budget-1" },
    });
    vi.mocked(updateBudget).mockResolvedValue({ success: true });
    vi.mocked(deleteBudget).mockResolvedValue({ success: true });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_BUDGET_CREATE,
      clientMutationId: "cid-budget-create",
      payload: {
        localId: "local-budget-1",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        amount: 8000,
        date: "2026-08-01",
        categoryId: "cat-transport",
        categoryName: "Transportation",
      },
    });
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_BUDGET_UPDATE,
      clientMutationId: "cid-budget-update",
      payload: {
        budgetId: "server-budget-1",
        amount: 9000,
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
    });
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_BUDGET_DELETE,
      clientMutationId: "cid-budget-delete",
      payload: {
        budgetId: "server-budget-2",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(3);
    expect(result.failed).toBe(0);
    expect(createBudget).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        amount: 8000,
        categoryId: "cat-transport",
        categoryName: "Transportation",
      }),
    );
    expect(updateBudget).toHaveBeenCalledWith(
      expect.anything(),
      "server-budget-1",
      { amount: 9000 },
    );
    expect(deleteBudget).toHaveBeenCalledWith(
      expect.anything(),
      "server-budget-2",
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("drops legacy budget ensure-month commands; monthly copies drain as budget.create", async () => {
    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_BUDGET_ENSURE_MONTH,
      clientMutationId: "cid-budget-ensure",
      payload: {
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(fetchBudgetsPage).not.toHaveBeenCalled();
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("drains pending category create commands", async () => {
    await cacheTransactionCategoriesResponse("space-a", {
      data: { expenseCategories: [], incomeCategories: [] },
    });
    vi.mocked(createTransactionCategory).mockResolvedValue({
      success: true,
      data: { id: "cat-a2" },
    });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_CATEGORY_CREATE,
      clientMutationId: "cid-cat-create",
      payload: {
        id: "cat-a2",
        name: "A2",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(createTransactionCategory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "cat-a2",
        name: "A2",
        categoryType: CategoryTypeEnum.EXPENSE,
      }),
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("drains legacy category create payloads with local-prefixed ids", async () => {
    vi.mocked(createTransactionCategory).mockResolvedValue({
      success: true,
      data: { id: "legacy-uuid" },
    });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_CATEGORY_CREATE,
      clientMutationId: "cid-legacy-cat",
      payload: {
        localId: "local:legacy-uuid",
        name: "A3",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(createTransactionCategory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: "legacy-uuid",
        name: "A3",
      }),
    );
  });

  it("drains pending category convert commands", async () => {
    vi.mocked(convertCategoryHierarchy).mockResolvedValue({
      id: "cat-taxi",
      name: "Taxi",
      parentId: null,
      redirectParentId: "cat-taxi",
    });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_CATEGORY_CONVERT,
      clientMutationId: "cid-cat-convert",
      payload: {
        categoryId: "cat-taxi",
        conversionType: "to_parent",
        newParentId: null,
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(convertCategoryHierarchy).toHaveBeenCalledWith(
      expect.anything(),
      "cat-taxi",
      {
        conversionType: "to_parent",
        newParentId: null,
      },
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("drains pending account delete commands with removeTransactions", async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ success: true });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_ACCOUNT_DELETE,
      clientMutationId: "cid-account-delete",
      payload: {
        accountId: "acc-cash",
        removeTransactions: true,
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(deleteAccount).toHaveBeenCalledWith(
      expect.anything(),
      "acc-cash",
      { removeTransactions: true },
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("drains pending tag delete commands", async () => {
    vi.mocked(deleteTransactionTag).mockResolvedValue({ success: true });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TAG_DELETE,
      clientMutationId: "cid-tag-delete",
      payload: {
        tagId: "tag-1",
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(deleteTransactionTag).toHaveBeenCalledWith(
      expect.anything(),
      "tag-1",
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("drains pending tag create commands", async () => {
    vi.mocked(createTransactionTag).mockResolvedValue({
      data: {
        id: "server-tag-1",
        name: "Thailand 2026",
        color: "#00897B",
      },
    });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_TAG_CREATE,
      clientMutationId: "cid-tag-create",
      payload: {
        name: "Thailand 2026",
        color: "#00897B",
        localId: "local:cid-tag-create",
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0);
    expect(createTransactionTag).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: "Thailand 2026",
        color: "#00897B",
      }),
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });

  it("sends clientMutationId when draining a loan create", async () => {
    vi.mocked(createLoan).mockResolvedValue({ data: { id: "loan-server-1" } });

    await enqueueOutboxRecord({
      spaceId: "space-a",
      commandType: OUTBOX_COMMAND_LOAN_CREATE,
      clientMutationId: "cid-loan-create",
      payload: {
        principalAmount: 500,
        interestRate: 0,
        date: "2026-08-08",
        loanType: "lent",
        entityName: "Entity A",
        accountName: "Cash",
        loanTermMonths: 1,
        description: "Share of Dinner",
        adjustsAccountBalance: true,
      },
    });

    const result = await drainOutboxForSpace({
      api: {} as never,
      spaceId: "space-a",
    });

    expect(result.processed).toBe(1);
    expect(createLoan).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        principalAmount: 500,
        clientMutationId: "cid-loan-create",
      }),
    );
    expect(await getLocalDb().outbox.count()).toBe(0);
  });
});
