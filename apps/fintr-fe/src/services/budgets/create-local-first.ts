import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_BUDGET_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { createBudget } from "@/services/budgets/mutations";
import type { CreateBudgetPayload } from "@/types/budgetTypes";

import {
  addParentBudgetRowToPage,
  applyBudgetsPageToCaches,
  loadBudgetsPage,
  replaceBudgetIdInPage,
  upsertSubcategoryBudgetInPage,
  type BudgetRow,
} from "./budget-cache-ops";

export type BudgetCreateOutboxPayload = CreateBudgetPayload & {
  localId: string;
  startDate: string;
  endDate: string;
};

export type CreateBudgetLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localBudgetRow: BudgetRow;
  serverResponse?: unknown;
  syncPromise: Promise<CreateBudgetLocalFirstResult>;
};

export type CreateBudgetLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
  amountCurrency?: string;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-budget-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

const extractCreatedBudget = (response: unknown): BudgetRow | undefined => {
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

  return {
    id: data.id,
    date: String(data.date ?? ""),
    category_name: String(data.categoryName ?? data.category_name ?? ""),
    category_id: String(data.categoryId ?? data.category_id ?? ""),
    subcategory_id: data.subcategoryId ?? data.subcategory_id ?? null,
    total_spent: Number(data.totalSpent ?? data.total_spent ?? 0),
    amount_currency: String(data.amountCurrency ?? data.amount_currency ?? "PHP"),
    amount: Number(data.amount ?? data.budget ?? 0),
    has_explicit_parent_budget: Boolean(
      data.hasExplicitParentBudget ?? data.has_explicit_parent_budget,
    ),
    parent_only_spent: Number(
      data.parentOnlySpent ?? data.parent_only_spent ?? 0,
    ),
    subcategories: Array.isArray(data.subcategories) ? data.subcategories : [],
  };
};

export const buildOptimisticParentBudgetRow = (params: {
  id: string;
  data: CreateBudgetPayload;
  amountCurrency?: string;
}): BudgetRow => {
  const { id, data, amountCurrency = "PHP" } = params;

  return {
    id,
    date: data.date,
    category_name: data.categoryName ?? "",
    category_id: data.categoryId ?? "",
    subcategory_id: data.subcategoryId ?? null,
    total_spent: 0,
    amount_currency: amountCurrency,
    amount: data.amount,
    has_explicit_parent_budget: false,
    parent_only_spent: 0,
    subcategories: [],
  };
};

/**
 * Local-first budget create: patch budgets cache immediately,
 * enqueue outbox, then POST.
 */
export const createBudgetLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    startDate: string;
    endDate: string;
    data: CreateBudgetPayload;
  },
  options: CreateBudgetLocalFirstOptions = {},
): Promise<CreateBudgetLocalFirstResult> => {
  const { spaceCode, startDate, endDate, data } = params;
  const { queryClient, waitForSync = true, amountCurrency = "PHP" } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to create a local budget");
  }

  const clientMutationId = newClientMutationId();
  const localId = `local:${clientMutationId}`;
  const existingPage =
  await loadBudgetsPage(spaceCode, startDate, endDate)
    ?? {
      budgets: [],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    };

  let nextPage = existingPage;
  let localBudgetRow: BudgetRow;

  if (data.subcategoryId && data.categoryId) {
    localBudgetRow = {
      id: localId,
      subcategoryId: data.subcategoryId,
      subcategory_id: data.subcategoryId,
      name: data.categoryName ?? "",
      spent: 0,
      budget: data.amount,
      amount: data.amount,
    };
    nextPage = upsertSubcategoryBudgetInPage(existingPage, {
      categoryId: data.categoryId,
      subcategoryId: data.subcategoryId,
      budgetId: localId,
      amount: data.amount,
      date: data.date,
      subcategoryName: data.categoryName,
      amountCurrency,
    });
  } else {
    localBudgetRow = buildOptimisticParentBudgetRow({
      id: localId,
      data,
      amountCurrency,
    });
    nextPage = addParentBudgetRowToPage(existingPage, localBudgetRow);
  }

  await applyBudgetsPageToCaches({
    spaceCode,
    startDate,
    endDate,
    page: nextPage,
    queryClient,
  });

  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_BUDGET_CREATE,
    payload: {
      ...data,
      localId,
      startDate,
      endDate,
    },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: CreateBudgetLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<CreateBudgetLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await createBudget(api, data);
      const created = extractCreatedBudget(serverResponse);

      if (created && created.id !== localId) {
        const currentPage =
          await loadBudgetsPage(spaceCode, startDate, endDate) ?? nextPage;
        const withReplacedId = replaceBudgetIdInPage(
          currentPage,
          localId,
          created.id,
        );
        await applyBudgetsPageToCaches({
          spaceCode,
          startDate,
          endDate,
          page: withReplacedId,
          queryClient,
        });
      }

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: created?.id ?? localId },
        pendingSync: false,
        localBudgetRow: created ?? localBudgetRow,
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
          localBudgetRow,
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

  const pendingResult: CreateBudgetLocalFirstResult = {
    data: { id: localId },
    pendingSync: true,
    localBudgetRow,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
