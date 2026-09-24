import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_BUDGET_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  updateBudget,
  type UpdateBudgetPayload,
} from "@/services/budgets/mutations";

import {
  applyBudgetsPageToCaches,
  findBudgetLocation,
  loadBudgetsPage,
  updateBudgetRowInPage,
  type BudgetRow,
} from "./budget-cache-ops";

export type BudgetUpdateOutboxPayload = UpdateBudgetPayload & {
  budgetId: string;
  startDate: string;
  endDate: string;
};

export type UpdateBudgetLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localBudgetRow: BudgetRow;
  previousBudgetRow: BudgetRow;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateBudgetLocalFirstResult>;
};

export type UpdateBudgetLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-budget-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
 * Local-first budget update: patch budgets cache immediately,
 * enqueue outbox, then PUT.
 */
export const updateBudgetLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    startDate: string;
    endDate: string;
    budgetId: string;
    data: UpdateBudgetPayload;
  },
  options: UpdateBudgetLocalFirstOptions = {},
): Promise<UpdateBudgetLocalFirstResult> => {
  const { spaceCode, startDate, endDate, budgetId, data } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to update a local budget");
  }

  const existingPage = await loadBudgetsPage(spaceCode, startDate, endDate);

  if (!existingPage) {
    throw new Error("Local budgets page not found for update");
  }

  const location = findBudgetLocation(existingPage, budgetId);

  if (!location) {
    throw new Error("Local budget not found for update");
  }

  const previousBudgetRow = { ...location.row };
  const localBudgetRow: BudgetRow = {
    ...location.row,
    amount: data.amount,
    budget: data.amount,
  };
  const nextPage = updateBudgetRowInPage(existingPage, budgetId, {
    amount: data.amount,
  });

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
    commandType: OUTBOX_COMMAND_BUDGET_UPDATE,
    payload: {
      budgetId,
      ...data,
      startDate,
      endDate,
    },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateBudgetLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateBudgetLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateBudget(api, budgetId, data);
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: budgetId },
        pendingSync: false,
        localBudgetRow,
        previousBudgetRow,
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
          data: { id: budgetId },
          pendingSync: true,
          localBudgetRow,
          previousBudgetRow,
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

  const pendingResult: UpdateBudgetLocalFirstResult = {
    data: { id: budgetId },
    pendingSync: true,
    localBudgetRow,
    previousBudgetRow,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
