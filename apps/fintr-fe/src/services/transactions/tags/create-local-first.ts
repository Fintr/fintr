import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_TAG_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyTransactionTagsToCaches,
  loadTransactionTags,
  normalizeTransactionTag,
  removeTransactionTagFromList,
  replaceTransactionTagIdInList,
  upsertTransactionTagInList,
} from "@/services/transactions/tags/local-cache";
import { createTransactionTag } from "@/services/transactions/tags/mutation";
import { resolveTagStyleImageUrl } from "@/lib/tags/preset-style-images";
import type {
  CreateTransactionTagType,
  TransactionTag,
} from "@/types/transactionTagTypes";

export type CreateTagLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localTag: TransactionTag;
  serverResponse?: unknown;
  syncPromise: Promise<CreateTagLocalFirstResult>;
};

export type CreateTagLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

export type TagCreateOutboxPayload = CreateTransactionTagType & {
  localId: string;
};

const DEFAULT_TAG_COLOR = "#0A3D62";

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-tag-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to create tag"
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

const extractCreatedTag = (response: unknown): TransactionTag | undefined => {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  if (typeof data.id !== "string" || !data.id) {
    return undefined;
  }

  return normalizeTransactionTag(data);
};

export const buildOptimisticTag = (params: {
  id: string;
  data: CreateTransactionTagType;
}): TransactionTag => {
  const { id, data } = params;

  return {
    id,
    name: data.name.trim(),
    color: data.color?.trim() || DEFAULT_TAG_COLOR,
    isDefault: false,
    stylePresetKey: data.stylePresetKey,
    styleImageUrl: resolveTagStyleImageUrl({
      stylePresetKey: data.stylePresetKey,
    }),
  };
};

/**
 * Local-first tag create: patch tag caches immediately,
 * enqueue outbox, then POST.
 */
export const createTagLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    data: CreateTransactionTagType;
  },
  options: CreateTagLocalFirstOptions = {},
): Promise<CreateTagLocalFirstResult> => {
  const { spaceCode, data } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to create a local tag");
  }

  const clientMutationId = newClientMutationId();
  const localId = `local:${clientMutationId}`;
  const localTag = buildOptimisticTag({ id: localId, data });

  const tags = await loadTransactionTags(spaceCode);
  const nextTags = upsertTransactionTagInList(tags, localTag);
  await applyTransactionTagsToCaches({
    spaceCode,
    tags: nextTags,
    queryClient,
  });

  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_TAG_CREATE,
    payload: { ...data, localId },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: CreateTagLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<CreateTagLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await createTransactionTag(api, data);
      const created = extractCreatedTag(serverResponse);

      if (created && created.id !== localId) {
        const currentTags = await loadTransactionTags(spaceCode);
        const withReplacedId = replaceTransactionTagIdInList(
          currentTags,
          localId,
          created.id,
        );
        const finalTags = upsertTransactionTagInList(withReplacedId, created);
        await applyTransactionTagsToCaches({
          spaceCode,
          tags: finalTags,
          queryClient,
        });
      }

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: created?.id ?? localId },
        pendingSync: false,
        localTag: created ?? localTag,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on create",
        });

        resolveSync({
          data: { id: localId },
          pendingSync: true,
          localTag,
          syncPromise,
        });
        return;
      }

      const rollbackTags = removeTransactionTagFromList(
        await loadTransactionTags(spaceCode),
        localId,
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

  const pendingResult: CreateTagLocalFirstResult = {
    data: { id: localId },
    pendingSync: true,
    localTag,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
