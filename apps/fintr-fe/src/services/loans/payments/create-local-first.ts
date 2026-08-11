import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_LOAN_PAYMENT_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { loanPaymentToIndexRow } from "@/services/loans/loan-payment-index-row";
import {
  replaceLoanPaymentIdInLocalStores,
  syncLoanPaymentsToLocalStores,
} from "@/services/loans/loan-payments-cache";
import {
  removeLocalIndexTransaction,
  replaceLocalIndexTransactionId,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { removeIndexTransactionsFromQueryCaches } from "@/services/transactions/remove-from-query-caches";
import {
  replaceIndexTransactionIdInQueryCaches,
  upsertIndexTransactionsIntoQueryCaches,
} from "@/services/transactions/upsert-into-query-caches";
import { normalizeLoanPayment } from "@/utils/loan-payment-amounts";

import {
  createLoanPayment,
  type CreateLoanPaymentType,
  type LoanPayment,
} from "../payments";

export type LoanPaymentCreateOutboxPayload = {
  loanId: string;
  accountName: string;
  date: string;
  totalPayment: number;
  principalPayment?: number;
  notes?: string;
  adjustsAccountBalance?: boolean;
};

export type CreateLoanPaymentLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localPayment: LoanPayment;
  serverResponse?: unknown;
  syncPromise: Promise<CreateLoanPaymentLocalFirstResult>;
};

export type CreateLoanPaymentLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
  currency?: string;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const clientValidationFailure = (details: Record<string, string[]>) => {
  const error = new Error("Validation failed") as Error & {
    details?: Record<string, string[]>;
    success?: boolean;
  };
  error.details = details;
  error.success = false;
  return error;
};

const validateCreateLoanPaymentForOptimistic = (
  data: Omit<CreateLoanPaymentType, "loanId">,
): void => {
  const details: Record<string, string[]> = {};

  if (!data.accountName?.trim()) {
    details.accountName = ["is required"];
  }
  if (!data.date?.trim()) {
    details.date = ["is required"];
  }
  if (!Number.isFinite(data.totalPayment) || data.totalPayment <= 0) {
    details.totalPayment = ["must be greater than 0"];
  }

  if (Object.keys(details).length > 0) {
    throw clientValidationFailure(details);
  }
};

const isNetworkLikeCreateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to create loan payment" ||
      error.message.toLowerCase().includes("network")
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

const extractCreatedId = (response: unknown): string | undefined => {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const root = response as Record<string, unknown>;
  const data = root.data;

  if (typeof root.id === "string" && root.id) {
    return root.id;
  }

  if (data && typeof data === "object") {
    const nestedId = (data as { id?: unknown }).id;
    if (typeof nestedId === "string" && nestedId) {
      return nestedId;
    }
  }

  return undefined;
};

export const buildOptimisticLoanPayment = (params: {
  id: string;
  loanId: string;
  data: Omit<CreateLoanPaymentType, "loanId">;
  currency?: string;
}): LoanPayment => ({
  id: params.id,
  loanId: params.loanId,
  accountId: "",
  accountName: params.data.accountName,
  date: params.data.date,
  principalPayment:
    params.data.principalPayment ?? params.data.totalPayment,
  interestPayment: 0,
  totalPayment: params.data.totalPayment,
  currency: params.currency ?? "PHP",
  notes: params.data.notes,
  adjustsAccountBalance: params.data.adjustsAccountBalance ?? true,
});

/**
 * Local-first loan payment create: payments list + optional transaction index
 * immediately, IndexedDB + outbox, then POST in the background.
 */
export const createLoanPaymentLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    loanId: string;
    data: Omit<CreateLoanPaymentType, "loanId">;
  },
  options: CreateLoanPaymentLocalFirstOptions = {},
): Promise<CreateLoanPaymentLocalFirstResult> => {
  const { spaceId, loanId, data } = params;
  const { queryClient, waitForSync = true, currency } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to create a local loan payment");
  }

  validateCreateLoanPaymentForOptimistic(data);

  const clientMutationId = newClientMutationId();
  const localId = `local:${clientMutationId}`;
  const localPayment = buildOptimisticLoanPayment({
    id: localId,
    loanId,
    data,
    currency,
  });
  const adjustsBalance = localPayment.adjustsAccountBalance !== false;
  const indexRow = loanPaymentToIndexRow(localPayment, loanId);

  const previousPayments =
    queryClient?.getQueryData<LoanPayment[]>(["loanPayments", loanId]) ?? [];
  const nextPayments = [...previousPayments, localPayment];

  if (queryClient) {
    await syncLoanPaymentsToLocalStores({
      spaceCode: spaceId,
      loanId,
      payments: nextPayments,
      queryClient,
    });
  } else {
    await syncLoanPaymentsToLocalStores({
      spaceCode: spaceId,
      loanId,
      payments: nextPayments,
    });
  }

  if (adjustsBalance) {
    await upsertLocalIndexTransaction(spaceId, indexRow);
    if (queryClient) {
      upsertIndexTransactionsIntoQueryCaches(queryClient, {
        spaceId,
        transactions: [indexRow],
      });
    }
  }

  const outboxPayload: LoanPaymentCreateOutboxPayload = {
    loanId,
    accountName: data.accountName,
    date: data.date,
    totalPayment: data.totalPayment,
    ...(data.principalPayment !== undefined
      ? { principalPayment: data.principalPayment }
      : {}),
    ...(data.notes ? { notes: data.notes } : {}),
    ...(data.adjustsAccountBalance !== undefined
      ? { adjustsAccountBalance: data.adjustsAccountBalance }
      : {}),
  };

  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_LOAN_PAYMENT_CREATE,
    payload: outboxPayload,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  const syncPromise = (async (): Promise<CreateLoanPaymentLocalFirstResult> => {
    try {
      const serverResponse = await createLoanPayment(api, loanId, data);
      const created =
        normalizeLoanPayment(
          (serverResponse as { data?: unknown })?.data ?? serverResponse,
        ) ??
        buildOptimisticLoanPayment({
          id: extractCreatedId(serverResponse) ?? localId,
          loanId,
          data,
          currency,
        });
      const serverId = created.id;

      if (serverId !== localId) {
        if (adjustsBalance) {
          await replaceLocalIndexTransactionId(spaceId, localId, serverId);
          if (queryClient) {
            replaceIndexTransactionIdInQueryCaches(queryClient, {
              spaceId,
              previousId: localId,
              nextId: serverId,
            });
          }
        }

        await replaceLoanPaymentIdInLocalStores({
          spaceCode: spaceId,
          loanId,
          previousId: localId,
          nextPayment: created,
          queryClient,
        });
      } else {
        await replaceLoanPaymentIdInLocalStores({
          spaceCode: spaceId,
          loanId,
          previousId: localId,
          nextPayment: created,
          queryClient,
        });
      }

      await removeOutboxRecord(clientMutationId);

      return {
        data: { id: serverId },
        pendingSync: false,
        localPayment: created,
        serverResponse,
        syncPromise,
      };
    } catch (error) {
      if (isNetworkLikeCreateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error
              ? error.message
              : "Network error creating loan payment",
        });

        return {
          data: { id: localId },
          pendingSync: true,
          localPayment,
          syncPromise,
        };
      }

      if (adjustsBalance) {
        await removeLocalIndexTransaction(spaceId, localId);
        if (queryClient) {
          removeIndexTransactionsFromQueryCaches(queryClient, {
            spaceId,
            removedTransactions: [indexRow],
          });
        }
      }

      await syncLoanPaymentsToLocalStores({
        spaceCode: spaceId,
        loanId,
        payments: previousPayments,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      throw error;
    }
  })();

  const optimisticResult: CreateLoanPaymentLocalFirstResult = {
    data: { id: localId },
    pendingSync: true,
    localPayment,
    syncPromise,
  };

  if (waitForSync) {
    return syncPromise;
  }

  return optimisticResult;
};
