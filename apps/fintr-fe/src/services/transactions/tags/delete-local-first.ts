import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TAG_DELETE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyTransactionTagsToCaches,
  loadTransactionTags,
  removeTransactionTagFromList,
  upsertTransactionTagInList,
} from "@/services/transactions/tags/local-cache";
import { deleteTransactionTag } from "@/services/transactions/tags/mutation";
import type { TransactionTag } from "@/types/transactionTagTypes";

export type DeleteTagLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  previousTag: TransactionTag;
  serverResponse?: unknown;
  syncPromise: Promise<DeleteTagLocalFirstResult>;
};

export type DeleteTagLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-tag-del-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to delete tag"
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

  return true;
};

/**
 * Local-first tag delete: remove from caches immediately,
 * enqueue outbox, then DELETE.
 */
export const deleteTagLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    tagId: string;
  },
  options: DeleteTagLocalFirstOptions = {},
): Promise<DeleteTagLocalFirstResult> => {
  const { spaceCode, tagId } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to delete a local tag");
  }

  const tags = await loadTransactionTags(spaceCode);
  const previousTag = tags.find((tag) => tag.id === tagId);

  if (!previousTag) {
    throw new Error("Local tag not found for delete");
  }

  const nextTags = removeTransactionTagFromList(tags, tagId);
  await applyTransactionTagsToCaches({
    spaceCode,
    tags: nextTags,
    queryClient,
  });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_TAG_DELETE,
    payload: { tagId },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: DeleteTagLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<DeleteTagLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await deleteTransactionTag(api, tagId);
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: tagId },
        pendingSync: false,
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
            error instanceof Error ? error.message : "Network error on delete",
        });

        resolveSync({
          data: { id: tagId },
          pendingSync: true,
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

  const pendingResult: DeleteTagLocalFirstResult = {
    data: { id: tagId },
    pendingSync: true,
    previousTag,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
