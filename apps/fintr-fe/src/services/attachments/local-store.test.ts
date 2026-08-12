import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { getLocalDb, resetLocalDbForTests } from "@/lib/local-db";

import {
  attachmentRecordKey,
  getLocalAttachment,
  listAttachmentsForOwner,
  loadLocalAttachmentFile,
  putLocalAttachment,
  purgeAttachmentsForOwner,
  rekeyAttachmentsOwner,
} from "./local-store";

describe("attachments local-store", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("stores and reloads a file blob by key", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    const key = await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "local:cid-1",
      file,
    });

    expect(key).toBe(
      attachmentRecordKey("space-a", "transaction", "local:cid-1", "0"),
    );

    const record = await getLocalAttachment(key);
    expect(record).toBeDefined();
    expect(record?.filename).toBe("receipt.jpg");
    expect(record?.contentType).toBe("image/jpeg");
    expect(record?.byteSize).toBe(file.size);

    const reloaded = await loadLocalAttachmentFile(key);
    expect(reloaded).toBeDefined();
    expect(reloaded?.name).toBe("receipt.jpg");
    expect(reloaded?.type).toBe("image/jpeg");
  });

  it("rekeys attachment owner ids after server id replace", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "local:cid-1",
      file,
    });

    await rekeyAttachmentsOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      previousOwnerId: "local:cid-1",
      nextOwnerId: "server-tx-1",
    });

    const localRows = await listAttachmentsForOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "local:cid-1",
    });
    expect(localRows).toHaveLength(0);

    const serverRows = await listAttachmentsForOwner({
      spaceId: "space-a",
      ownerType: "transaction",
      ownerId: "server-tx-1",
    });
    expect(serverRows).toHaveLength(1);
    expect(serverRows[0]?.key).toBe(
      attachmentRecordKey("space-a", "transaction", "server-tx-1", "0"),
    );
  });

  it("purges attachments for an owner", async () => {
    const file = new File(["receipt"], "receipt.jpg", {
      type: "image/jpeg",
    });

    const key = await putLocalAttachment({
      spaceId: "space-a",
      ownerType: "transfer",
      ownerId: "local:cid-2",
      file,
    });

    await purgeAttachmentsForOwner({
      spaceId: "space-a",
      ownerType: "transfer",
      ownerId: "local:cid-2",
    });

    expect(await getLocalAttachment(key)).toBeUndefined();
    expect(await getLocalDb().attachments.count()).toBe(0);
  });
});
