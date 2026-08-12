import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_LOAN_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import {
  loadCachedLoanSnapshot,
  upsertLoanInCachedPages,
} from "@/services/loans/local-cache";
import { upsertLoanInQueryCaches } from "@/services/loans/loans-list-cache";
import type { Loan } from "@/services/loans/queries";
import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { upsertIndexTransactionsIntoQueryCaches } from "@/services/transactions/upsert-into-query-caches";

import { updateLoan, type UpdateLoanType } from "./mutation";

export type UpdateLoanLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localLoan: Loan;
  previousLoan: Loan;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateLoanLocalFirstResult>;
};

export type UpdateLoanLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-loan-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeUpdateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to update loan"
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

export const buildUpdatedLoan = (params: {
  previous: Loan;
  data: UpdateLoanType;
}): Loan => {
  const { previous, data } = params;
  return {
    ...previous,
    entityName:
      data.entityName !== undefined ? data.entityName : previous.entityName,
    description:
      data.description !== undefined
        ? data.description
        : previous.description,
  };
};

const applyLoanCaches = async (params: {
  spaceId: string;
  loan: Loan;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, loan, queryClient } = params;

  await upsertLoanInCachedPages(spaceId, loan, { queryClient });

  if (queryClient) {
    upsertLoanInQueryCaches(queryClient, {
      spaceCode: spaceId,
      loan,
    });
    queryClient.setQueryData([LOAN_DETAIL_KEY, loan.id], loan);
  }

  const indexRow = await loadLocalIndexTransactionById(spaceId, loan.id);
  if (!indexRow) {
    return;
  }

  const nextIndex = {
    ...indexRow,
    entityName: loan.entityName,
    description: loan.description || loan.entityName,
  };
  await upsertLocalIndexTransaction(spaceId, nextIndex);
  if (queryClient) {
    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [nextIndex],
    });
  }
};

/**
 * Local-first loan update (entity / notes): patch loan caches immediately,
 * enqueue outbox, then PUT.
 */
export const updateLoanLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    data: UpdateLoanType;
    previous?: Loan;
  },
  options: UpdateLoanLocalFirstOptions = {},
): Promise<UpdateLoanLocalFirstResult> => {
  const { spaceId, data } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to update a local loan");
  }
  if (!data?.id) {
    throw new Error("loan id is required to update");
  }

  const stored =
    params.previous ?? (await loadCachedLoanSnapshot(spaceId, data.id));

  if (!stored) {
    throw new Error("Local loan not found for update");
  }

  const previousLoan = stored;
  const localLoan = buildUpdatedLoan({ previous: previousLoan, data });

  await applyLoanCaches({ spaceId, loan: localLoan, queryClient });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_LOAN_UPDATE,
    payload: data,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateLoanLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateLoanLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateLoan(api, data);
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: data.id },
        pendingSync: false,
        localLoan,
        previousLoan,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeUpdateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on update",
        });

        resolveSync({
          data: { id: data.id },
          pendingSync: true,
          localLoan,
          previousLoan,
          syncPromise,
        });
        return;
      }

      await applyLoanCaches({ spaceId, loan: previousLoan, queryClient });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateLoanLocalFirstResult = {
    data: { id: data.id },
    pendingSync: true,
    localLoan,
    previousLoan,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
