import { beforeEach, describe, expect, it, vi } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

const fetchTransactionById = vi.fn();
const cacheRemoteFilesForOwners = vi.fn();

vi.mock("@/services/transactions/queries", () => ({
  fetchTransactionById: (...args: unknown[]) => fetchTransactionById(...args),
}));

vi.mock("@/services/attachments/download-remote", () => ({
  cacheRemoteFilesForOwners: (...args: unknown[]) =>
    cacheRemoteFilesForOwners(...args),
}));

vi.mock("@/services/transactions/detail-local", () => ({
  cacheEditDetailFromIndexRow: vi.fn(async () => undefined),
  cacheTransactionDetail: vi.fn(async () => undefined),
  mapIndexTransactionToEditDataSync: vi.fn(),
  normalizeTransactionEditDetail: vi.fn((payload) => payload),
}));

import { prefetchRemoteAttachmentsForTransactions } from "./cache-bootstrap-details";

const imageTransaction = (id: string): IndexTransaction => ({
  id,
  date: "2026-08-01",
  description: "Receipt",
  amount: 100,
  amountCurrency: "PHP",
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: true,
});

describe("prefetchRemoteAttachmentsForTransactions", () => {
  beforeEach(() => {
    fetchTransactionById.mockReset();
    cacheRemoteFilesForOwners.mockReset();
    fetchTransactionById.mockResolvedValue({
      files: [
        {
          url: "https://s3.ap-southeast-1.amazonaws.com/fintr-development/receipt.jpg",
        },
      ],
    });
    cacheRemoteFilesForOwners.mockResolvedValue([]);
  });

  it("stops after consecutive download failures instead of walking every receipt", async () => {
    const transactions = Array.from({ length: 8 }, (_, index) =>
      imageTransaction(`tx-${index}`),
    );

    await prefetchRemoteAttachmentsForTransactions({
      api: {} as never,
      spaceId: "SPACE_1",
      transactions,
    });

    expect(fetchTransactionById).toHaveBeenCalledTimes(5);
  });
});
