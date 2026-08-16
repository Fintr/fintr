import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TAG_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyTransactionTagsToCaches,
  loadTransactionTags,
  upsertTransactionTagInList,
} from "@/services/transactions/tags/local-cache";
import { updateTransactionTag } from "@/services/transactions/tags/mutation";
import type {
  TransactionTag,
  UpdateTransactionTagType,
} from "@/types/transactionTagTypes";

export type UpdateTagLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localTag: TransactionTag;
  previousTag: TransactionTag;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateTagLocalFirstResult>;
};

export type UpdateTagLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-tag-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to update tag"
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

/**
 * Local-first tag update: patch tag caches immediately,
 * enqueue outbox, then PUT.
 */
export const updateTagLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    tagId: string;
    updateData: UpdateTransactionTagType;
  },
  options: UpdateTagLocalFirstOptions = {},
): Promise<UpdateTagLocalFirstResult> => {
  const { spaceCode, tagId, updateData } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to update a local tag");
  }

  const tags = await loadTransactionTags(spaceCode);
  const previousTag = tags.find((tag) => tag.id === tagId);

  if (!previousTag) {
    throw new Error("Local tag not found for update");
  }

  const localTag: TransactionTag = {
    ...previousTag,
    ...updateData,
  };

  const nextTags = upsertTransactionTagInList(tags, localTag);
  await applyTransactionTagsToCaches({
    spaceCode,
    tags: nextTags,
    queryClient,
  });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_TAG_UPDATE,
    payload: { tagId, ...updateData },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateTagLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateTagLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateTransactionTag(
        api,
        tagId,
        updateData,
      );
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: tagId },
        pendingSync: false,
        localTag,
        previousTag,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on update",
        });

        resolveSync({
          data: { id: tagId },
          pendingSync: true,
          localTag,
          previousTag,
          syncPromise,
        });
        return;
      }

      const rollbackTags = upsertTransactionTagInList(
        await loadTransactionTags(spaceCode),
        previousTag,
      );
      await applyTransactionTagsToCaches({
        spaceCode,
        tags: rollbackTags,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateTagLocalFirstResult = {
    data: { id: tagId },
    pendingSync: true,
    localTag,
    previousTag,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
