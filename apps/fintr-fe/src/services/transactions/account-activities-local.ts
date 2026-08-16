import { listSpaceAccounts } from "@/lib/local-db/accounts";
import { listSpaceTransactionsInDateRange } from "@/lib/local-db/transactions";
import { loanPaymentToIndexRow } from "@/services/loans/loan-payment-index-row";
import { loanToIndexRow } from "@/services/loans/loan-to-index-row";
import {
  loadCachedLoanPayments,
  loadCachedLoansInfiniteData,
} from "@/services/loans/local-cache";
import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";
import { transactionTouchesAccount } from "@/services/transactions/account-balance-timeline-local";
import {
  buildTransactionsFilterKey,
  compareTransactionsNewestFirst,
  paginateTransactions,
} from "@/services/transactions/local-cache";
import type { Account } from "@/types/accountTypes";
import type {
  ActivitiesPage,
  IndexActivity,
  IndexTransaction,
  TransactionsPage,
} from "@/types/transactionTypes";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import {
  parseTransactionListFilterFromFilterKey,
  transactionMatchesListFilter,
} from "@/utils/transactionListFilter";

import type { FetchAccountActivitiesPageParams } from "./accountActivities";

const namesMatch = (left: string | undefined, right: string): boolean =>
  (left ?? "").trim().toLowerCase() === right.trim().toLowerCase();

const mapTransactionToActivity = (
  transaction: IndexTransaction,
): IndexActivity => ({
  ...transaction,
  type: transaction.type,
});

const emptyActivitiesPage = (): ActivitiesPage => ({
  activities: [],
  nextPage: null,
  totalPages: 1,
  totalCount: 0,
  totals: {
    income: 0,
    expense: 0,
    transfer: 0,
  },
});

const fallbackAccount = (
  accountId: string,
  accountName: string,
): Account => ({
  id: accountId,
  name: accountName,
  balance: "0",
  balanceCurrency: "PHP",
  accountCategory: "cash",
});

const resolveAccount = async (
  spaceId: string,
  accountId: string,
  accountName: string,
): Promise<Account | undefined> => {
  const accounts = await listSpaceAccounts(spaceId);
  const byId = accountId
    ? accounts.find((account) => account.id === accountId)
    : undefined;

  if (byId) {
    return byId;
  }

  const byName = accountName
    ? accounts.find((account) => namesMatch(account.name, accountName))
    : undefined;

  if (byName) {
    return byName;
  }

  if (!accountId && !accountName) {
    return undefined;
  }

  return fallbackAccount(accountId, accountName);
};

const flattenCachedLoans = async (spaceId: string): Promise<Loan[]> => {
  const cached = await loadCachedLoansInfiniteData(spaceId);
  if (!cached?.pages?.length) {
    return [];
  }

  return cached.pages.flatMap((page) => page.loans ?? []);
};

const loanTouchesAccount = (loan: Loan, account: Account): boolean =>
  namesMatch(loan.accountName, account.name);

const paymentTouchesAccount = (
  payment: LoanPayment,
  account: Account,
): boolean => {
  if (payment.accountId) {
    return payment.accountId === account.id;
  }

  return namesMatch(payment.accountName, account.name);
};

const loanIndexRowForAccount = (
  loan: Loan,
  account: Account,
): IndexTransaction => {
  const row = loanToIndexRow(loan);

  return {
    ...row,
    accountId: account.id,
    fromAccountId: loan.loanType === "lent" ? account.id : row.fromAccountId,
    toAccountId: loan.loanType === "borrowed" ? account.id : row.toAccountId,
  };
};

const paymentIndexRowForAccount = (
  payment: LoanPayment,
  loanId: string,
  account: Account,
): IndexTransaction => {
  const row = loanPaymentToIndexRow(payment, loanId);

  return {
    ...row,
    accountId: account.id,
    fromAccountId: payment.accountId || account.id,
  };
};

const mergeLoanRowsForAccount = async (
  spaceId: string,
  account: Account,
  existing: IndexTransaction[],
): Promise<IndexTransaction[]> => {
  const loans = await flattenCachedLoans(spaceId);
  if (loans.length === 0) {
    return existing;
  }

  const byId = new Map(existing.map((row) => [row.id, row]));

  for (const loan of loans) {
    if (!loanTouchesAccount(loan, account)) {
      continue;
    }

    if (!byId.has(loan.id)) {
      byId.set(loan.id, loanIndexRowForAccount(loan, account));
    }

    const payments = (await loadCachedLoanPayments(spaceId, loan.id)) ?? [];
    for (const payment of payments) {
      if (!paymentTouchesAccount(payment, account)) {
        continue;
      }

      if (byId.has(payment.id)) {
        continue;
      }

      byId.set(
        payment.id,
        paymentIndexRowForAccount(payment, loan.id, account),
      );
    }
  }

  return Array.from(byId.values());
};

const buildAccountActivitiesFilterKey = (
  accountName: string,
  params: Omit<FetchAccountActivitiesPageParams, "page" | "accountId">,
): string => {
  const categoriesSerialized = serializeFilterValues(params.categoryFilters);

  return buildTransactionsFilterKey({
    categoriesSerialized,
    startDate: params.startDate,
    endDate: params.endDate,
    minAmount: params.minAmount !== undefined ? String(params.minAmount) : "",
    maxAmount: params.maxAmount !== undefined ? String(params.maxAmount) : "",
    searchQuery: params.searchQuery,
    accountNamesSerialized: serializeFilterValues(
      accountName ? [accountName] : [],
    ),
    tagIdsSerialized: serializeFilterValues([]),
  });
};

const toActivitiesPage = (page: TransactionsPage): ActivitiesPage => ({
  activities: page.transactions.map(mapTransactionToActivity),
  nextPage: page.nextPage,
  totalPages: page.totalPages,
  totalCount: page.totalCount,
  totals: page.totals,
});

const loadAccountActivitiesFromLocal = async (
  spaceId: string,
  accountName: string,
  params: FetchAccountActivitiesPageParams,
): Promise<IndexTransaction[] | undefined> => {
  if (!spaceId || (!params.accountId && !accountName)) {
    return undefined;
  }

  const account = await resolveAccount(
    spaceId,
    params.accountId,
    accountName,
  );

  if (!account) {
    return undefined;
  }

  const rows = await listSpaceTransactionsInDateRange(
    spaceId,
    params.startDate,
    params.endDate,
  );
  const merged = await mergeLoanRowsForAccount(spaceId, account, rows);
  const filterKey = buildAccountActivitiesFilterKey(account.name, params);
  const filter = parseTransactionListFilterFromFilterKey(filterKey);

  return merged
    .filter((transaction) => transactionTouchesAccount(transaction, account))
    .filter((transaction) =>
      transactionMatchesListFilter(transaction, {
        ...filter,
        accountNames: [],
      }),
    )
    .sort(compareTransactionsNewestFirst);
};

export const loadCachedAccountActivitiesPage = async (
  spaceId: string,
  accountName: string,
  params: FetchAccountActivitiesPageParams,
): Promise<ActivitiesPage | undefined> => {
  const activities = await loadAccountActivitiesFromLocal(
    spaceId,
    accountName,
    params,
  );

  if (!activities) {
    return undefined;
  }

  if (activities.length === 0) {
    return params.page <= 1 ? emptyActivitiesPage() : undefined;
  }

  return toActivitiesPage(paginateTransactions(activities, params.page));
};

export const buildAccountActivitiesLocalQueryKey = (
  spaceId: string,
  accountId: string,
  accountName: string,
  params: Omit<FetchAccountActivitiesPageParams, "page">,
): string[] => {
  const filterKey = buildAccountActivitiesFilterKey(accountName, params);

  return [
    ACCOUNT_DETAIL_ACTIVITIES_LOCAL_KEY,
    spaceId,
    accountId,
    filterKey,
  ];
};

export const ACCOUNT_DETAIL_ACTIVITIES_LOCAL_KEY =
  "accountDetailActivitiesLocal" as const;

export const loadCachedAccountActivitiesInfiniteData = async (
  spaceId: string,
  accountName: string,
  params: Omit<FetchAccountActivitiesPageParams, "page">,
): Promise<{ pages: ActivitiesPage[]; pageParams: number[] } | null> => {
  const firstPage = await loadCachedAccountActivitiesPage(
    spaceId,
    accountName,
    { ...params, page: 1 },
  );

  if (!firstPage) {
    return null;
  }

  return {
    pages: [firstPage],
    pageParams: [1],
  };
};

export const loadCachedAccountDetailTransactionsPage = async (
  spaceId: string,
  accountName: string,
  params: {
    accountId?: string;
    startDate: string;
    endDate: string;
    categoryFilter: string;
    searchQuery: string;
    page: number;
    minAmount?: number;
    maxAmount?: number;
  },
): Promise<TransactionsPage | undefined> => {
  const categoryFilters =
    params.categoryFilter && params.categoryFilter !== "all"
      ? [params.categoryFilter]
      : [];

  const page = await loadCachedAccountActivitiesPage(
    spaceId,
    accountName,
    {
      accountId: params.accountId ?? "",
      startDate: params.startDate,
      endDate: params.endDate,
      categoryFilters,
      searchQuery: params.searchQuery,
      page: params.page,
      ...(params.minAmount !== undefined ? { minAmount: params.minAmount } : {}),
      ...(params.maxAmount !== undefined ? { maxAmount: params.maxAmount } : {}),
    },
  );

  if (!page) {
    return undefined;
  }

  return {
    transactions: page.activities as IndexTransaction[],
    nextPage: page.nextPage,
    totalPages: page.totalPages,
    totalCount: page.totalCount,
    totals: page.totals,
  };
};
