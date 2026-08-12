import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_LOAN_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import {
  removeLocalIndexTransaction,
  replaceLocalIndexTransactionId,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import {
  replaceIndexTransactionIdInQueryCaches,
  upsertIndexTransactionsIntoQueryCaches,
  type IndexTransactionWithCategoryIds,
} from "@/services/transactions/upsert-into-query-caches";

import { createLoan, type CreateLoanType } from "./mutation";
import {
  buildCreateOutboxPayload,
  rollbackCreateAttachments,
  syncAttachmentOwnerId,
} from "@/services/attachments/create-outbox";

export type CreateLoanLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localTransaction: IndexTransactionWithCategoryIds;
  serverResponse?: unknown;
  syncPromise: Promise<CreateLoanLocalFirstResult>;
};

export type CreateLoanLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
  amountCurrency?: string;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const buildOptimisticLoanIndexTransaction = (params: {
  id: string;
  data: CreateLoanType;
  amountCurrency?: string;
}): IndexTransactionWithCategoryIds => {
  const { id, data, amountCurrency } = params;
  const isBorrowed = data.loanType === "borrowed";

  return {
    id,
    date: data.date,
    createdAt: new Date().toISOString(),
    description: data.description || data.entityName,
    amount: Math.abs(Number(data.principalAmount) || 0),
    amountCurrency,
    categoryName: "Loan",
    fromAccountName: isBorrowed ? "" : data.accountName,
    toAccountName: isBorrowed ? data.accountName : "",
    type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
    inSeries: false,
    hasImage: Boolean(data.file || data.fileId),
    calculated: true,
    isLoanActivity: true,
    loanType: data.loanType,
    loanId: id,
    entityName: data.entityName,
  };
};

const extractCreatedId = (response: unknown): string | undefined => {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const root = response as Record<string, unknown>;
  const data = root.data;

  if (typeof root.id === "string" && root.id) {
    return root.id;
  }

  if (data && typeof data === "object") {
    const nestedId = (data as { id?: unknown }).id;
    if (typeof nestedId === "string" && nestedId) {
      return nestedId;
    }
  }

  return undefined;
};

const isNetworkLikeCreateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to create loan" ||
      error.message.toLowerCase().includes("network")
    );
  }

  if (error && typeof error === "object") {
    const record = error as { message?: unknown; details?: unknown; success?: unknown };
    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return false;
};

export const createLoanLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    data: CreateLoanType;
  },
  options: CreateLoanLocalFirstOptions = {},
): Promise<CreateLoanLocalFirstResult> => {
  const { spaceId, data } = params;
  const { queryClient, waitForSync = true, amountCurrency } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to create a local loan");
  }

  const clientMutationId = newClientMutationId();
  const localId = `local:${clientMutationId}`;
  const localTransaction = buildOptimisticLoanIndexTransaction({
    id: localId,
    data,
    amountCurrency,
  });

  // Only optimistic-list when the loan adjusts balances (appears in Combined).
  if (data.adjustsAccountBalance !== false) {
    await upsertLocalIndexTransaction(spaceId, localTransaction);
    if (queryClient) {
      upsertIndexTransactionsIntoQueryCaches(queryClient, {
        spaceId,
        transactions: [localTransaction],
      });
    }
  }

  const payloadForOutbox = await buildCreateOutboxPayload({
    spaceId,
    ownerType: "loan",
    ownerId: localId,
    data,
  });
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_LOAN_CREATE,
    payload: payloadForOutbox,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  const syncPromise = (async (): Promise<CreateLoanLocalFirstResult> => {
    try {
      const serverResponse = await createLoan(api, data);
      const serverId = extractCreatedId(serverResponse) ?? localId;

      if (data.adjustsAccountBalance !== false && serverId !== localId) {
        await replaceLocalIndexTransactionId(spaceId, localId, serverId);
        if (queryClient) {
          replaceIndexTransactionIdInQueryCaches(queryClient, {
            spaceId,
            previousId: localId,
            nextId: serverId,
          });
        }
      }

      if (serverId !== localId) {
        await syncAttachmentOwnerId({
          spaceId,
          ownerType: "loan",
          localOwnerId: localId,
          serverOwnerId: serverId,
        });
      }

      await removeOutboxRecord(clientMutationId);
      if (queryClient) {
        void queryClient.invalidateQueries({
          queryKey: ["loans"],
          refetchType: "active",
        });
      }

      return {
        data: { id: serverId },
        pendingSync: false,
        localTransaction: {
          ...localTransaction,
          id: serverId,
          loanId: serverId,
        },
        serverResponse,
        syncPromise,
      };
    } catch (error) {
      if (isNetworkLikeCreateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error
              ? error.message
              : "Network error creating loan",
        });

        return {
          data: { id: localId },
          pendingSync: true,
          localTransaction,
          syncPromise,
        };
      }

      if (data.adjustsAccountBalance !== false) {
        await removeLocalIndexTransaction(spaceId, localId);
        if (queryClient) {
          removeIndexTransactionsFromQueryCaches(queryClient, {
            spaceId,
            removedTransactions: [localTransaction],
          });
        }
      }
      await rollbackCreateAttachments({
        spaceId,
        ownerType: "loan",
        ownerId: localId,
      });
      await removeOutboxRecord(clientMutationId);
      throw error;
    }
  })();

  const optimisticResult: CreateLoanLocalFirstResult = {
    data: { id: localId },
    pendingSync: true,
    localTransaction,
    syncPromise,
  };

  if (waitForSync) {
    return syncPromise;
  }

  return optimisticResult;
};
