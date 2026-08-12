import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
  deleteLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { Loan, LoansPage } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import {
  upsertLoanInInfiniteData,
  upsertLoanInQueryCaches,
  type UpsertLoanListOptions,
} from "@/services/loans/loans-list-cache";
import { patchLoanFromPayments } from "@/utils/patch-loan-from-payments";

const loansAllPagesKey = (spaceCode: string): string =>
  `loansAllPages:${spaceCode}`;

const loanDetailKey = (spaceCode: string, loanId: string): string =>
  `loanDetail:${spaceCode}:${loanId}`;

const loanPaymentsKey = (spaceCode: string, loanId: string): string =>
  `loanPayments:${spaceCode}:${loanId}`;

export const cacheLoansAllPages = async (
  spaceCode: string,
  pages: LoansPage[],
): Promise<void> => {
  if (!spaceCode || pages.length === 0) {
    return;
  }

  try {
    await putLocalResponseSnapshot(loansAllPagesKey(spaceCode), pages);
  } catch (error) {
    console.warn("[local-db] Failed to cache loans pages", error);
  }
};

export const loadCachedLoansInfiniteData = async (
  spaceCode: string,
): Promise<
  | {
      pages: LoansPage[];
      pageParams: number[];
    }
  | undefined
> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    const pages = await getLocalResponseSnapshot<LoansPage[]>(
      loansAllPagesKey(spaceCode),
    );

    if (!pages?.length) {
      return undefined;
    }

    return {
      pages,
      pageParams: pages.map((_, index) => index + 1),
    };
  } catch (error) {
    console.warn("[local-db] Failed to load cached loans pages", error);
    return undefined;
  }
};

export const cacheLoanDetail = async (
  spaceCode: string,
  loanId: string,
  loan: Loan,
): Promise<void> => {
  if (!spaceCode || !loanId) {
    return;
  }

  try {
    await putLocalResponseSnapshot(loanDetailKey(spaceCode, loanId), loan);
  } catch (error) {
    console.warn("[local-db] Failed to cache loan detail", error);
  }
};

export const loadCachedLoanDetail = async (
  spaceCode: string,
  loanId: string,
): Promise<Loan | undefined> => {
  if (!spaceCode || !loanId) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot<Loan>(
      loanDetailKey(spaceCode, loanId),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached loan detail", error);
    return undefined;
  }
};

/**
 * Loads a loan from IndexedDB — detail snapshot first, then the loans list pages.
 */
export const loadCachedLoanSnapshot = async (
  spaceCode: string,
  loanId: string,
): Promise<Loan | undefined> => {
  const detail = await loadCachedLoanDetail(spaceCode, loanId);
  if (detail) {
    return detail;
  }

  const listData = await loadCachedLoansInfiniteData(spaceCode);

  return listData?.pages
    .flatMap((page) => page.loans ?? [])
    .find((loan) => loan.id === loanId);
};

/**
 * Recomputes loan balance + embedded payments in IndexedDB after payments change.
 * React Query mirrors are updated only after the IDB write succeeds.
 */
export const refreshLoanSnapshotInIndexedDb = async (params: {
  spaceCode: string;
  loanId: string;
  payments: LoanPayment[];
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceCode, loanId, payments, queryClient } = params;

  if (!spaceCode || !loanId) {
    return;
  }

  const loan = await loadCachedLoanSnapshot(spaceCode, loanId);
  if (!loan) {
    return;
  }

  const patchedLoan = patchLoanFromPayments(loan, payments);

  await upsertLoanInCachedPages(spaceCode, patchedLoan, { queryClient });

  if (queryClient) {
    upsertLoanInQueryCaches(queryClient, {
      spaceCode,
      loan: patchedLoan,
    });
  }
};

export const removeCachedLoanDetail = async (
  spaceCode: string,
  loanId: string,
): Promise<void> => {
  if (!spaceCode || !loanId) {
    return;
  }

  await deleteLocalResponseSnapshot(loanDetailKey(spaceCode, loanId));
};

export const upsertLoanInCachedPages = async (
  spaceCode: string,
  loan: Loan,
  options: UpsertLoanListOptions & { queryClient?: QueryClient } = {},
): Promise<void> => {
  if (!spaceCode || !loan.id) {
    return;
  }

  const { queryClient, seedListWhenEmpty = false, fallback } = options;

  try {
    const cached = await loadCachedLoansInfiniteData(spaceCode);
    const queryFallback =
      fallback ??
      (queryClient
        ? queryClient.getQueryData<InfiniteData<LoansPage>>([
            "loans",
            "local",
            spaceCode,
          ]) ??
          queryClient.getQueryData<InfiniteData<LoansPage>>(["loans"])
        : undefined);

    const merged = upsertLoanInInfiniteData(
      cached ?? undefined,
      loan,
      {
        seedListWhenEmpty,
        fallback: queryFallback,
      },
    );

    if (!merged?.pages?.length) {
      await cacheLoanDetail(spaceCode, loan.id, loan);
      return;
    }

    await cacheLoansAllPages(spaceCode, merged.pages);
    await cacheLoanDetail(spaceCode, loan.id, loan);

    if (queryClient) {
      queryClient.setQueryData(["loans", "local", spaceCode], merged);
    }
  } catch (error) {
    console.warn("[local-db] Failed to upsert loan in cached pages", error);
  }
};

export const removeLoanFromCachedPages = async (
  spaceCode: string,
  loanId: string,
): Promise<void> => {
  if (!spaceCode || !loanId) {
    return;
  }

  try {
    const cached = await loadCachedLoansInfiniteData(spaceCode);
    if (!cached?.pages?.length) {
      return;
    }

    const pages = cached.pages.map((page) => ({
      ...page,
      loans: page.loans.filter((loan) => loan.id !== loanId),
    }));

    await cacheLoansAllPages(spaceCode, pages);
  } catch (error) {
    console.warn("[local-db] Failed to remove loan from cached pages", error);
  }

  await removeCachedLoanDetail(spaceCode, loanId);
  await removeCachedLoanPayments(spaceCode, loanId);
};

export const cacheLoanPayments = async (
  spaceCode: string,
  loanId: string,
  payments: LoanPayment[],
): Promise<void> => {
  if (!spaceCode || !loanId) {
    return;
  }

  try {
    await putLocalResponseSnapshot(loanPaymentsKey(spaceCode, loanId), payments);
  } catch (error) {
    console.warn("[local-db] Failed to cache loan payments", error);
  }
};

export const loadCachedLoanPayments = async (
  spaceCode: string,
  loanId: string,
): Promise<LoanPayment[] | undefined> => {
  if (!spaceCode || !loanId) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot<LoanPayment[]>(
      loanPaymentsKey(spaceCode, loanId),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached loan payments", error);
    return undefined;
  }
};

export const removeCachedLoanPayments = async (
  spaceCode: string,
  loanId: string,
): Promise<void> => {
  if (!spaceCode || !loanId) {
    return;
  }

  await deleteLocalResponseSnapshot(loanPaymentsKey(spaceCode, loanId));
};
