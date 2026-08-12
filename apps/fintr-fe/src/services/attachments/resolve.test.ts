import "fake-indexeddb/auto";

import type { AxiosInstance } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { putLocalAttachment } from "./local-store";
import {
  resolveAttachmentsForTransaction,
  resolveEditAttachmentFile,
} from "./resolve";

vi.mock("@/services/transactions/detail-local", () => ({
  resolveTransactionDetail: vi.fn(),
}));

import { resolveTransactionDetail } from "@/services/transactions/detail-local";

describe("attachments resolve", () => {
  beforeEach(() => {
    if (typeof URL.createObjectURL !== "function") {
      URL.createObjectURL = vi.fn(() => "blob:mock-preview");
    }
    if (typeof URL.revokeObjectURL !== "function") {
      URL.revokeObjectURL = vi.fn();
    }
  });

  afterEach(async () => {
    await resetLocalDbForTests();
    vi.clearAllMocks();
  });

  it("returns blob URLs from local attachments when offline", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "local:cid-1",
      file,
    });

    const result = await resolveAttachmentsForTransaction({
      spaceId: "space-a",
      transactionId: "local:cid-1",
      type: CombinedTransactionTypeEnum.EXPENSE,
      preferLocal: true,
    });

    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.url).toMatch(/^blob:/);
    expect(result.images[0]?.filename).toBe("receipt.jpg");
    result.revoke();
  });

  it("loads edit attachment file from local store", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transfer",
      ownerId: "local:cid-2",
      file,
    });

    const resolved = await resolveEditAttachmentFile({
      spaceId: "space-a",
      transactionId: "local:cid-2",
      type: CombinedTransactionTypeEnum.TRANSFER,
    });

    expect(resolved?.name).toBe("receipt.jpg");
  });

  it("falls back to remote detail files when online and no local blob", async () => {
    vi.mocked(resolveTransactionDetail).mockResolvedValue({
      files: [
        {
          id: "file-1",
          url: "https://s3.ap-southeast-1.amazonaws.com/fintr-development/receipt.jpg",
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        },
      ],
    });

    const result = await resolveAttachmentsForTransaction({
      spaceId: "space-a",
      transactionId: "server-tx-1",
      type: CombinedTransactionTypeEnum.EXPENSE,
      preferLocal: false,
      api: {} as AxiosInstance,
    });

    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.url).toContain("fintr-development");
    expect(resolveTransactionDetail).toHaveBeenCalledOnce();
  });
});
