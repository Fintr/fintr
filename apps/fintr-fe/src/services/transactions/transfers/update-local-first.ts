import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TRANSFER_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  loadLocalIndexTransactionById,
} from "@/services/transactions/local-cache";
import type { IndexTransaction } from "@/types/transactionTypes";
import { invalidateLocalInsightsQueries } from "@/utils/invalidateSpaceQueries";

import { patchTransferAndFeeCaches } from "./patch-transfer-fee-caches";
import {
  updateTransfer,
  type UpdateTransferType,
} from "./mutation";

export type UpdateTransferLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateTransferLocalFirstResult>;
};

export type UpdateTransferLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-xfer-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeUpdateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to update transfer"
      || error.message.toLowerCase().includes("network")
      || error.message.toLowerCase().includes("failed to fetch")
    );
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      details?: unknown;
      success?: unknown;
    };
    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return false;
};

const rebuildPreviousTransferData = (params: {
  previous: IndexTransaction;
  data: UpdateTransferType;
}): UpdateTransferType => {
  const { previous, data } = params;
  return {
    ...data,
    id: previous.id,
    amount: Math.abs(Number(previous.amount) || 0),
    transactionCost: data.transactionCost,
    fromAccountName: previous.fromAccountName || "",
    toAccountName: previous.toAccountName || "",
    description: previous.description ?? "",
    date: previous.date,
    scheduleType: data.scheduleType ?? ScheduleTypeEnum.ONE_TIME,
    repeatInterval: data.repeatInterval,
  };
};

/**
 * Local-first transfer update: patch transfer + fee caches immediately,
 * enqueue outbox, then PUT. Offline edits survive reload.
 */
export const updateTransferLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    data: UpdateTransferType;
    previous?: IndexTransaction;
    amountCurrency?: string;
  },
  options: UpdateTransferLocalFirstOptions = {},
): Promise<UpdateTransferLocalFirstResult> => {
  const { spaceId, data, amountCurrency } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to update a local transfer");
  }
  if (!data?.id) {
    throw new Error("transfer id is required to update");
  }

  const stored =
    params.previous
    ?? (await loadLocalIndexTransactionById(spaceId, data.id));

  if (!stored) {
    throw new Error("Local transfer not found for update");
  }

  if (queryClient) {
    await patchTransferAndFeeCaches({
      spaceId,
      queryClient,
      transferId: data.id,
      data,
      amountCurrency: amountCurrency ?? stored.amountCurrency,
      previousTransfer: stored,
    });
    invalidateLocalInsightsQueries(queryClient);
  }

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_TRANSFER_UPDATE,
    payload: data,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateTransferLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateTransferLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateTransfer(api, data);
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: data.id },
        pendingSync: false,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeUpdateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on update",
        });

        resolveSync({
          data: { id: data.id },
          pendingSync: true,
          syncPromise,
        });
        return;
      }

      if (queryClient) {
        const rollbackData = rebuildPreviousTransferData({
          previous: stored,
          data,
        });
        await patchTransferAndFeeCaches({
          spaceId,
          queryClient,
          transferId: data.id,
          data: rollbackData,
          amountCurrency: amountCurrency ?? stored.amountCurrency,
          previousTransfer: {
            ...stored,
            description: data.description ?? stored.description,
            amount: data.amount ?? stored.amount,
            date: data.date ?? stored.date,
            fromAccountName: data.fromAccountName ?? stored.fromAccountName,
            toAccountName: data.toAccountName ?? stored.toAccountName,
          },
        });
        invalidateLocalInsightsQueries(queryClient);
      }
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateTransferLocalFirstResult = {
    data: { id: data.id },
    pendingSync: true,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
