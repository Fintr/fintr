import { getLocalDb } from "@/lib/local-db/db";

import {
  DEFAULT_ATTACHMENT_ID,
  MAX_ATTACHMENT_BYTE_SIZE,
  MAX_ATTACHMENT_SPACE_BYTE_SIZE,
} from "./constants";
import type {
  AttachmentOwnerType,
  AttachmentSource,
  LocalAttachmentRecord,
} from "./types";

const now = (): number => Date.now();

export class AttachmentTooLargeError extends Error {
  constructor(byteSize: number) {
    super(
      `Attachment exceeds maximum size of ${MAX_ATTACHMENT_BYTE_SIZE} bytes (got ${byteSize})`,
    );
    this.name = "AttachmentTooLargeError";
  }
}

export const attachmentRecordKey = (
  spaceId: string,
  ownerType: AttachmentOwnerType,
  ownerId: string,
  attachmentId: string,
): string => `${spaceId}:${ownerType}:${ownerId}:${attachmentId}`;

const ownerIndex = (
  spaceId: string,
  ownerType: AttachmentOwnerType,
  ownerId: string,
): string => `${spaceId}:${ownerType}:${ownerId}`;

const assertAttachmentSize = (byteSize: number): void => {
  if (byteSize > MAX_ATTACHMENT_BYTE_SIZE) {
    throw new AttachmentTooLargeError(byteSize);
  }
};

const totalByteSizeForSpace = async (spaceId: string): Promise<number> => {
  const rows = await getLocalDb()
    .attachments.where("spaceId")
    .equals(spaceId)
    .toArray();

  return rows.reduce((sum, row) => sum + row.byteSize, 0);
};

const evictOldestAttachments = async (
  spaceId: string,
  bytesToFree: number,
): Promise<void> => {
  if (bytesToFree <= 0) {
    return;
  }

  const rows = await getLocalDb()
    .attachments.where("spaceId")
    .equals(spaceId)
    .sortBy("lastAccessedAt");

  let freed = 0;
  const keysToDelete: string[] = [];

  for (const row of rows) {
    if (freed >= bytesToFree) {
      break;
    }
    keysToDelete.push(row.key);
    freed += row.byteSize;
  }

  if (keysToDelete.length > 0) {
    await getLocalDb().attachments.bulkDelete(keysToDelete);
  }
};

const enforceSpaceAttachmentBudget = async (
  spaceId: string,
  incomingByteSize: number,
): Promise<void> => {
  const currentTotal = await totalByteSizeForSpace(spaceId);
  const projected = currentTotal + incomingByteSize;

  if (projected <= MAX_ATTACHMENT_SPACE_BYTE_SIZE) {
    return;
  }

  await evictOldestAttachments(
    spaceId,
    projected - MAX_ATTACHMENT_SPACE_BYTE_SIZE,
  );
};

export const putLocalAttachment = async (params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
  file: File | Blob;
  filename?: string;
  attachmentId?: string;
  source?: AttachmentSource;
  remoteUrl?: string;
  serverFileId?: string;
}): Promise<string> => {
  const {
    spaceId,
    ownerType,
    ownerId,
    file,
    filename,
    attachmentId = DEFAULT_ATTACHMENT_ID,
    source = "local_create",
    remoteUrl,
    serverFileId,
  } = params;

  if (!spaceId || !ownerId) {
    throw new Error("spaceId and ownerId are required to store an attachment");
  }

  const byteSize = file.size;
  assertAttachmentSize(byteSize);
  await enforceSpaceAttachmentBudget(spaceId, byteSize);

  const key = attachmentRecordKey(spaceId, ownerType, ownerId, attachmentId);
  const timestamp = now();
  const record: LocalAttachmentRecord = {
    key,
    spaceId,
    ownerType,
    ownerId,
    attachmentId,
    filename:
      filename ??
      (file instanceof File ? file.name : "attachment"),
    contentType: file.type || "application/octet-stream",
    byteSize,
    blob: file,
    remoteUrl,
    serverFileId,
    source,
    cachedAt: timestamp,
    lastAccessedAt: timestamp,
  };

  await getLocalDb().attachments.put(record);
  return key;
};

export const getLocalAttachment = async (
  key: string,
): Promise<LocalAttachmentRecord | undefined> => {
  const record = await getLocalDb().attachments.get(key);
  if (!record) {
    return undefined;
  }

  await getLocalDb().attachments.update(key, { lastAccessedAt: now() });
  return { ...record, lastAccessedAt: now() };
};

export const loadLocalAttachmentFile = async (
  key: string,
): Promise<File | undefined> => {
  const record = await getLocalAttachment(key);
  if (!record) {
    return undefined;
  }

  if (record.blob instanceof File) {
    return record.blob;
  }

  return new File([record.blob], record.filename, {
    type: record.contentType,
  });
};

export const listAttachmentsForOwner = async (params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
}): Promise<LocalAttachmentRecord[]> => {
  const prefix = ownerIndex(
    params.spaceId,
    params.ownerType,
    params.ownerId,
  );

  const rows = await getLocalDb()
    .attachments.where("spaceId")
    .equals(params.spaceId)
    .filter(
      (row) =>
        row.ownerType === params.ownerType &&
        row.ownerId === params.ownerId,
    )
    .toArray();

  return rows.filter((row) => row.key.startsWith(`${prefix}:`));
};

export const rekeyAttachmentsOwner = async (params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  previousOwnerId: string;
  nextOwnerId: string;
}): Promise<void> => {
  const { spaceId, ownerType, previousOwnerId, nextOwnerId } = params;

  if (!spaceId || !previousOwnerId || !nextOwnerId) {
    return;
  }

  if (previousOwnerId === nextOwnerId) {
    return;
  }

  const rows = await listAttachmentsForOwner({
    spaceId,
    ownerType,
    ownerId: previousOwnerId,
  });

  if (rows.length === 0) {
    return;
  }

  const db = getLocalDb();
  const timestamp = now();

  await db.transaction("rw", db.attachments, async () => {
    for (const row of rows) {
      const nextKey = attachmentRecordKey(
        spaceId,
        ownerType,
        nextOwnerId,
        row.attachmentId,
      );
      const nextRecord: LocalAttachmentRecord = {
        ...row,
        key: nextKey,
        ownerId: nextOwnerId,
        lastAccessedAt: timestamp,
      };

      await db.attachments.put(nextRecord);
      await db.attachments.delete(row.key);
    }
  });
};

export const purgeAttachmentsForOwner = async (params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
}): Promise<void> => {
  const rows = await listAttachmentsForOwner(params);
  if (rows.length === 0) {
    return;
  }

  await getLocalDb().attachments.bulkDelete(rows.map((row) => row.key));
};

export const purgeAttachmentsByKeys = async (
  keys: string[],
): Promise<void> => {
  if (keys.length === 0) {
    return;
  }

  await getLocalDb().attachments.bulkDelete(keys);
};
