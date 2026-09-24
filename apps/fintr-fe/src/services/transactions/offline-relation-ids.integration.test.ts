import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { resetLocalDbForTests } from "@/lib/local-db";
import { createEntityLocalFirst } from "@/services/entities/create-local-first";
import { createAccountLocalFirst } from "@/services/transactions/accounts/create-local-first";
import { createCategoryLocalFirst } from "@/services/transactions/categories/create-local-first";
import { createTransactionLocalFirst } from "@/services/transactions/create-local-first";
import { loadCachedTransactionsInRange } from "@/services/transactions/local-cache";
import { createTagLocalFirst } from "@/services/transactions/tags/create-local-first";
import { CategoryTypeEnum } from "@/types/categoryTypes";

vi.mock("@/services/transactions/mutation", () => ({
  createTransaction: vi.fn(),
}));
vi.mock("@/services/transactions/accounts/mutation", () => ({
  createAccount: vi.fn(),
}));
vi.mock("@/services/entities/mutation", () => ({
  createEntity: vi.fn(),
}));
vi.mock("@/services/transactions/categories/mutation", () => ({
  createTransactionCategory: vi.fn(),
}));
vi.mock("@/services/transactions/tags/mutation", () => ({
  createTransactionTag: vi.fn(),
}));

import { createTransaction } from "@/services/transactions/mutation";
import { createAccount } from "@/services/transactions/accounts/mutation";
import { createEntity } from "@/services/entities/mutation";
import { createTransactionCategory } from "@/services/transactions/categories/mutation";
import { createTransactionTag } from "@/services/transactions/tags/mutation";

describe("offline relation ids on create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createTransaction).mockRejectedValue(
      new Error("Failed to create transaction"),
    );
    vi.mocked(createAccount).mockRejectedValue(new Error("Failed to fetch"));
    vi.mocked(createEntity).mockRejectedValue(new Error("Failed to fetch"));
    vi.mocked(createTransactionCategory).mockRejectedValue(
      new Error("Failed to fetch"),
    );
    vi.mocked(createTransactionTag).mockRejectedValue(
      new Error("Failed to fetch"),
    );
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("stamps local account, merchant, category, and tag ids onto an offline transaction", async () => {
    const api = {} as never;

    const account = await createAccountLocalFirst(api, {
      spaceId: "space-a",
      data: {
        name: "Travel wallet",
        balance: 0,
        accountCategory: "cash",
        balanceCurrency: "PHP",
      },
    });
    const merchant = await createEntityLocalFirst(api, {
      spaceCode: "space-a",
      data: { fullName: "Jollibee", entityType: "transaction" },
    });
    const category = await createCategoryLocalFirst(api, {
      spaceCode: "space-a",
      data: {
        name: "Fast food",
        categoryType: CategoryTypeEnum.EXPENSE,
      },
    });
    const tag = await createTagLocalFirst(api, {
      spaceCode: "space-a",
      data: { name: "Japan 2026", color: "#f472b6" },
    });

    const result = await createTransactionLocalFirst(api, {
      spaceId: "space-a",
      data: {
        amount: 1,
        description: "Lunch",
        transactionType: "expense",
        categoryName: "Fast food",
        accountName: "Travel wallet",
        entityName: "Jollibee",
        date: "2026-08-17",
        scheduleType: ScheduleTypeEnum.ONE_TIME,
        tagIds: [tag.data.id],
        tags: [tag.localTag],
      },
    });

    expect(result.localTransaction.accountId).toBe(account.data.id);
    expect(result.localTransaction.fromAccountId).toBe(account.data.id);
    expect(result.localTransaction.entityId).toBe(merchant.data.id);
    expect(result.localTransaction.categoryId).toBe(category.data.id);
    expect(result.localTransaction.tagIds).toEqual([tag.data.id]);

    const rows = await loadCachedTransactionsInRange(
      "space-a",
      "2026-08-01",
      "2026-08-31",
    );
    expect(rows[0]?.accountId).toBe(account.data.id);
    expect(rows[0]?.entityId).toBe(merchant.data.id);
    expect(rows[0]?.categoryId).toBe(category.data.id);
    expect(rows[0]?.tagIds).toEqual([tag.data.id]);
  });
});
