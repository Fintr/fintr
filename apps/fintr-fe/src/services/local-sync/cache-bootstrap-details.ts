import type { AxiosInstance } from "axios";

import {
  attachmentOwnerTypeForTransaction,
} from "@/services/attachments/create-outbox";
import { extractRemoteFiles } from "@/services/attachments/remote-files";
import { cacheRemoteFilesForOwners } from "@/services/attachments/download-remote";
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

const MAX_CONSECUTIVE_ATTACHMENT_FAILURES = 5;

const prefetchFailedToStore = (
  files: ReturnType<typeof extractRemoteFiles>,
  stored: Awaited<ReturnType<typeof cacheRemoteFilesForOwners>>,
): boolean => files.length > 0 && stored.length === 0;

export const prefetchRemoteAttachmentsForTransactions = async (params: {
  api: AxiosInstance;
  spaceId: string;
  transactions: IndexTransaction[];
}): Promise<void> => {
  const { api, spaceId, transactions } = params;
  const withImages = transactions.filter((transaction) => transaction.hasImage);
  let consecutiveFailures = 0;

  for (const transaction of withImages) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_ATTACHMENT_FAILURES) {
      console.warn(
        "[attachments] Stopping prefetch after consecutive download failures",
        spaceId,
      );
      return;
    }

    try {
      if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
        const transferId = transaction.activitableId ?? transaction.id;
        const detail = await fetchTransferById(api, transferId);
        await cacheTransferDetail(spaceId, transferId, detail);
        const files = extractRemoteFiles(detail);
        const stored = await cacheRemoteFilesForOwners({
          spaceId,
          ownerType: attachmentOwnerTypeForTransaction(transaction.type),
          ownerIds: [transaction.id, transferId],
          files,
          api,
        });

        consecutiveFailures = prefetchFailedToStore(files, stored)
          ? consecutiveFailures + 1
          : 0;
        continue;
      }

      const detail = await fetchTransactionById(api, transaction.id);
      await cacheTransactionDetail(spaceId, transaction.id, detail);
      const files = extractRemoteFiles(detail);
      const stored = await cacheRemoteFilesForOwners({
        spaceId,
        ownerType: attachmentOwnerTypeForTransaction(transaction.type),
        ownerIds: [transaction.id, transaction.activitableId ?? transaction.id],
        files,
        api,
      });

      consecutiveFailures = prefetchFailedToStore(files, stored)
        ? consecutiveFailures + 1
        : 0;
    } catch (error) {
      consecutiveFailures += 1;
      console.warn(
        "[attachments] Prefetch failed for transaction",
        transaction.id,
        error,
      );
    }
  }
};
