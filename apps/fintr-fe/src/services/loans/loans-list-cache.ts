import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";

import type { Loan, LoansPage } from "./queries";

export type UpsertLoanListOptions = {
  /** When true, seed a one-loan list if no list exists (loan.created). */
  seedListWhenEmpty?: boolean;
  /** Secondary list source when the primary cache is empty. */
  fallback?: InfiniteData<LoansPage> | undefined;
};

export const loansListQueryKey = (
  spaceCode: string,
): readonly ["loans", string] => ["loans", spaceCode];

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
} => {
  if (!spaceCode) {
    return { loans: undefined, local: undefined };
  }

  return {
    loans: queryClient.getQueryData<InfiniteData<LoansPage>>(
      loansListQueryKey(spaceCode),
    ),
    local: queryClient.getQueryData<InfiniteData<LoansPage>>([
      "loans",
      "local",
      spaceCode,
    ]),
  };
};

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

  if (spaceCode) {
    const nextLoans = upsertLoanInInfiniteData(loansData, loan, {
      seedListWhenEmpty,
      fallback: localData,
    });
    if (nextLoans) {
      queryClient.setQueryData(loansListQueryKey(spaceCode), nextLoans);
    }

    const nextLocal = upsertLoanInInfiniteData(localData, loan, {
      seedListWhenEmpty,
      fallback: nextLoans,
    });
    if (nextLocal) {
      queryClient.setQueryData(["loans", "local", spaceCode], nextLocal);
    }
  }

  queryClient.setQueryData([LOAN_DETAIL_KEY, loan.id], loan);

  if (spaceCode) {
    queryClient.setQueryData(
      [LOAN_DETAIL_KEY, "local", spaceCode, loan.id],
      loan,
    );
  }
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

  const dropLoan = (key: readonly unknown[]) => {
    queryClient.setQueryData<InfiniteData<LoansPage>>(key, (current) =>
      filterLoanFromInfinite(current),
    );
  };

  if (spaceCode) {
    dropLoan(loansListQueryKey(spaceCode));
    dropLoan(["loans", "local", spaceCode]);
  } else {
    for (const query of queryClient.getQueryCache().findAll({
      queryKey: ["loans"],
    })) {
      const key = query.queryKey;
      const isLegacyList = key.length === 1 && key[0] === "loans";
      const isSpaceList =
        key.length === 2 &&
        key[0] === "loans" &&
        typeof key[1] === "string" &&
        key[1] !== "local";
      const isLocalList =
        key.length === 3 &&
        key[0] === "loans" &&
        key[1] === "local" &&
        typeof key[2] === "string";

      if (isLegacyList || isSpaceList || isLocalList) {
        dropLoan(key);
      }
    }
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

  queryClient.setQueriesData(
    { queryKey: ["entityDetail"] },
    (current) => {
      if (!current || typeof current !== "object") {
        return current;
      }

      const detail = current as {
        loans?: Array<{ id: string }>;
        loanPayments?: Array<{ loanId: string }>;
      };

      if (!Array.isArray(detail.loans)) {
        return current;
      }

      const loans = detail.loans.filter((loan) => loan.id !== loanId);
      if (loans.length === detail.loans.length) {
        return current;
      }

      return {
        ...detail,
        loans,
        loanPayments: Array.isArray(detail.loanPayments)
          ? detail.loanPayments.filter((payment) => payment.loanId !== loanId)
          : detail.loanPayments,
      };
    },
  );
};
