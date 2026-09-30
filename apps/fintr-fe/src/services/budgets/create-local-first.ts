import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  getLocalDb,
  OUTBOX_COMMAND_BUDGET_CREATE,
  OUTBOX_COMMAND_BUDGET_DELETE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from "@/services/budgets/mutations";
import { fetchBudgetsPage } from "@/services/budgets/queries";
import type { CreateBudgetPayload } from "@/types/budgetTypes";

import {
  addParentBudgetRowToPage,
  applyBudgetsPageToCaches,
  commitCreatedBudgetToPage,
  loadBudgetsPage,
  upsertSubcategoryBudgetInPage,
  type BudgetRow,
} from "./budget-cache-ops";
import {
  budgetDeletionsForMonth,
  forgetBudgetDeletion,
} from "./budget-deletions";

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

const isPersistedServerBudgetId = (budgetId: string): boolean =>
  budgetId.length > 0
  && !budgetId.startsWith("local:")
  && !budgetId.startsWith("parent:");

const errorText = (error: unknown): string => {
  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
  }

  if (error && typeof error === "object" && "response" in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data != null) {
      try {
        parts.push(JSON.stringify(data));
      } catch {
        parts.push(String(data));
      }
    }
  }

  return parts.join(" ").toLowerCase();
};

const isBudgetAlreadyExistsError = (error: unknown): boolean =>
  errorText(error).includes("already exists");

const isNotFoundError = (error: unknown): boolean => {
  if (error && typeof error === "object" && "response" in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      return true;
    }
  }

  return errorText(error).includes("not found");
};

const cancelBudgetDeletes = async (
  spaceCode: string,
  budgetId: string,
): Promise<void> => {
  const rows = await getLocalDb()
    .outbox
    .where("spaceId")
    .equals(spaceCode)
    .toArray();

  await Promise.all(
    rows
      .filter((row) => {
        if (row.commandType !== OUTBOX_COMMAND_BUDGET_DELETE) {
          return false;
        }

        const payload = row.payload as { budgetId?: string };
        return payload.budgetId === budgetId;
      })
      .map((row) => getLocalDb().outbox.delete(row.id)),
  );
};

const findExistingBudgetId = async (params: {
  api: AxiosInstance;
  spaceCode: string;
  startDate: string;
  endDate: string;
  categoryId: string;
  subcategoryId: string | null;
}): Promise<string | undefined> => {
  const page = await fetchBudgetsPage(params.api, {
    queryKey: [
      "budgets",
      params.spaceCode,
      params.startDate,
      params.endDate,
    ],
  });

  for (const raw of page.budgets ?? []) {
    const row = raw as BudgetRow;
    const rowCategoryId = String(row.category_id ?? row.categoryId ?? "");
    if (rowCategoryId !== params.categoryId) {
      continue;
    }

    if (!params.subcategoryId) {
      const id = String(row.id ?? "");
      if (isPersistedServerBudgetId(id)) {
        return id;
      }
      continue;
    }

    const subcategories = Array.isArray(row.subcategories)
      ? row.subcategories
      : [];

    for (const subRaw of subcategories) {
      const sub = subRaw as BudgetRow;
      const subCategoryId = String(
        sub.subcategory_id ?? sub.subcategoryId ?? "",
      );
      const id = String(sub.id ?? "");
      if (
        subCategoryId === params.subcategoryId
        && isPersistedServerBudgetId(id)
      ) {
        return id;
      }
    }
  }

  return undefined;
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
    has_explicit_parent_budget: true,
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
  const subcategoryId = data.subcategoryId ?? null;
  const priorBudgetId = (
    await budgetDeletionsForMonth(spaceCode, data.date || startDate)
  ).find((row) =>
    row.categoryId === (data.categoryId ?? "")
    && (row.subcategoryId ?? null) === subcategoryId
    && isPersistedServerBudgetId(row.budgetId),
  )?.budgetId;

  if (priorBudgetId) {
    await cancelBudgetDeletes(spaceCode, priorBudgetId);
  }

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

  await forgetBudgetDeletion({
    spaceCode,
    monthStart: data.date || startDate,
    categoryId: data.categoryId ?? "",
    subcategoryId: data.subcategoryId ?? null,
  });

  await queryClient?.cancelQueries({
    queryKey: ["budgets", "local", spaceCode, startDate, endDate],
  });

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
  const syncPromise = new Promise<CreateBudgetLocalFirstResult>((resolve) => {
    resolveSync = resolve;
  });

  const deletedDuringCreate = async (): Promise<boolean> => {
    const deletions = await budgetDeletionsForMonth(
      spaceCode,
      data.date || startDate,
    );

    return deletions.some(
      (row) =>
        row.categoryId === (data.categoryId ?? "")
        && (row.subcategoryId ?? null) === subcategoryId,
    );
  };

  const persistCreatedBudget = async (serverId: string): Promise<void> => {
    const currentPage =
      await loadBudgetsPage(spaceCode, startDate, endDate) ?? nextPage;
    await applyBudgetsPageToCaches({
      spaceCode,
      startDate,
      endDate,
      page: commitCreatedBudgetToPage({
        page: currentPage,
        localId,
        serverId,
        row: {
          ...localBudgetRow,
          amount: data.amount,
        },
      }),
      queryClient,
    });
  };

  const adoptServerBudget = async (serverId: string): Promise<void> => {
    await cancelBudgetDeletes(spaceCode, serverId);
    await updateBudget(api, serverId, { amount: data.amount });
    await persistCreatedBudget(serverId);
    await removeOutboxRecord(clientMutationId);
    resolveSync({
      data: { id: serverId },
      pendingSync: false,
      localBudgetRow: {
        ...localBudgetRow,
        id: serverId,
        amount: data.amount,
      },
      syncPromise,
    });
  };

  const runSync = async (): Promise<void> => {
    try {
      if (await deletedDuringCreate()) {
        await removeOutboxRecord(clientMutationId);
        resolveSync({
          data: { id: localId },
          pendingSync: false,
          localBudgetRow,
          syncPromise,
        });
        return;
      }

      if (priorBudgetId) {
        try {
          await adoptServerBudget(priorBudgetId);
          return;
        } catch (error) {
          if (!isNotFoundError(error)) {
            throw error;
          }
        }
      }

      try {
        const serverResponse = await createBudget(api, data);
        const created = extractCreatedBudget(serverResponse);

        if (await deletedDuringCreate()) {
          if (created?.id && !created.id.startsWith("local:")) {
            await deleteBudget(api, created.id);
          }
          await removeOutboxRecord(clientMutationId);
          resolveSync({
            data: { id: localId },
            pendingSync: false,
            localBudgetRow,
            serverResponse,
            syncPromise,
          });
          return;
        }

        await persistCreatedBudget(created?.id ?? localId);

        await removeOutboxRecord(clientMutationId);

        resolveSync({
          data: { id: created?.id ?? localId },
          pendingSync: false,
          localBudgetRow: created ?? localBudgetRow,
          serverResponse,
          syncPromise,
        });
      } catch (error) {
        if (!isBudgetAlreadyExistsError(error) || !data.categoryId) {
          throw error;
        }

        const existingId = await findExistingBudgetId({
          api,
          spaceCode,
          startDate,
          endDate,
          categoryId: data.categoryId,
          subcategoryId,
        });

        if (!existingId) {
          throw error;
        }

        await adoptServerBudget(existingId);
      }
    } catch (error) {
      await updateOutboxStatus({
        id: clientMutationId,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Could not save budget",
      });

      resolveSync({
        data: { id: localId },
        pendingSync: true,
        localBudgetRow,
        syncPromise,
      });
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
