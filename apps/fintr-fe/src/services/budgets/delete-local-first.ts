import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_BUDGET_DELETE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { deleteBudget } from "@/services/budgets/mutations";

import {
  applyBudgetsPageToCaches,
  findBudgetLocation,
  loadBudgetsPage,
  removeBudgetRowFromPage,
  type BudgetRow,
} from "./budget-cache-ops";

export type BudgetDeleteOutboxPayload = {
  budgetId: string;
  startDate: string;
  endDate: string;
};

export type DeleteBudgetLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  removedBudgetRow: BudgetRow;
  syncPromise: Promise<DeleteBudgetLocalFirstResult>;
};

export type DeleteBudgetLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-budget-del-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("network")
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
 * Local-first budget delete: patch budgets cache immediately,
 * enqueue outbox, then DELETE.
 */
export const deleteBudgetLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    startDate: string;
    endDate: string;
    budgetId: string;
  },
  options: DeleteBudgetLocalFirstOptions = {},
): Promise<DeleteBudgetLocalFirstResult> => {
  const { spaceCode, startDate, endDate, budgetId } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to delete a local budget");
  }

  const existingPage = await loadBudgetsPage(spaceCode, startDate, endDate);

  if (!existingPage) {
    throw new Error("Local budgets page not found for delete");
  }

  const location = findBudgetLocation(existingPage, budgetId);

  if (!location) {
    throw new Error("Local budget not found for delete");
  }

  const removedBudgetRow = { ...location.row };
  const nextPage = removeBudgetRowFromPage(existingPage, budgetId);

  await applyBudgetsPageToCaches({
    spaceCode,
    startDate,
    endDate,
    page: nextPage,
    queryClient,
  });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_BUDGET_DELETE,
    payload: {
      budgetId,
      startDate,
      endDate,
    },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: DeleteBudgetLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<DeleteBudgetLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      await deleteBudget(api, budgetId);
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: budgetId },
        pendingSync: false,
        removedBudgetRow,
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
          data: { id: budgetId },
          pendingSync: true,
          removedBudgetRow,
          syncPromise,
        });
        return;
      }

      await applyBudgetsPageToCaches({
        spaceCode,
        startDate,
        endDate,
        page: existingPage,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: DeleteBudgetLocalFirstResult = {
    data: { id: budgetId },
    pendingSync: true,
    removedBudgetRow,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
