import type { QueryClient } from "@tanstack/react-query";

import type { LoanPayment } from "@/services/loans/payments";
import {
  cacheLoanPayments,
  loadCachedLoanPayments,
  refreshLoanSnapshotInIndexedDb,
} from "@/services/loans/local-cache";

export const setLoanPaymentsInQueryCache = (
  queryClient: QueryClient,
  loanId: string,
  payments: LoanPayment[],
): void => {
  queryClient.setQueryData<LoanPayment[]>(["loanPayments", loanId], payments);
};

export const syncLoanPaymentsToLocalStores = async (
  params: {
    spaceCode: string;
    loanId: string;
    payments: LoanPayment[];
    queryClient?: QueryClient;
  },
): Promise<void> => {
  const { spaceCode, loanId, payments, queryClient } = params;

  if (!spaceCode || !loanId) {
    return;
  }

  if (queryClient) {
    setLoanPaymentsInQueryCache(queryClient, loanId, payments);
    queryClient.setQueryData(
      ["loanPayments", "local", spaceCode, loanId],
      payments,
    );
  }

  await cacheLoanPayments(spaceCode, loanId, payments);

  await refreshLoanSnapshotInIndexedDb({
    spaceCode,
    loanId,
    payments,
    queryClient,
  });
};

export const replaceLoanPaymentIdInLocalStores = async (
  params: {
    spaceCode: string;
    loanId: string;
    previousId: string;
    nextPayment: LoanPayment;
    queryClient?: QueryClient;
  },
): Promise<void> => {
  const { spaceCode, loanId, previousId, nextPayment, queryClient } = params;

  const cached = (await loadCachedLoanPayments(spaceCode, loanId)) ?? [];
  const hasPrevious = cached.some((payment) => payment.id === previousId);
  const nextPayments = hasPrevious
    ? cached.map((payment) =>
        payment.id === previousId ? nextPayment : payment,
      )
    : [...cached, nextPayment];

  await syncLoanPaymentsToLocalStores({
    spaceCode,
    loanId,
    payments: nextPayments,
    queryClient,
  });
};

export const removeLoanPaymentFromQueryCache = (
  queryClient: QueryClient,
  loanId: string,
  paymentId: string,
): void => {
  queryClient.setQueryData<LoanPayment[]>(
    ["loanPayments", loanId],
    (current) => current?.filter((payment) => payment.id !== paymentId) ?? [],
  );
};

export const upsertLoanPaymentInLocalStores = async (
  params: {
    spaceCode: string;
    loanId: string;
    payment: LoanPayment;
    queryClient?: QueryClient;
  },
): Promise<void> => {
  const { spaceCode, loanId, payment, queryClient } = params;

  const cached = (await loadCachedLoanPayments(spaceCode, loanId)) ?? [];
  const existingIndex = cached.findIndex((row) => row.id === payment.id);
  const nextPayments =
    existingIndex >= 0
      ? cached.map((row, index) => (index === existingIndex ? payment : row))
      : [...cached, payment];

  await syncLoanPaymentsToLocalStores({
    spaceCode,
    loanId,
    payments: nextPayments,
    queryClient,
  });
};

export const removeLoanPaymentFromLocalStores = async (
  params: {
    spaceCode: string;
    loanId: string;
    paymentId: string;
    queryClient?: QueryClient;
  },
): Promise<void> => {
  const { spaceCode, loanId, paymentId, queryClient } = params;

  const cached = (await loadCachedLoanPayments(spaceCode, loanId)) ?? [];
  const remaining = cached.filter((payment) => payment.id !== paymentId);

  if (queryClient) {
    removeLoanPaymentFromQueryCache(queryClient, loanId, paymentId);
    queryClient.setQueryData(
      ["loanPayments", "local", spaceCode, loanId],
      remaining,
    );
  }

  await cacheLoanPayments(spaceCode, loanId, remaining);
  await refreshLoanSnapshotInIndexedDb({
    spaceCode,
    loanId,
    payments: remaining,
    queryClient,
  });
};
