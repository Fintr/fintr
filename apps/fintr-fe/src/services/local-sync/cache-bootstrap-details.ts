import type { AxiosInstance } from "axios";

import {
  attachmentOwnerTypeForTransaction,
} from "@/services/attachments/create-outbox";
import { putLocalAttachment } from "@/services/attachments/local-store";
import {
  cacheTransactionDetail,
  mapIndexTransactionToEditData,
} from "@/services/transactions/detail-local";
import { cacheTransferDetail } from "@/services/transactions/transfers/local-cache";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import {
  fetchTransactionById,
} from "@/services/transactions/queries";
import type { IndexTransaction, TransactionsPage } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

type RemoteFileAttachment = {
  id?: string;
  url?: string;
  filename?: string;
  contentType?: string;
  byteSize?: number;
};

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

const cacheRemoteFilesForOwner = async (params: {
  spaceId: string;
  ownerType: ReturnType<typeof attachmentOwnerTypeForTransaction>;
  ownerId: string;
  files: RemoteFileAttachment[];
}): Promise<void> => {
  for (const file of params.files) {
    if (!file.url) {
      continue;
    }

    try {
      const response = await fetch(file.url);
      if (!response.ok) {
        continue;
      }

      const blob = await response.blob();
      await putLocalAttachment({
        spaceId: params.spaceId,
        ownerType: params.ownerType,
        ownerId: params.ownerId,
        file: blob,
        filename: file.filename,
        source: "remote_download",
        remoteUrl: file.url,
        serverFileId: file.id,
      });
    } catch (error) {
      console.warn(
        "[attachments] Failed to prefetch remote file",
        params.ownerId,
        file.url,
        error,
      );
    }
  }
};

export const cacheTransactionDetailsFromIndexPages = async (
  spaceId: string,
  pages: TransactionsPage[],
): Promise<void> => {
  if (!spaceId || pages.length === 0) {
    return;
  }

  for (const page of pages) {
    for (const transaction of page.transactions) {
      try {
        const editData = await mapIndexTransactionToEditData(spaceId, transaction);

        if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
          const transferId = transaction.activitableId ?? transaction.id;
          await cacheTransferDetail(spaceId, transferId, editData);
          continue;
        }

        await cacheTransactionDetail(spaceId, transaction.id, editData);
      } catch (error) {
        console.warn(
          "[sync] Failed to cache index transaction detail",
          spaceId,
          transaction.id,
          error,
        );
      }
    }
  }
};

export const prefetchRemoteAttachmentsForTransactions = async (params: {
  api: AxiosInstance;
  spaceId: string;
  transactions: IndexTransaction[];
}): Promise<void> => {
  const { api, spaceId, transactions } = params;
  const withImages = transactions.filter((transaction) => transaction.hasImage);

  for (const transaction of withImages) {
    try {
      if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
        const transferId = transaction.activitableId ?? transaction.id;
        const detail = await fetchTransferById(api, transferId);
        await cacheTransferDetail(spaceId, transferId, detail);

        await cacheRemoteFilesForOwner({
          spaceId,
          ownerType: attachmentOwnerTypeForTransaction(transaction.type),
          ownerId: transaction.id,
          files: extractRemoteFiles(detail),
        });
        continue;
      }

      const detail = await fetchTransactionById(api, transaction.id);
      await cacheTransactionDetail(spaceId, transaction.id, detail);

      await cacheRemoteFilesForOwner({
        spaceId,
        ownerType: attachmentOwnerTypeForTransaction(transaction.type),
        ownerId: transaction.id,
        files: extractRemoteFiles(detail),
      });
    } catch (error) {
      console.warn(
        "[attachments] Prefetch failed for transaction",
        transaction.id,
        error,
      );
    }
  }
};
