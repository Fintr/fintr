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
} from "@/services/budgets/mutations";

import {
  applyBudgetsPageToCaches,
  findBudgetLocation,
  loadBudgetsPage,
  replaceBudgetIdInPage,
  type BudgetRow,
} from "./budget-cache-ops";
import {
  loadBudgetDeletions,
  rememberBudgetDeletion,
} from "./budget-deletions";
import { calendarMonthStartDate } from "./create-monthly-budget";

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

const isNotFoundError = (error: unknown): boolean => {
  if (error && typeof error === "object" && "response" in error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404) {
      return true;
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("not found");
};

const createdBudgetId = (response: unknown): string | undefined => {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const root = response as { id?: unknown; data?: { id?: unknown } };
  if (typeof root.data?.id === "string" && root.data.id) {
    return root.data.id;
  }

  if (typeof root.id === "string" && root.id) {
    return root.id;
  }

  return undefined;
};

const isServerBudgetId = (budgetId: string): boolean =>
  budgetId.length > 0
  && !budgetId.startsWith("local:")
  && !budgetId.startsWith("parent:");

const cancelBudgetCreatesForDeletion = async (params: {
  spaceCode: string;
  startDate: string;
  budgetId: string;
  categoryId: string;
  subcategoryId: string | null;
}): Promise<void> => {
  const monthStart = calendarMonthStartDate(params.startDate);
  const rows = await getLocalDb()
    .outbox
    .where("spaceId")
    .equals(params.spaceCode)
    .toArray();

  await Promise.all(
    rows
      .filter((row) => {
        if (row.commandType !== OUTBOX_COMMAND_BUDGET_CREATE) {
          return false;
        }

        const payload = row.payload as {
          localId?: string;
          categoryId?: string;
          date?: string;
          subcategoryId?: string | null;
        };
        if (payload.localId === params.budgetId) {
          return true;
        }

        return payload.categoryId === params.categoryId
          && (payload.subcategoryId ?? null) === params.subcategoryId
          && calendarMonthStartDate(String(payload.date ?? "")) === monthStart;
      })
      .map((row) => getLocalDb().outbox.delete(row.id)),
  );
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
  const categoryId = String(
    location.kind === "parent"
      ? location.row.category_id ?? location.row.categoryId ?? ""
      : location.parent.category_id ?? location.parent.categoryId ?? "",
  );
  const subcategoryId = location.kind === "subcategory"
    ? String(location.row.subcategory_id ?? location.row.subcategoryId ?? "")
    : "";

  await rememberBudgetDeletion({
    spaceCode,
    monthStart: startDate,
    categoryId,
    subcategoryId: subcategoryId || null,
    budgetId,
  });

  if (location.kind === "parent") {
    const subcategories = Array.isArray(location.row.subcategories)
      ? location.row.subcategories
      : [];

    for (const sub of subcategories) {
      const subRow = sub as BudgetRow;
      const subBudgetId = String(subRow.id ?? "");
      const subCategoryId = String(
        subRow.subcategory_id ?? subRow.subcategoryId ?? "",
      );
      if (!subBudgetId || !subCategoryId) {
        continue;
      }

      await rememberBudgetDeletion({
        spaceCode,
        monthStart: startDate,
        categoryId,
        subcategoryId: subCategoryId,
        budgetId: subBudgetId,
      });
    }
  }

  await cancelBudgetCreatesForDeletion({
    spaceCode,
    startDate,
    budgetId,
    categoryId,
    subcategoryId: subcategoryId || null,
  });

  await applyBudgetsPageToCaches({
    spaceCode,
    startDate,
    endDate,
    page: existingPage,
    queryClient,
  });

  if (!isServerBudgetId(budgetId)) {
    const localResult: DeleteBudgetLocalFirstResult = {
      data: { id: budgetId },
      pendingSync: false,
      removedBudgetRow,
      syncPromise: Promise.resolve(null as never),
    };
    localResult.syncPromise = Promise.resolve(localResult);
    return localResult;
  }

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
  const syncPromise = new Promise<DeleteBudgetLocalFirstResult>((resolve) => {
    resolveSync = resolve;
  });

  const deletionStillWanted = async (): Promise<boolean> => {
    const deletions = await loadBudgetDeletions(spaceCode);
    return deletions.some((row) => row.budgetId === budgetId);
  };

  const reviveRecreatedBudget = async (): Promise<void> => {
    if (!categoryId) {
      return;
    }

    const page = await loadBudgetsPage(spaceCode, startDate, endDate);
    if (!page) {
      return;
    }

    const rows = (page.budgets ?? []) as BudgetRow[];
    const parent = rows.find(
      (row) =>
        String(row.category_id ?? row.categoryId ?? "") === categoryId,
    );
    if (!parent) {
      return;
    }

    const target = subcategoryId
      ? ((parent.subcategories ?? []) as BudgetRow[]).find(
        (row) =>
          String(row.subcategory_id ?? row.subcategoryId ?? "") === subcategoryId,
      )
      : parent;
    const amount = Number(target?.amount ?? 0);
    const rowId = String(target?.id ?? "");
    if (!target || amount < 1 || !rowId) {
      return;
    }

    const response = await createBudget(api, {
      categoryId,
      subcategoryId: subcategoryId || null,
      amount,
      date: startDate,
    });
    const serverId = createdBudgetId(response);
    if (!serverId || serverId === rowId) {
      return;
    }

    await applyBudgetsPageToCaches({
      spaceCode,
      startDate,
      endDate,
      page: replaceBudgetIdInPage(page, rowId, serverId),
      queryClient,
    });
  };

  const runSync = async (): Promise<void> => {
    try {
      if (!(await deletionStillWanted())) {
        await removeOutboxRecord(clientMutationId);
        resolveSync({
          data: { id: budgetId },
          pendingSync: false,
          removedBudgetRow,
          syncPromise,
        });
        return;
      }

      await deleteBudget(api, budgetId);

      if (!(await deletionStillWanted())) {
        await reviveRecreatedBudget();
      }

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: budgetId },
        pendingSync: false,
        removedBudgetRow,
        syncPromise,
      });
    } catch (error) {
      if (isNotFoundError(error)) {
        await removeOutboxRecord(clientMutationId);
        resolveSync({
          data: { id: budgetId },
          pendingSync: false,
          removedBudgetRow,
          syncPromise,
        });
        return;
      }

      await updateOutboxStatus({
        id: clientMutationId,
        status: "pending",
        lastError:
          error instanceof Error ? error.message : "Could not delete budget",
      });

      resolveSync({
        data: { id: budgetId },
        pendingSync: true,
        removedBudgetRow,
        syncPromise,
      });
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
