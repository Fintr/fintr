import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
  deleteLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { Loan, LoansPage } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";

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
): Promise<void> => {
  if (!spaceCode || !loan.id) {
    return;
  }

  try {
    const cached = await loadCachedLoansInfiniteData(spaceCode);
    const pages = cached?.pages?.length
      ? cached.pages.map((page) => {
          const existingIndex = page.loans.findIndex(
            (existing) => existing.id === loan.id,
          );

          if (existingIndex >= 0) {
            const loans = [...page.loans];
            loans[existingIndex] = loan;
            return { ...page, loans };
          }

          return page;
        })
      : [
          {
            loans: [loan],
            nextPage: null,
            totalPages: 1,
            totalCount: 1,
          },
        ];

    let found = pages.some((page) =>
      page.loans.some((existing) => existing.id === loan.id),
    );

    if (!found && pages.length > 0) {
      pages[0] = {
        ...pages[0],
        loans: [loan, ...pages[0].loans],
      };
    }

    await cacheLoansAllPages(spaceCode, pages);
    await cacheLoanDetail(spaceCode, loan.id, loan);
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
