import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";

import type { Loan, LoansPage } from "./queries";

export type UpsertLoanListOptions = {
  /** When true, seed a one-loan list if no list exists (loan.created). */
  seedListWhenEmpty?: boolean;
  /** Secondary list source when the primary cache is empty. */
  fallback?: InfiniteData<LoansPage> | undefined;
};

const emptyLoansPage = (loan: Loan): LoansPage => ({
  loans: [loan],
  nextPage: null,
  totalPages: 1,
  totalCount: 1,
});

export const upsertLoanInInfiniteData = (
  current: InfiniteData<LoansPage> | undefined,
  loan: Loan,
  options: UpsertLoanListOptions = {},
): InfiniteData<LoansPage> | undefined => {
  const base =
    current?.pages?.length
      ? current
      : options.fallback?.pages?.length
        ? options.fallback
        : undefined;

  if (!base?.pages?.length) {
    if (!options.seedListWhenEmpty) {
      return current;
    }

    return {
      pages: [emptyLoansPage(loan)],
      pageParams: [1],
    };
  }

  let found = false;
  const pages = base.pages.map((page) => ({
    ...page,
    loans: page.loans.map((existing) => {
      if (existing.id !== loan.id) {
        return existing;
      }

      found = true;
      return loan;
    }),
  }));

  if (!found) {
    const [firstPage, ...rest] = pages;
    pages[0] = {
      ...firstPage,
      loans: [loan, ...firstPage.loans],
    };
    return {
      ...base,
      pages: [pages[0], ...rest],
    };
  }

  return {
    ...base,
    pages,
  };
};

const readLoansInfiniteFromQueryCaches = (
  queryClient: QueryClient,
  spaceCode: string,
): {
  loans: InfiniteData<LoansPage> | undefined;
  local: InfiniteData<LoansPage> | undefined;
} => ({
  loans: queryClient.getQueryData<InfiniteData<LoansPage>>(["loans"]),
  local: spaceCode
    ? queryClient.getQueryData<InfiniteData<LoansPage>>([
        "loans",
        "local",
        spaceCode,
      ])
    : undefined,
});

export const upsertLoanInQueryCaches = (
  queryClient: QueryClient,
  params: {
    spaceCode: string;
    loan: Loan;
    seedListWhenEmpty?: boolean;
  },
): void => {
  const { spaceCode, loan, seedListWhenEmpty = false } = params;
  const { loans: loansData, local: localData } =
    readLoansInfiniteFromQueryCaches(queryClient, spaceCode);

  const nextLoans = upsertLoanInInfiniteData(loansData, loan, {
    seedListWhenEmpty,
    fallback: localData,
  });
  if (nextLoans !== loansData) {
    queryClient.setQueryData(["loans"], nextLoans);
  }

  if (spaceCode) {
    const nextLocal = upsertLoanInInfiniteData(localData, loan, {
      seedListWhenEmpty,
      fallback: nextLoans ?? loansData,
    });
    if (nextLocal !== localData) {
      queryClient.setQueryData(["loans", "local", spaceCode], nextLocal);
    }
  }

  queryClient.setQueryData([LOAN_DETAIL_KEY, loan.id], loan);
};

export const removeLoanFromQueryCaches = (
  queryClient: QueryClient,
  loanId: string,
  spaceCode?: string,
): void => {
  const filterLoanFromInfinite = (
    current: InfiniteData<LoansPage> | undefined,
  ): InfiniteData<LoansPage> | undefined => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        loans: page.loans.filter((loan) => loan.id !== loanId),
      })),
    };
  };

  queryClient.setQueryData<InfiniteData<LoansPage>>(["loans"], (current) =>
    filterLoanFromInfinite(current),
  );

  if (spaceCode) {
    queryClient.setQueryData<InfiniteData<LoansPage>>(
      ["loans", "local", spaceCode],
      (current) => filterLoanFromInfinite(current),
    );
  }

  queryClient.removeQueries({
    queryKey: ["loanPayments", loanId],
  });
  queryClient.removeQueries({
    queryKey: [LOAN_DETAIL_KEY, loanId],
  });
  queryClient.removeQueries({
    queryKey: ["loanDetail", "local"],
    predicate: (query) =>
      Array.isArray(query.queryKey) && query.queryKey.includes(loanId),
  });
};
