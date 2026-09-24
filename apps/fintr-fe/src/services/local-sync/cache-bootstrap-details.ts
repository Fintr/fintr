import type { AxiosInstance } from "axios";

import {
  attachmentOwnerTypeForTransaction,
} from "@/services/attachments/create-outbox";
import { extractRemoteFiles } from "@/services/attachments/remote-files";
import { cacheRemoteFilesForOwners } from "@/services/attachments/download-remote";
import {
  cacheEditDetailFromIndexRow,
  cacheTransactionDetail,
  mapIndexTransactionToEditDataSync,
  normalizeTransactionEditDetail,
} from "@/services/transactions/detail-local";
import {
  backfillIndexRowForOffline,
  indexRowNeedsFxDetailPrefetch,
} from "@/services/transactions/offline-fx-backfill";
import { cacheTransferDetail } from "@/services/transactions/transfers/local-cache";
import { fetchTransferById } from "@/services/transactions/transfers/queries";
import {
  fetchTransactionById,
} from "@/services/transactions/queries";
import type { IndexTransaction, TransactionsPage } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const FX_DETAIL_PREFETCH_CONCURRENCY = 5;
const MAX_CONSECUTIVE_FX_DETAIL_FAILURES = 5;

/**
 * Seed IndexedDB edit-detail snapshots from bootstrap index rows.
 * Applies offline FX backfill so `currency_conversion` is present even when
 * the bulk bootstrap payload only includes booked legs.
 */
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
        const row = backfillIndexRowForOffline(transaction);

        if (row.type === CombinedTransactionTypeEnum.TRANSFER) {
          const transferId = row.activitableId ?? row.id;
          await cacheTransferDetail(
            spaceId,
            transferId,
            mapIndexTransactionToEditDataSync(row),
          );
          continue;
        }

        await cacheEditDetailFromIndexRow(spaceId, row);
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

/**
 * Fetch full transaction detail for series/installment rows whose index legs
 * cannot reconstruct FX alone (common on first offline bootstrap).
 */
export const prefetchTransactionDetailsForOfflineFx = async (params: {
  api: AxiosInstance;
  spaceId: string;
  transactions: IndexTransaction[];
}): Promise<void> => {
  const { api, spaceId, transactions } = params;
  const needing = transactions.filter(indexRowNeedsFxDetailPrefetch);

  if (needing.length === 0) {
    return;
  }

  let consecutiveFailures = 0;

  for (let index = 0; index < needing.length; index += FX_DETAIL_PREFETCH_CONCURRENCY) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FX_DETAIL_FAILURES) {
      console.warn(
        "[sync] Stopping FX detail prefetch after consecutive failures",
        spaceId,
      );
      return;
    }

    const batch = needing.slice(index, index + FX_DETAIL_PREFETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (transaction) => {
        try {
          if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
            const transferId = transaction.activitableId ?? transaction.id;
            const detail = await fetchTransferById(api, transferId);
            await cacheTransferDetail(spaceId, transferId, detail);
            return true;
          }

          const detail = await fetchTransactionById(api, transaction.id);
          const normalized = normalizeTransactionEditDetail(detail) ?? detail;
          await cacheTransactionDetail(spaceId, transaction.id, normalized);
          return true;
        } catch (error) {
          console.warn(
            "[sync] FX detail prefetch failed",
            spaceId,
            transaction.id,
            error,
          );
          return false;
        }
      }),
    );

    consecutiveFailures = results.every((success) => success)
      ? 0
      : consecutiveFailures + 1;
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
