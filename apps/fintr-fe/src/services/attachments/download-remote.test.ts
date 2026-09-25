import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import { cacheRemoteFilesForOwner, cacheRemoteFilesForOwners, fetchAttachmentBlob } from "./download-remote";
import { listAttachmentsForOwner } from "./local-store";

vi.mock("@/lib/auth-storage", () => ({
  AuthStorage: {
    getAccessToken: () => null,
  },
}));

vi.mock("@/lib/public-backend-url", () => ({
  getPublicBackendUrl: () => undefined,
}));

describe("cacheRemoteFilesForOwner", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
    vi.unstubAllGlobals();
  });

  it("downloads a remote file and stores the blob in IndexedDB", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["receipt-bytes"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
    );

    const rows = await cacheRemoteFilesForOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "tx-1",
      files: [
        {
          id: "file-1",
          url: "https://s3.ap-southeast-1.amazonaws.com/fintr-development/receipt.jpg",
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.filename).toBe("receipt.jpg");
    expect(rows[0]?.source).toBe("remote_download");
    expect(rows[0]?.remoteUrl).toContain("fintr-development");

    const stored = await listAttachmentsForOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "tx-1",
    });
    expect(stored).toHaveLength(1);
  });

  it("does not re-download when a local blob already exists", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { putLocalAttachment } = await import("./local-store");
    await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "tx-1",
      file: new File(["already"], "local.jpg", { type: "image/jpeg" }),
    });

    const rows = await cacheRemoteFilesForOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "tx-1",
      files: [
        {
          url: "https://s3.ap-southeast-1.amazonaws.com/fintr-development/receipt.jpg",
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.filename).toBe("local.jpg");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("copies a downloaded blob onto a second owner id without re-fetching", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["receipt-bytes"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        }),
      ),
    );

    const rows = await cacheRemoteFilesForOwners({
      spaceId: "space-a",
      ownerType: "transfer",
      ownerIds: ["xfer-row", "xfer-activitable"],
      files: [
        {
          url: "https://s3.ap-southeast-1.amazonaws.com/fintr-development/receipt.jpg",
          filename: "receipt.jpg",
          contentType: "image/jpeg",
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(fetch).toHaveBeenCalledOnce();

    const second = await listAttachmentsForOwner({
      spaceId: "space-a",
      ownerType: "transfer",
      ownerId: "xfer-activitable",
    });
    expect(second).toHaveLength(1);
    expect(second[0]?.filename).toBe("receipt.jpg");
  });
});

describe("fetchAttachmentBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the authenticated attachments download proxy when an API client is provided", async () => {
    const blob = new Blob(["proxy"], { type: "image/jpeg" });
    const api = {
      get: vi.fn(async () => ({ data: blob })),
    };

    const result = await fetchAttachmentBlob(
      "https://s3.ap-southeast-1.amazonaws.com/fintr-development/a.jpg",
      api as never,
    );

    expect(result).toBe(blob);
    expect(api.get).toHaveBeenCalledWith(
      "/attachments/download",
      expect.objectContaining({
        params: {
          url: "https://s3.ap-southeast-1.amazonaws.com/fintr-development/a.jpg",
        },
        responseType: "blob",
        timeout: 8_000,
      }),
    );
  });

  it("downloads the public file after the API proxy fails", async () => {
    const blob = new Blob(["public"], { type: "image/jpeg" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: async () => blob,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const fileUrl = "https://storage.googleapis.com/fintr-dev/a.jpg";
    const api = {
      get: vi.fn(async () => {
        throw Object.assign(new Error("Unauthorized"), {
          response: { status: 401 },
        });
      }),
    };

    const result = await fetchAttachmentBlob(fileUrl, api as never);

    expect(result).toBe(blob);
    expect(api.get).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(fileUrl);
  });
});
