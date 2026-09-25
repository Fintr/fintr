import "fake-indexeddb/auto";

import type { AxiosInstance } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("@/lib/auth-storage", () => ({
  AuthStorage: {
    getAccessToken: () => null,
  },
}));

vi.mock("@/lib/public-backend-url", () => ({
  getPublicBackendUrl: () => undefined,
}));

import { putLocalAttachment, listAttachmentsForOwner } from "./local-store";
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
    vi.unstubAllGlobals();
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
    const previewUrl = result.images[0]?.url;
    result.revoke();

    const again = await resolveAttachmentsForTransaction({
      spaceId: "space-a",
      transactionId: "local:cid-1",
      type: CombinedTransactionTypeEnum.EXPENSE,
      preferLocal: true,
    });

    expect(again.images[0]?.url).toBe(previewUrl);
  });

  it("uses the file url when the local copy cannot be created", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });
    const fileUrl = "https://storage.googleapis.com/fintr-dev/receipt.jpg";

    await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "local:cid-file-url",
      file,
      remoteUrl: fileUrl,
    });

    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = () => {
      throw new Error("copy failed");
    };

    try {
      const result = await resolveAttachmentsForTransaction({
        spaceId: "space-a",
        transactionId: "local:cid-file-url",
        type: CombinedTransactionTypeEnum.EXPENSE,
        preferLocal: true,
      });

      expect(result.images[0]?.url).toBe(fileUrl);
      expect(result.images[0]?.fileUrl).toBe(fileUrl);
    } finally {
      URL.createObjectURL = createObjectURL;
    }
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

  it("downloads remote files into IndexedDB when not in local-only mode", async () => {
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
    const blob = new Blob(["receipt-bytes"], { type: "image/jpeg" });
    const api = {
      get: vi.fn(async () => ({ data: blob })),
    };

    const result = await resolveAttachmentsForTransaction({
      spaceId: "space-a",
      transactionId: "server-tx-1",
      type: CombinedTransactionTypeEnum.EXPENSE,
      preferLocal: false,
      api: api as AxiosInstance,
    });

    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.url).toMatch(/^blob:/);
    expect(result.images[0]?.filename).toBe("receipt.jpg");
    expect(resolveTransactionDetail).toHaveBeenCalled();

    const stored = await listAttachmentsForOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "server-tx-1",
    });
    expect(stored).toHaveLength(1);
    expect(stored[0]?.source).toBe("remote_download");
    result.revoke();
  });

  it("does not download remote files when preferLocal is true", async () => {
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
    const api = {
      get: vi.fn(async () => ({ data: new Blob() })),
    };

    const result = await resolveAttachmentsForTransaction({
      spaceId: "space-a",
      transactionId: "server-tx-1",
      type: CombinedTransactionTypeEnum.EXPENSE,
      preferLocal: true,
      api: api as AxiosInstance,
    });

    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.url).toBe(
      "https://s3.ap-southeast-1.amazonaws.com/fintr-development/receipt.jpg",
    );
    expect(api.get).not.toHaveBeenCalled();
    expect(resolveTransactionDetail).toHaveBeenCalledWith(
      expect.objectContaining({ preferLocal: true }),
    );
  });
});
