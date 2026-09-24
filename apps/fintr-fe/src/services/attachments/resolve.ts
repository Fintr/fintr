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
import {
  extractRemoteFiles,
  type RemoteFileAttachment,
} from "./remote-files";
import { markExistingLocalAttachment } from "@/utils/fileUtils";

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
    preferLocal,
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
  if (remoteFiles.length === 0 && !preferLocal) {
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

  if (!preferLocal && api) {
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
