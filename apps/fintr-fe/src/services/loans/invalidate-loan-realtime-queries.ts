import type { QueryClient } from "@tanstack/react-query";

import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import type { LoanPayment } from "@/services/loans/payments";
import { removeLoanPaymentFromLocalStores } from "@/services/loans/loan-payments-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

export type LoanRealtimeRow = {
  id?: string;
  loanId?: string;
  type: CombinedTransactionTypeEnum;
};

export const transactionRowTouchesLoans = (row: LoanRealtimeRow): boolean =>
  row.type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT ||
  row.type === CombinedTransactionTypeEnum.LOAN_PAYMENT ||
  Boolean(row.loanId);

const findLoanIdForPaymentInQueryCache = (
  client: QueryClient,
  paymentId: string,
): string | undefined => {
  for (const query of client.getQueryCache().findAll({
    queryKey: ["loanPayments"],
    exact: false,
  })) {
    const key = query.queryKey;
    let loanId: string | undefined;

    if (
      key.length >= 2 &&
      key[0] === "loanPayments" &&
      typeof key[1] === "string" &&
      key[1] !== "local"
    ) {
      loanId = key[1];
    } else if (
      key.length >= 4 &&
      key[0] === "loanPayments" &&
      key[1] === "local" &&
      typeof key[3] === "string"
    ) {
      loanId = key[3];
    } else {
      continue;
    }

    const payments = query.state.data as LoanPayment[] | undefined;
    if (payments?.some((payment) => payment.id === paymentId)) {
      return loanId;
    }
  }

  return undefined;
};

/**
 * Drop deleted loan payments from React Query + IndexedDB immediately so peers
 * see the removal without waiting for a refetch.
 */
export const applyLoanPaymentRealtimeDeletes = async (
  client: QueryClient,
  spaceCode: string,
  rows: LoanRealtimeRow[],
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  const paymentDeletes = rows.filter(
    (row) =>
      row.type === CombinedTransactionTypeEnum.LOAN_PAYMENT && Boolean(row.id),
  );

  if (paymentDeletes.length === 0) {
    return;
  }

  await Promise.all(
    paymentDeletes.map(async (row) => {
      const loanId =
        row.loanId ?? findLoanIdForPaymentInQueryCache(client, row.id!);
      if (!loanId) {
        return;
      }

      await removeLoanPaymentFromLocalStores({
        spaceCode,
        loanId,
        paymentId: row.id!,
        queryClient: client,
      });
    }),
  );
};

/**
 * Refetch loan list, detail, and payments when ActionCable reports loan activity.
 */
export const invalidateLoanRealtimeQueries = async (
  client: QueryClient,
  rows: LoanRealtimeRow[],
): Promise<void> => {
  if (!rows.some(transactionRowTouchesLoans)) {
    return;
  }

  await client.invalidateQueries({
    queryKey: ["loans"],
    refetchType: "active",
  });

  const loanIds = new Set(
    rows
      .map((row) => row.loanId)
      .filter((id): id is string => Boolean(id)),
  );

  if (loanIds.size === 0) {
    await client.invalidateQueries({
      queryKey: ["loanPayments"],
      exact: false,
      refetchType: "active",
    });
    await client.invalidateQueries({
      queryKey: [LOAN_DETAIL_KEY],
      exact: false,
      refetchType: "active",
    });
    return;
  }

  await Promise.all(
    Array.from(loanIds).flatMap((loanId) => [
      client.invalidateQueries({
        queryKey: ["loanPayments", loanId],
        refetchType: "active",
      }),
      client.invalidateQueries({
        queryKey: [LOAN_DETAIL_KEY, loanId],
        refetchType: "active",
      }),
    ]),
  );
};

export const syncLoanRealtimeAfterDelete = async (
  client: QueryClient,
  spaceCode: string,
  rows: LoanRealtimeRow[],
): Promise<void> => {
  await applyLoanPaymentRealtimeDeletes(client, spaceCode, rows);
  await invalidateLoanRealtimeQueries(client, rows);
};
