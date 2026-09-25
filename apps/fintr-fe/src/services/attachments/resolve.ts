import type { AxiosInstance } from "axios";

import { resolveTransactionDetail } from "@/services/transactions/detail-local";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { attachmentOwnerTypeForTransaction } from "./create-outbox";
import { cacheRemoteFilesForOwners } from "./download-remote";
import {
  listAttachmentsForOwner,
  loadLocalAttachmentFile,
} from "./local-store";
import type { LocalAttachmentRecord } from "./types";
import {
  extractRemoteFiles,
  type RemoteFileAttachment,
} from "./remote-files";
import { markExistingLocalAttachment } from "@/utils/fileUtils";

export type ResolvedAttachmentView = {
  url: string;
  fileUrl?: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
};

export type ResolvedAttachmentsResult = {
  images: ResolvedAttachmentView[];
  revoke: () => void;
};

const emptyResult = (): ResolvedAttachmentsResult => ({
  images: [],
  revoke: () => {},
});

const objectUrlsByKey = new Map<string, string>();

const cloneAttachmentBlob = async (
  blob: Blob,
  contentType: string,
): Promise<Blob> => {
  if (typeof blob.arrayBuffer === "function") {
    const bytes = await blob.arrayBuffer();
    return new Blob([bytes], { type: contentType });
  }

  if (typeof blob.slice === "function") {
    return blob.slice(0, blob.size, contentType);
  }

  return blob;
};

const stableObjectUrl = async (
  record: LocalAttachmentRecord,
): Promise<string> => {
  const cached = objectUrlsByKey.get(record.key);
  if (cached) {
    return cached;
  }

  const contentType =
    record.contentType
    || record.blob.type
    || "application/octet-stream";
  const blob = await cloneAttachmentBlob(record.blob, contentType);
  const url = URL.createObjectURL(blob);
  objectUrlsByKey.set(record.key, url);
  return url;
};

const recordsToResolved = async (
  records: LocalAttachmentRecord[],
): Promise<ResolvedAttachmentsResult> => {
  const images: ResolvedAttachmentView[] = [];

  for (const record of records) {
    let url = record.remoteUrl;
    try {
      url = await stableObjectUrl(record);
    } catch {
      url = record.remoteUrl;
    }

    if (!url) {
      continue;
    }

    images.push({
      url,
      fileUrl: record.remoteUrl,
      filename: record.filename,
      contentType: record.contentType,
      byteSize: record.byteSize,
    });
  }

  return {
    images,
    revoke: () => {},
  };
};

const remoteFilesToResolved = (
  files: RemoteFileAttachment[],
): ResolvedAttachmentsResult => ({
  images: files
    .filter((file) => typeof file.url === "string" && file.url.length > 0)
    .map((file) => ({
      url: file.url!,
      fileUrl: file.url,
      filename: file.filename,
      contentType: file.contentType,
      byteSize: file.byteSize,
    })),
  revoke: () => {},
});

const listLocalAttachmentRows = async (params: {
  spaceId: string;
  type: CombinedTransactionTypeEnum;
  transactionId: string;
  listRow?: IndexTransaction | null;
}): Promise<LocalAttachmentRecord[]> => {
  const ownerType = attachmentOwnerTypeForTransaction(params.type);
  const ownerIds = [params.transactionId];
  const activitableId = params.listRow?.activitableId;

  if (activitableId && !ownerIds.includes(activitableId)) {
    ownerIds.push(activitableId);
  }

  for (const ownerId of ownerIds) {
    const rows = await listAttachmentsForOwner({
      spaceId: params.spaceId,
      ownerType,
      ownerId,
    });

    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
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
    listRow,
    api,
  } = params;

  if (!spaceId || !transactionId) {
    return emptyResult();
  }

  const localRows = await listLocalAttachmentRows({
    spaceId,
    type,
    transactionId,
    listRow,
  });

  if (localRows.length > 0) {
    return recordsToResolved(localRows);
  }

  const loadDetailFiles = async (useLocalOnly: boolean) => {
    if (useLocalOnly) {
      try {
        return extractRemoteFiles(
          await resolveTransactionDetail({
            api: null,
            spaceId,
            transactionId,
            type,
            listRow,
            preferLocal: true,
          }),
        );
      } catch {
        return [];
      }
    }

    if (!api) {
      return [];
    }

    return extractRemoteFiles(
      await resolveTransactionDetail({
        api,
        spaceId,
        transactionId,
        type,
        listRow,
        preferLocal: false,
      }),
    );
  };

  let remoteFiles = await loadDetailFiles(true);
  if (remoteFiles.length === 0 && api) {
    remoteFiles = await loadDetailFiles(false);
  }

  if (remoteFiles.length === 0) {
    return emptyResult();
  }

  const ownerType = attachmentOwnerTypeForTransaction(type);
  const ownerIds = [transactionId];
  if (listRow?.activitableId && !ownerIds.includes(listRow.activitableId)) {
    ownerIds.push(listRow.activitableId);
  }

  if (api) {
    const stored = await cacheRemoteFilesForOwners({
      spaceId,
      ownerType,
      ownerIds,
      files: remoteFiles,
      api,
    });

    if (stored.length > 0) {
      return recordsToResolved(stored);
    }
  }

  return remoteFilesToResolved(remoteFiles);
};

export const resolveEditAttachmentFile = async (params: {
  spaceId: string;
  transactionId: string;
  type: CombinedTransactionTypeEnum;
  listRow?: IndexTransaction | null;
}): Promise<File | undefined> => {
  const { spaceId, transactionId, type, listRow } = params;

  if (!spaceId || !transactionId) {
    return undefined;
  }

  const rows = await listLocalAttachmentRows({
    spaceId,
    type,
    transactionId,
    listRow,
  });

  if (rows.length === 0) {
    return undefined;
  }

  const file = await loadLocalAttachmentFile(rows[0]!.key);
  if (!file) {
    return undefined;
  }

  return markExistingLocalAttachment(file);
};
