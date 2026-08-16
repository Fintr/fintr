import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_CATEGORY_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  addCategoryToTrees,
  applyCategoryTreesToCaches,
  loadCategoryTrees,
  removeCategoryFromTrees,
  replaceCategoryIdInTrees,
  updateCategoryInTrees,
} from "@/services/transactions/categories/category-cache-ops";
import { createTransactionCategory } from "@/services/transactions/categories/mutation";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import type { CreateTransactionCategoryType } from "@/types/transactionCategoryTypes";
import type { TransactionCategory } from "@/types/transactionCategoryTypes";
import { resolveCategoryAppearance } from "@/utils/categoryAppearance";
import {
  isNetworkLikeMutationError,
  readBrowserOnline,
} from "@/services/local-first/network-error";

export type CreateCategoryLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localCategory: TransactionCategory;
  serverResponse?: unknown;
  syncPromise: Promise<CreateCategoryLocalFirstResult>;
};

export type CreateCategoryLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-cat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const extractCreatedCategory = (
  response: unknown,
): TransactionCategory | undefined => {
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

  const appearance = resolveCategoryAppearance({
    name: String(data.name ?? ""),
    categoryType: String(data.categoryType ?? data.category_type ?? "expense"),
    icon: (data.icon as string | null | undefined) ?? null,
    color: (data.color as string | null | undefined) ?? null,
  });

  return {
    id: data.id,
    name: String(data.name ?? ""),
    categoryType: (data.categoryType ?? data.category_type ?? CategoryTypeEnum.EXPENSE) as CategoryTypeEnum,
    parentId: (data.parentId ?? data.parent_id ?? null) as string | null,
    icon: appearance.icon,
    color: appearance.color,
    children: [],
  };
};

export const buildOptimisticCategory = (params: {
  id: string;
  data: CreateTransactionCategoryType;
}): TransactionCategory => {
  const { id, data } = params;
  const appearance = resolveCategoryAppearance({
    name: data.name,
    categoryType: data.categoryType,
    icon: data.icon,
    color: data.color,
  });

  return {
    id,
    name: data.name.trim(),
    categoryType: data.categoryType,
    parentId: data.parentId ?? null,
    icon: appearance.icon,
    color: appearance.color,
    children: [],
  };
};

/**
 * Local-first category create: patch category caches immediately,
 * enqueue outbox, then POST.
 */
export const createCategoryLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    data: CreateTransactionCategoryType;
  },
  options: CreateCategoryLocalFirstOptions = {},
): Promise<CreateCategoryLocalFirstResult> => {
  const { spaceCode, data } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to create a local category");
  }

  const clientMutationId = newClientMutationId();
  const localId = `local:${clientMutationId}`;
  const localCategory = buildOptimisticCategory({ id: localId, data });

  const trees = await loadCategoryTrees(spaceCode);
  const nextTrees = addCategoryToTrees(trees, localCategory);
  await applyCategoryTreesToCaches({
    spaceCode,
    trees: nextTrees,
    queryClient,
  });

  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_CATEGORY_CREATE,
    payload: { ...data, localId },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: CreateCategoryLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<CreateCategoryLocalFirstResult>(
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
        data: { id: localId },
        pendingSync: true,
        localCategory,
        syncPromise,
      });
      return;
    }

    try {
      const serverResponse = await createTransactionCategory(api, data);
      const created = extractCreatedCategory(serverResponse);

      if (created && created.id !== localId) {
        const currentTrees = await loadCategoryTrees(spaceCode);
        const withReplacedId = replaceCategoryIdInTrees(
          currentTrees,
          localId,
          created.id,
        );
        const finalTrees = updateCategoryInTrees(withReplacedId, created.id, {
          ...created,
        });
        await applyCategoryTreesToCaches({
          spaceCode,
          trees: finalTrees,
          queryClient,
        });
      }

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: created?.id ?? localId },
        pendingSync: false,
        localCategory: created ?? localCategory,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeMutationError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on create",
        });

        resolveSync({
          data: { id: localId },
          pendingSync: true,
          localCategory,
          syncPromise,
        });
        return;
      }

      const rollbackTrees = removeCategoryFromTrees(
        await loadCategoryTrees(spaceCode),
        localId,
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

  const pendingResult: CreateCategoryLocalFirstResult = {
    data: { id: localId },
    pendingSync: true,
    localCategory,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
