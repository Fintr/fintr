import type { AxiosInstance } from "axios";

import { resolveTransactionDetail } from "@/services/transactions/detail-local";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { attachmentOwnerTypeForTransaction } from "./create-outbox";
import {
  listAttachmentsForOwner,
  loadLocalAttachmentFile,
} from "./local-store";
import type { LocalAttachmentRecord } from "./types";

export type ResolvedAttachmentView = {
  url: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
};

export type ResolvedAttachmentsResult = {
  images: ResolvedAttachmentView[];
  revoke: () => void;
};

type RemoteFileAttachment = {
  id?: string;
  url?: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
};

const emptyResult = (): ResolvedAttachmentsResult => ({
  images: [],
  revoke: () => {},
});

const recordsToResolved = (
  records: LocalAttachmentRecord[],
): ResolvedAttachmentsResult => {
  const objectUrls: string[] = [];
  const images = records.map((record) => {
    const url = URL.createObjectURL(record.blob);
    objectUrls.push(url);

    return {
      url,
      filename: record.filename,
      contentType: record.contentType,
      byteSize: record.byteSize,
    };
  });

  return {
    images,
    revoke: () => {
      for (const url of objectUrls) {
        URL.revokeObjectURL(url);
      }
    },
  };
};

const remoteFilesToResolved = (
  files: RemoteFileAttachment[],
): ResolvedAttachmentsResult => ({
  images: files
    .filter((file) => typeof file.url === "string" && file.url.length > 0)
    .map((file) => ({
      url: file.url!,
      filename: file.filename,
      contentType: file.contentType,
      byteSize: file.byteSize,
    })),
  revoke: () => {},
});

const extractRemoteFiles = (detail: unknown): RemoteFileAttachment[] => {
  if (!detail || typeof detail !== "object") {
    return [];
  }

  const files = (detail as { files?: unknown }).files;
  if (!Array.isArray(files)) {
    return [];
  }

  return files.filter(
    (file): file is RemoteFileAttachment =>
      Boolean(file) && typeof file === "object",
  );
};

export const resolveAttachmentsForTransaction = async (params: {
  spaceId: string;
  transactionId: string;
  type: CombinedTransactionTypeEnum;
  preferLocal: boolean;
  listRow?: IndexTransaction | null;
  api?: AxiosInstance | null;
}): Promise<ResolvedAttachmentsResult> => {
  const {
    spaceId,
    transactionId,
    type,
    preferLocal,
    listRow,
    api,
  } = params;

  if (!spaceId || !transactionId) {
    return emptyResult();
  }

  const ownerType = attachmentOwnerTypeForTransaction(type);
  const localRows = await listAttachmentsForOwner({
    spaceId,
    ownerType,
    ownerId: transactionId,
  });

  if (localRows.length > 0) {
    return recordsToResolved(localRows);
  }

  if (preferLocal) {
    return emptyResult();
  }

  if (!api) {
    return emptyResult();
  }

  const detail = await resolveTransactionDetail({
    api,
    spaceId,
    transactionId,
    type,
    listRow,
    preferLocal: false,
  });

  const remoteFiles = extractRemoteFiles(detail);
  if (remoteFiles.length > 0) {
    return remoteFilesToResolved(remoteFiles);
  }

  return emptyResult();
};

export const resolveEditAttachmentFile = async (params: {
  spaceId: string;
  transactionId: string;
  type: CombinedTransactionTypeEnum;
}): Promise<File | undefined> => {
  const { spaceId, transactionId, type } = params;

  if (!spaceId || !transactionId) {
    return undefined;
  }

  const rows = await listAttachmentsForOwner({
    spaceId,
    ownerType: attachmentOwnerTypeForTransaction(type),
    ownerId: transactionId,
  });

  if (rows.length === 0) {
    return undefined;
  }

  return loadLocalAttachmentFile(rows[0]!.key);
};
