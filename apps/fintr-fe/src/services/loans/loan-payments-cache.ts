import type { QueryClient } from "@tanstack/react-query";

import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import {
  cacheLoanDetail,
  cacheLoanPayments,
  loadCachedLoanDetail,
  loadCachedLoanPayments,
} from "@/services/loans/local-cache";

const toEmbeddedLoanPayment = (
  payment: LoanPayment,
): NonNullable<Loan["loanPayments"]>[number] => ({
  id: payment.id,
  date: payment.date,
  principalPayment: payment.principalPayment,
  interestPayment: payment.interestPayment,
  totalPayment: payment.totalPayment,
  currency: payment.currency,
  adjustsAccountBalance: payment.adjustsAccountBalance,
});

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

  try {
    const loan = await loadCachedLoanDetail(spaceCode, loanId);
    if (!loan) {
      return;
    }

    await cacheLoanDetail(spaceCode, loanId, {
      ...loan,
      loanPayments: payments.map(toEmbeddedLoanPayment),
    });
  } catch (error) {
    console.warn(
      "[local-db] Failed to sync loan payments into cached loan detail",
      error,
    );
  }
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

export const removeLoanPaymentFromCachedLoanDetail = async (
  spaceCode: string,
  loanId: string,
  paymentId: string,
): Promise<void> => {
  if (!spaceCode || !loanId) {
    return;
  }

  try {
    const loan = await loadCachedLoanDetail(spaceCode, loanId);
    if (!loan?.loanPayments?.length) {
      return;
    }

    await cacheLoanDetail(spaceCode, loanId, {
      ...loan,
      loanPayments: loan.loanPayments.filter(
        (payment) => payment.id !== paymentId,
      ),
    });
  } catch (error) {
    console.warn(
      "[local-db] Failed to remove loan payment from cached loan detail",
      error,
    );
  }
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

  if (queryClient) {
    removeLoanPaymentFromQueryCache(queryClient, loanId, paymentId);

    const remaining =
      queryClient.getQueryData<LoanPayment[]>(["loanPayments", loanId]) ?? [];
    queryClient.setQueryData(
      ["loanPayments", "local", spaceCode, loanId],
      remaining,
    );
    await cacheLoanPayments(spaceCode, loanId, remaining);
  }

  await removeLoanPaymentFromCachedLoanDetail(spaceCode, loanId, paymentId);
};
