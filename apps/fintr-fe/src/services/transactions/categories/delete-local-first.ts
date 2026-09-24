import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_CATEGORY_DELETE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  addCategoryToTrees,
  applyCategoryTreesToCaches,
  findCategoryInTrees,
  loadCategoryTrees,
  removeCategoryFromTrees,
} from "@/services/transactions/categories/category-cache-ops";
import { deleteTransactionCategory } from "@/services/transactions/categories/mutation";
import {
  isNetworkLikeMutationError,
  readBrowserOnline,
} from "@/services/local-first/network-error";
import type { TransactionCategory } from "@/types/transactionCategoryTypes";

export type DeleteCategoryLocalFirstResult = {
  data: { id: string; success?: boolean };
  pendingSync: boolean;
  previousCategory: TransactionCategory;
  serverResponse?: unknown;
  syncPromise: Promise<DeleteCategoryLocalFirstResult>;
};

export type DeleteCategoryLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-cat-del-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const cancelPendingLocalCreate = async (categoryId: string): Promise<void> => {
  if (!categoryId.startsWith("local:")) {
    return;
  }

  const clientMutationId = categoryId.slice("local:".length);
  await removeOutboxRecord(clientMutationId);
};

/**
 * Local-first category delete: remove from caches immediately,
 * enqueue outbox (or cancel pending create), then DELETE.
 */
export const deleteCategoryLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    categoryId: string;
  },
  options: DeleteCategoryLocalFirstOptions = {},
): Promise<DeleteCategoryLocalFirstResult> => {
  const { spaceCode, categoryId } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to delete a local category");
  }

  const trees = await loadCategoryTrees(spaceCode);
  const previousCategory = findCategoryInTrees(trees, categoryId);

  if (!previousCategory) {
    throw new Error("Local category not found for delete");
  }

  const nextTrees = removeCategoryFromTrees(trees, categoryId);
  await applyCategoryTreesToCaches({
    spaceCode,
    trees: nextTrees,
    queryClient,
  });

  if (categoryId.startsWith("local:")) {
    await cancelPendingLocalCreate(categoryId);

    return {
      data: { id: categoryId, success: true },
      pendingSync: false,
      previousCategory,
      syncPromise: Promise.resolve({
        data: { id: categoryId, success: true },
        pendingSync: false,
        previousCategory,
        syncPromise: Promise.resolve({} as DeleteCategoryLocalFirstResult),
      }),
    };
  }

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_CATEGORY_DELETE,
    payload: { categoryId },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: DeleteCategoryLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<DeleteCategoryLocalFirstResult>(
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
        previousCategory,
        syncPromise,
      });
      return;
    }

    try {
      const serverResponse = await deleteTransactionCategory(api, categoryId);
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: {
          id: categoryId,
          success: serverResponse?.success ?? true,
        },
        pendingSync: false,
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
            error instanceof Error ? error.message : "Network error on delete",
        });

        resolveSync({
          data: { id: categoryId },
          pendingSync: true,
          previousCategory,
          syncPromise,
        });
        return;
      }

      const rollbackTrees = addCategoryToTrees(
        await loadCategoryTrees(spaceCode),
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

  const pendingResult: DeleteCategoryLocalFirstResult = {
    data: { id: categoryId },
    pendingSync: true,
    previousCategory,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
