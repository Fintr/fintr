import {
  OUTBOX_COMMAND_LOAN_CREATE,
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  OUTBOX_COMMAND_TRANSFER_CREATE,
} from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { isUploadableFile } from "@/utils/formUtils";

import {
  loadLocalAttachmentFile,
  purgeAttachmentsForOwner,
  putLocalAttachment,
  rekeyAttachmentsOwner,
} from "./local-store";
import type { AttachmentOutboxFields, AttachmentOwnerType } from "./types";

export const attachmentOwnerTypeForTransaction = (
  type: CombinedTransactionTypeEnum,
): AttachmentOwnerType => {
  if (type === CombinedTransactionTypeEnum.TRANSFER) {
    return "transfer";
  }

  if (type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT) {
    return "loan";
  }

  return "transaction";
};

export async function buildCreateOutboxPayload<T extends { file?: File }>(
  params: {
    spaceId: string;
    ownerType: AttachmentOwnerType;
    ownerId: string;
    data: T;
  },
): Promise<Omit<T, "file"> & AttachmentOutboxFields> {
  const { spaceId, ownerType, ownerId, data } = params;
  const { file, ...rest } = data;

  if (!isUploadableFile(file)) {
    return rest as Omit<T, "file"> & AttachmentOutboxFields;
  }

  const key = await putLocalAttachment({
    spaceId,
    ownerType,
    ownerId,
    file,
  });

  return {
    ...rest,
    attachmentLocalKeys: [key],
  } as Omit<T, "file"> & AttachmentOutboxFields;
}

export async function hydrateCreatePayload<
  T extends AttachmentOutboxFields,
>(
  payload: T,
): Promise<Omit<T, "attachmentLocalKeys"> & { file?: File }> {
  const { attachmentLocalKeys, ...rest } = payload;

  if (!attachmentLocalKeys?.length) {
    return rest as Omit<T, "attachmentLocalKeys"> & { file?: File };
  }

  const file = await loadLocalAttachmentFile(attachmentLocalKeys[0]!);

  if (!file) {
    return rest as Omit<T, "attachmentLocalKeys"> & { file?: File };
  }

  return {
    ...rest,
    file,
  };
}

export async function syncAttachmentOwnerId(params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  localOwnerId: string;
  serverOwnerId: string;
}): Promise<void> {
  await rekeyAttachmentsOwner({
    spaceId: params.spaceId,
    ownerType: params.ownerType,
    previousOwnerId: params.localOwnerId,
    nextOwnerId: params.serverOwnerId,
  });
}

export async function rollbackCreateAttachments(params: {
  spaceId: string;
  ownerType: AttachmentOwnerType;
  ownerId: string;
}): Promise<void> {
  await purgeAttachmentsForOwner(params);
}

export async function purgeAttachmentsForTransactions(
  spaceId: string,
  rows: Array<{ id: string; type: CombinedTransactionTypeEnum }>,
): Promise<void> {
  for (const row of rows) {
    await purgeAttachmentsForOwner({
      spaceId,
      ownerType: attachmentOwnerTypeForTransaction(row.type),
      ownerId: row.id,
    });
  }
}

const CREATE_OUTBOX_COMMANDS = new Set([
  OUTBOX_COMMAND_TRANSACTION_CREATE,
  OUTBOX_COMMAND_TRANSFER_CREATE,
  OUTBOX_COMMAND_LOAN_CREATE,
]);

export async function purgeAttachmentsForLocalCreate(params: {
  spaceId: string;
  commandType: string;
  localOwnerId: string;
}): Promise<void> {
  if (!CREATE_OUTBOX_COMMANDS.has(params.commandType)) {
    return;
  }

  const ownerType =
    params.commandType === OUTBOX_COMMAND_TRANSFER_CREATE
      ? "transfer"
      : params.commandType === OUTBOX_COMMAND_LOAN_CREATE
        ? "loan"
        : "transaction";

  await purgeAttachmentsForOwner({
    spaceId: params.spaceId,
    ownerType,
    ownerId: params.localOwnerId,
  });
}
