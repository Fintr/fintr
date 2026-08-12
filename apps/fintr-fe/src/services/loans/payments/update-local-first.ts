import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_LOAN_PAYMENT_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { loanPaymentToIndexRow } from "@/services/loans/loan-payment-index-row";
import {
  loadCachedLoanPayments,
} from "@/services/loans/local-cache";
import {
  syncLoanPaymentsToLocalStores,
} from "@/services/loans/loan-payments-cache";
import {
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import {
  upsertIndexTransactionsIntoQueryCaches,
} from "@/services/transactions/upsert-into-query-caches";
import { normalizeLoanPayment } from "@/utils/loan-payment-amounts";

import {
  updateLoanPayment,
  type CreateLoanPaymentType,
  type LoanPayment,
} from "../payments";

export type LoanPaymentUpdateOutboxPayload = {
  loanId: string;
  paymentId: string;
  accountName?: string;
  date?: string;
  totalPayment?: number;
  principalPayment?: number;
  notes?: string;
  adjustsAccountBalance?: boolean;
  originalCurrency?: string;
  exchangeRate?: number;
  exchangeRateSource?: "auto" | "manual" | "recent";
};

export type UpdateLoanPaymentLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localPayment: LoanPayment;
  previousPayment: LoanPayment;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateLoanPaymentLocalFirstResult>;
};

export type UpdateLoanPaymentLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
  spaceCurrency?: string;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-lp-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeUpdateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to update loan payment"
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

export const buildUpdatedLoanPayment = (params: {
  previous: LoanPayment;
  data: Partial<Omit<CreateLoanPaymentType, "loanId">>;
}): LoanPayment => {
  const { previous, data } = params;
  const totalPayment =
    data.totalPayment !== undefined ? data.totalPayment : previous.totalPayment;

  const originalCurrency = data.originalCurrency ?? previous.currencyConversion?.originalCurrency;
  const exchangeRate = data.exchangeRate ?? previous.currencyConversion?.exchangeRate;
  const exchangeRateSource =
    data.exchangeRateSource ?? previous.currencyConversion?.source;

  let currencyConversion = previous.currencyConversion;
  if (
    originalCurrency
    && exchangeRate != null
    && Number.isFinite(exchangeRate)
    && exchangeRate > 0
  ) {
    const convertedAmount =
      Math.round((totalPayment * exchangeRate + Number.EPSILON) * 100) / 100;
    currencyConversion = {
      originalAmount: totalPayment,
      originalCurrency,
      convertedAmount,
      convertedCurrency:
        previous.currencyConversion?.convertedCurrency ?? previous.currency,
      exchangeRate,
      source: exchangeRateSource,
    };
  }

  return {
    ...previous,
    ...(data.accountName ? { accountName: data.accountName } : {}),
    ...(data.date ? { date: data.date } : {}),
    ...(data.totalPayment !== undefined
      ? {
          totalPayment,
          principalPayment: data.principalPayment ?? totalPayment,
        }
      : {}),
    ...(data.principalPayment !== undefined
      && data.totalPayment === undefined
      ? { principalPayment: data.principalPayment }
      : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.adjustsAccountBalance !== undefined
      ? { adjustsAccountBalance: data.adjustsAccountBalance }
      : {}),
    currencyConversion,
  };
};

const applyPaymentCaches = async (params: {
  spaceId: string;
  loanId: string;
  payment: LoanPayment;
  allPayments: LoanPayment[];
  queryClient?: QueryClient;
  spaceCurrency?: string;
}): Promise<void> => {
  const {
    spaceId,
    loanId,
    payment,
    allPayments,
    queryClient,
    spaceCurrency,
  } = params;

  await syncLoanPaymentsToLocalStores({
    spaceCode: spaceId,
    loanId,
    payments: allPayments,
    queryClient,
  });

  if (payment.adjustsAccountBalance === false) {
    return;
  }

  const indexRow = loanPaymentToIndexRow(payment, loanId, { spaceCurrency });
  await upsertLocalIndexTransaction(spaceId, indexRow);
  if (queryClient) {
    upsertIndexTransactionsIntoQueryCaches(queryClient, {
      spaceId,
      transactions: [indexRow],
    });
  }
};

/**
 * Local-first loan payment update: patch payments + optional index row,
 * enqueue outbox, then PUT.
 */
export const updateLoanPaymentLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    loanId: string;
    paymentId: string;
    data: Partial<Omit<CreateLoanPaymentType, "loanId">>;
    previous?: LoanPayment;
  },
  options: UpdateLoanPaymentLocalFirstOptions = {},
): Promise<UpdateLoanPaymentLocalFirstResult> => {
  const { spaceId, loanId, paymentId, data } = params;
  const { queryClient, waitForSync = true, spaceCurrency } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to update a local loan payment");
  }

  const cached = (await loadCachedLoanPayments(spaceId, loanId)) ?? [];
  const stored =
    params.previous
    ?? cached.find((row) => row.id === paymentId);

  if (!stored) {
    throw new Error("Local loan payment not found for update");
  }

  const previousPayment = stored;
  const localPayment = buildUpdatedLoanPayment({
    previous: previousPayment,
    data,
  });
  const nextPayments = cached.length
    ? cached.map((row) => (row.id === paymentId ? localPayment : row))
    : [localPayment];

  await applyPaymentCaches({
    spaceId,
    loanId,
    payment: localPayment,
    allPayments: nextPayments,
    queryClient,
    spaceCurrency,
  });

  const outboxPayload: LoanPaymentUpdateOutboxPayload = {
    loanId,
    paymentId,
    ...data,
  };

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_LOAN_PAYMENT_UPDATE,
    payload: outboxPayload,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateLoanPaymentLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateLoanPaymentLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateLoanPayment(
        api,
        loanId,
        paymentId,
        data,
      );
      const updated = normalizeLoanPayment(
        (serverResponse as { data?: unknown })?.data ?? serverResponse,
      );

      if (updated) {
        const current =
          (await loadCachedLoanPayments(spaceId, loanId)) ?? nextPayments;
        const syncedPayments = current.map((row) =>
          row.id === paymentId ? updated : row,
        );
        await applyPaymentCaches({
          spaceId,
          loanId,
          payment: updated,
          allPayments: syncedPayments,
          queryClient,
          spaceCurrency,
        });
      }

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: paymentId },
        pendingSync: false,
        localPayment: updated ?? localPayment,
        previousPayment,
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
          data: { id: paymentId },
          pendingSync: true,
          localPayment,
          previousPayment,
          syncPromise,
        });
        return;
      }

      const rollbackPayments = nextPayments.map((row) =>
        row.id === paymentId ? previousPayment : row,
      );
      await applyPaymentCaches({
        spaceId,
        loanId,
        payment: previousPayment,
        allPayments: rollbackPayments,
        queryClient,
        spaceCurrency,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateLoanPaymentLocalFirstResult = {
    data: { id: paymentId },
    pendingSync: true,
    localPayment,
    previousPayment,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
