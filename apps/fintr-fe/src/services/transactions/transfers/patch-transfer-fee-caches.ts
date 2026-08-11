import type { QueryClient } from "@tanstack/react-query";

import {
  loadCachedTransactionsInRange,
  removeLocalIndexTransactionsByIds,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import {
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "@/services/transactions/upsert-into-query-caches";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  buildOptimisticTransferFeeIndexTransaction,
  buildOptimisticTransferIndexTransaction,
} from "./create-local-first";
import {
  buildTransferFeeDescription,
  TRANSFER_FEE_CATEGORY_NAME,
} from "./fee-description";
import type { CreateTransferType, UpdateTransferType } from "./mutation";

const findExistingTransferFee = async (params: {
  spaceId: string;
  transfer: IndexTransaction;
}): Promise<IndexTransaction | null> => {
  const { spaceId, transfer } = params;
  try {
    const rows = await loadCachedTransactionsInRange(
      spaceId,
      "1970-01-01",
      "2100-12-31",
    );
    const expected = buildTransferFeeDescription({
      description: transfer.description,
      transferAmount: Math.abs(Number(transfer.amount) || 0),
    });
    return (
      rows.find((row) => {
        if (row.type !== CombinedTransactionTypeEnum.EXPENSE) return false;
        if (
          row.categoryName.trim().toLowerCase() !==
          TRANSFER_FEE_CATEGORY_NAME.toLowerCase()
        ) {
          return false;
        }
        if (row.date !== transfer.date) return false;
        if ((row.fromAccountName ?? "") !== (transfer.fromAccountName ?? "")) {
          return false;
        }
        // Prefer exact description match; also accept any fee on same day/account
        // when the transfer note just changed.
        return (
          row.description === expected ||
          row.description.startsWith("Transfer fee")
        );
      }) ?? null
    );
  } catch {
    return null;
  }
};

/**
 * Immediately reflect a transfer create/update (+ fee expense) in RQ + IndexedDB.
 */
export const patchTransferAndFeeCaches = async (params: {
  spaceId: string;
  queryClient: QueryClient;
  transferId: string;
  data: CreateTransferType | UpdateTransferType;
  amountCurrency?: string;
  previousTransfer?: IndexTransaction | null;
}): Promise<void> => {
  const {
    spaceId,
    queryClient,
    transferId,
    data,
    amountCurrency,
    previousTransfer,
  } = params;

  const transferRow = buildOptimisticTransferIndexTransaction({
    id: transferId,
    data,
    amountCurrency,
  });

  const existingFee = previousTransfer
    ? await findExistingTransferFee({
        spaceId,
        transfer: previousTransfer,
      })
    : await findExistingTransferFee({
        spaceId,
        transfer: transferRow,
      });

  const feeAmount = Math.abs(Number(data.transactionCost) || 0);
  let feeRow: IndexTransactionWithCategoryIds | null = null;

  if (feeAmount > 0) {
    feeRow = buildOptimisticTransferFeeIndexTransaction({
      id: existingFee?.id ?? `local:fee:${transferId}`,
      data,
      amountCurrency,
    });
  }

  await upsertLocalIndexTransaction(spaceId, transferRow);
  if (feeRow) {
    await upsertLocalIndexTransaction(spaceId, feeRow);
  } else if (existingFee) {
    // Cost cleared — drop the old fee from view + IDB.
    await removeLocalIndexTransactionsByIds(spaceId, [existingFee.id]);
    removeIndexTransactionsFromQueryCaches(queryClient, {
      spaceId,
      removedTransactions: [existingFee],
    });
  }

  const rows = feeRow ? [transferRow, feeRow] : [transferRow];
  upsertIndexTransactionsIntoQueryCaches(queryClient, {
    spaceId,
    transactions: rows,
  });
};
