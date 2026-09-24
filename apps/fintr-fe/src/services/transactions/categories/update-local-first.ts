import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_CATEGORY_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyCategoryTreesToCaches,
  findCategoryInTrees,
  loadCategoryTrees,
  updateCategoryInTrees,
} from "@/services/transactions/categories/category-cache-ops";
import { updateTransactionCategory } from "@/services/transactions/categories/mutation";
import type { TransactionCategory } from "@/types/transactionCategoryTypes";
import {
  isNetworkLikeMutationError,
  readBrowserOnline,
} from "@/services/local-first/network-error";
import { scheduleOutboxDrain } from "@/services/local-sync/drain-outbox";

export type UpdateCategoryLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localCategory: TransactionCategory;
  previousCategory: TransactionCategory;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateCategoryLocalFirstResult>;
};

export type UpdateCategoryLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-cat-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Local-first category update: patch category caches immediately,
 * enqueue outbox, then PUT.
 */
export const updateCategoryLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    categoryId: string;
    updateData: {
      name: string;
      icon?: string;
      color?: string;
    };
  },
  options: UpdateCategoryLocalFirstOptions = {},
): Promise<UpdateCategoryLocalFirstResult> => {
  const { spaceCode, categoryId, updateData } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to update a local category");
  }

  const trees = await loadCategoryTrees(spaceCode);
  const previousCategory = findCategoryInTrees(trees, categoryId);

  if (!previousCategory) {
    throw new Error("Local category not found for update");
  }

  const localCategory: TransactionCategory = {
    ...previousCategory,
    ...updateData,
  };

  const nextTrees = updateCategoryInTrees(trees, categoryId, updateData);
  await applyCategoryTreesToCaches({
    spaceCode,
    trees: nextTrees,
    queryClient,
  });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_CATEGORY_UPDATE,
    payload: { categoryId, ...updateData },
    clientMutationId,
  });

  let resolveSync!: (value: UpdateCategoryLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateCategoryLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    if (!readBrowserOnline()) {
      await updateOutboxStatus({
        id: clientMutationId,
        status: "pending",
        lastError: "Offline — will sync when online",
      });

      resolveSync({
        data: { id: categoryId },
        pendingSync: true,
        localCategory,
        previousCategory,
        syncPromise,
      });
      return;
    }

    await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

    try {
      const serverResponse = await updateTransactionCategory(
        api,
        categoryId,
        updateData,
      );
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: categoryId },
        pendingSync: false,
        localCategory,
        previousCategory,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeMutationError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on update",
        });

        resolveSync({
          data: { id: categoryId },
          pendingSync: true,
          localCategory,
          previousCategory,
          syncPromise,
        });
        scheduleOutboxDrain(api);
        return;
      }

      const rollbackTrees = updateCategoryInTrees(
        await loadCategoryTrees(spaceCode),
        categoryId,
        previousCategory,
      );
      await applyCategoryTreesToCaches({
        spaceCode,
        trees: rollbackTrees,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();
  scheduleOutboxDrain(api);

  const pendingResult: UpdateCategoryLocalFirstResult = {
    data: { id: categoryId },
    pendingSync: true,
    localCategory,
    previousCategory,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
