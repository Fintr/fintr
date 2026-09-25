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

  for (const transaction of withImages) {
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

        if (prefetchFailedToStore(files, stored)) {
          console.warn(
            "[attachments] Prefetch stored no files for transfer",
            transaction.id,
          );
        }
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

      if (prefetchFailedToStore(files, stored)) {
        console.warn(
          "[attachments] Prefetch stored no files for transaction",
          transaction.id,
        );
      }
    } catch (error) {
      console.warn(
        "[attachments] Prefetch failed for transaction",
        transaction.id,
        error,
      );
    }
  }
};

export const prefetchLoanFiles = async (params: {
  api: AxiosInstance;
  spaceId: string;
  loans: unknown[];
}): Promise<void> => {
  for (const loan of params.loans) {
    const record = loan as Record<string, unknown>;
    const loanId = typeof record.id === "string" ? record.id : "";
    const files = extractRemoteFiles(loan);
    if (!loanId || files.length === 0) {
      continue;
    }

    try {
      await cacheRemoteFilesForOwners({
        spaceId: params.spaceId,
        ownerType: "loan",
        ownerIds: [loanId],
        files,
        api: params.api,
      });
    } catch (error) {
      console.warn("[attachments] Loan file prefetch failed", loanId, error);
    }
  }
};

export const prefetchEntityPhotos = async (params: {
  api: AxiosInstance;
  spaceId: string;
  entities: unknown[];
}): Promise<void> => {
  for (const entity of params.entities) {
    const record = entity as Record<string, unknown>;
    const entityId = typeof record.id === "string" ? record.id : "";
    const photoUrl = record.photoUrl ?? record.photo_url;
    if (!entityId || typeof photoUrl !== "string" || photoUrl.length === 0) {
      continue;
    }

    if (photoUrl.startsWith("blob:")) {
      continue;
    }

    try {
      await cacheRemoteFilesForOwners({
        spaceId: params.spaceId,
        ownerType: "entity",
        ownerIds: [entityId],
        files: [
          {
            url: photoUrl,
            filename: "photo",
          },
        ],
        api: params.api,
      });
    } catch (error) {
      console.warn(
        "[attachments] Entity photo prefetch failed",
        entityId,
        error,
      );
    }
  }
};
