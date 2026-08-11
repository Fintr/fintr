import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";

import type { Loan, LoansPage } from "./queries";

const upsertLoanInInfiniteData = (
  current: InfiniteData<LoansPage> | undefined,
  loan: Loan,
): InfiniteData<LoansPage> => {
  if (!current?.pages?.length) {
    return {
      pages: [
        {
          loans: [loan],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
        },
      ],
      pageParams: [1],
    };
  }

  let found = false;
  const pages = current.pages.map((page) => ({
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
      ...current,
      pages: [pages[0], ...rest],
    };
  }

  return {
    ...current,
    pages,
  };
};

export const upsertLoanInQueryCaches = (
  queryClient: QueryClient,
  params: {
    spaceCode: string;
    loan: Loan;
  },
): void => {
  const { spaceCode, loan } = params;

  queryClient.setQueryData<InfiniteData<LoansPage>>(["loans"], (current) =>
    upsertLoanInInfiniteData(current, loan),
  );

  if (spaceCode) {
    queryClient.setQueryData<InfiniteData<LoansPage>>(
      ["loans", "local", spaceCode],
      (current) => upsertLoanInInfiniteData(current, loan),
    );
  }

  queryClient.setQueryData([LOAN_DETAIL_KEY, loan.id], loan);
};

export const removeLoanFromQueryCaches = (
  queryClient: QueryClient,
  loanId: string,
): void => {
  queryClient.setQueryData<InfiniteData<LoansPage>>(["loans"], (current) => {
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
  });

  queryClient.removeQueries({
    queryKey: ["loanPayments", loanId],
  });
  queryClient.removeQueries({
    queryKey: [LOAN_DETAIL_KEY, loanId],
  });
  queryClient.removeQueries({
    queryKey: ["loanDetail", "local"],
    predicate: (query) =>
      Array.isArray(query.queryKey) &&
      query.queryKey.includes(loanId),
  });
};
