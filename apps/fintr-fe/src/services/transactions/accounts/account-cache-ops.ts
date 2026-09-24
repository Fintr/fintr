import type { QueryClient } from "@tanstack/react-query";

import { listSpaceAccounts, replaceSpaceAccounts } from "@/lib/local-db";
import { appendAccountPreviousName } from "@/lib/local-db/account-name-resolver";
import { signedAccountBalanceEffect } from "@/services/transactions/account-balance-timeline-local";
import { TRANSFER_FEE_CATEGORY_NAME } from "@/services/transactions/transfers/fee-description";
import type { Account } from "@/types/accountTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { isTransactionCalculatedForDate } from "@/utils/transactionCalculated";

import {
  cacheDashboardShell,
  loadCachedDashboardShell,
} from "@/services/monthly-financial-summaries/local-cache";

import {
  cacheAccountsResponse,
  extractAccountsFromResponse,
  loadCachedAccountsResponse,
} from "./local-cache";
import { overlayAccountOptionBalances } from "./overlay-account-option-balances";

const PAYABLE_CATEGORIES = new Set(["credit_card", "loan"]);

const normalizeCurrency = (value: unknown): string =>
  String(value ?? "").trim().toUpperCase();

const isPayableCategory = (category: string): boolean =>
  PAYABLE_CATEGORIES.has(category);

export const applyAccountsResponseToCaches = async (params: {
  spaceId: string;
  response: unknown;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, response, queryClient } = params;

  await cacheAccountsResponse(spaceId, response);
  await syncDashboardShellAccountBalances({
    spaceId,
    accounts: extractAccountsFromResponse(response),
    queryClient,
  });

  if (!queryClient) {
    return;
  }

  queryClient.setQueryData(["accounts", spaceId], response);
  queryClient.setQueryData(["accounts", "local", spaceId], response);
};

export const syncDashboardShellAccountBalances = async (params: {
  spaceId: string;
  accounts: Account[];
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, accounts, queryClient } = params;
  if (!spaceId || accounts.length === 0) {
    return;
  }

  const shell = await loadCachedDashboardShell(spaceId);
  if (!shell) {
    return;
  }

  const nextOptions = overlayAccountOptionBalances(
    shell.accountOptions ?? [],
    accounts,
  );
  if (nextOptions === shell.accountOptions) {
    return;
  }

  const nextShell = {
    ...shell,
    accountOptions: nextOptions,
  };

  await cacheDashboardShell(spaceId, nextShell);

  if (!queryClient) {
    return;
  }

  queryClient.setQueryData(["dashboard", "shell", "local", spaceId], nextShell);
  queryClient.setQueryData(["dashboard", "shell", spaceId], nextShell);
};

export const patchAccountsInResponse = (
  response: unknown,
  patch: (accounts: Account[]) => Account[],
): unknown => {
  if (!response || typeof response !== "object") {
    return response;
  }

  const root = response as Record<string, unknown>;
  const accounts = patch(extractAccountsFromResponse(response));

  if (
    root.data &&
    typeof root.data === "object" &&
    !Array.isArray(root.data)
  ) {
    return {
      ...root,
      data: {
        ...(root.data as Record<string, unknown>),
        accounts,
      },
    };
  }

  if (Array.isArray(root.accounts)) {
    return {
      ...root,
      accounts,
    };
  }

  return {
    data: {
      accounts,
    },
  };
};

const readBalanceTotals = (response: unknown): Record<string, unknown> | null => {
  if (!response || typeof response !== "object") {
    return null;
  }

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  const totals =
    data.balanceTotals ??
    data.balance_totals ??
    root.balanceTotals ??
    root.balance_totals;

  if (!totals || typeof totals !== "object") {
    return null;
  }

  return totals as Record<string, unknown>;
};

export const adjustBalanceTotalsInResponse = (
  response: unknown,
  delta: {
    balance: number;
    accountCategory: string;
    currency?: string;
  },
): unknown => {
  if (!response || typeof response !== "object") {
    return response;
  }

  const root = response as Record<string, unknown>;
  const totals = readBalanceTotals(response);

  if (!totals) {
    return response;
  }

  // Keep the snapshot currency (the space currency). An account in another
  // currency must not relabel the total or add its raw balance into it.
  const totalsCurrency = normalizeCurrency(totals.currency) || "PHP";
  const deltaCurrency = delta.currency
    ? normalizeCurrency(delta.currency)
    : totalsCurrency;
  const balance = deltaCurrency === totalsCurrency ? delta.balance : 0;
  const nextTotals = {
    ...totals,
    total: Number(totals.total ?? 0) + balance,
    cashTotal: Number(totals.cashTotal ?? totals.cash_total ?? 0)
      + (isPayableCategory(delta.accountCategory) ? 0 : balance),
    payableTotal: Number(totals.payableTotal ?? totals.payable_total ?? 0)
      + (isPayableCategory(delta.accountCategory) ? balance : 0),
    currency:
      typeof totals.currency === "string" && totals.currency.trim()
        ? totals.currency
        : "PHP",
  };

  if (
    root.data &&
    typeof root.data === "object" &&
    !Array.isArray(root.data)
  ) {
    return {
      ...root,
      data: {
        ...(root.data as Record<string, unknown>),
        balanceTotals: nextTotals,
      },
    };
  }

  return {
    ...root,
    balanceTotals: nextTotals,
  };
};

export const loadAccountsResponse = async (
  spaceId: string,
): Promise<unknown | undefined> => loadCachedAccountsResponse(spaceId);

export const upsertAccountInCaches = async (params: {
  spaceId: string;
  account: Account;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, account, queryClient } = params;
  const existing = await loadCachedAccountsResponse(spaceId);
  const accounts = await listSpaceAccounts(spaceId);
  const accountExisted = accounts.some((row) => row.id === account.id);
  const nextAccounts = accountExisted
    ? accounts.map((row) => (row.id === account.id ? account : row))
    : [...accounts, account];

  await replaceSpaceAccounts(spaceId, nextAccounts);

  const baseResponse = existing ?? {
    data: {
      accounts: nextAccounts,
    },
  };

  const withAccounts = patchAccountsInResponse(baseResponse, (rows) => {
    const exists = rows.some((row) => row.id === account.id);
    return exists
      ? rows.map((row) => (row.id === account.id ? account : row))
      : [...rows, account];
  });

  const balance = Number(account.balance);
  const withTotals = accountExisted
    ? withAccounts
    : adjustBalanceTotalsInResponse(withAccounts, {
        balance,
        accountCategory: account.accountCategory,
        currency: account.balanceCurrency,
      });

  await applyAccountsResponseToCaches({
    spaceId,
    response: withTotals,
    queryClient,
  });
};

export const removeAccountFromCaches = async (params: {
  spaceId: string;
  account: Account;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, account, queryClient } = params;
  const existing = await loadCachedAccountsResponse(spaceId);
  const accounts = await listSpaceAccounts(spaceId);
  const nextAccounts = accounts.filter((row) => row.id !== account.id);

  await replaceSpaceAccounts(spaceId, nextAccounts);

  const baseResponse = existing ?? {
    data: {
      accounts: nextAccounts,
    },
  };

  const withAccounts = patchAccountsInResponse(
    baseResponse,
    (rows) => rows.filter((row) => row.id !== account.id),
  );

  const balance = Number(account.balance);
  const withTotals = adjustBalanceTotalsInResponse(withAccounts, {
    balance: -balance,
    accountCategory: account.accountCategory,
    currency: account.balanceCurrency,
  });

  await applyAccountsResponseToCaches({
    spaceId,
    response: withTotals,
    queryClient,
  });
};

export const replaceAccountIdInCaches = async (params: {
  spaceId: string;
  localId: string;
  serverAccount: Account;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, localId, serverAccount, queryClient } = params;
  const accounts = await listSpaceAccounts(spaceId);
  const withoutLocal = accounts.filter((row) => row.id !== localId);
  const withoutDuplicate = withoutLocal.filter(
    (row) => row.id !== serverAccount.id,
  );
  const nextAccounts = [...withoutDuplicate, serverAccount];

  await replaceSpaceAccounts(spaceId, nextAccounts);

  const existing = await loadCachedAccountsResponse(spaceId);
  const baseResponse = existing ?? {
    data: {
      accounts: nextAccounts,
    },
  };

  const nextResponse = patchAccountsInResponse(baseResponse, (rows) => {
    const filtered = rows.filter((row) => row.id !== localId);
    const deduped = filtered.filter((row) => row.id !== serverAccount.id);
    return [...deduped, serverAccount];
  });

  await applyAccountsResponseToCaches({
    spaceId,
    response: nextResponse,
    queryClient,
  });
};

export const updateAccountInCaches = async (params: {
  spaceId: string;
  accountId: string;
  updates: Partial<Account>;
  queryClient?: QueryClient;
}): Promise<Account | undefined> => {
  const { spaceId, accountId, updates, queryClient } = params;
  const accounts = await listSpaceAccounts(spaceId);
  const previous = accounts.find((row) => row.id === accountId);

  if (!previous) {
    return undefined;
  }

  const nextAccount: Account = {
    ...previous,
    ...updates,
  };
  const nextAccounts = accounts.map((row) =>
    row.id === accountId ? nextAccount : row,
  );

  await replaceSpaceAccounts(spaceId, nextAccounts);

  if (updates.name && updates.name !== previous.name) {
    await appendAccountPreviousName(spaceId, accountId, previous.name);
  }

  const existing = await loadCachedAccountsResponse(spaceId);
  const baseResponse = existing ?? {
    data: {
      accounts: nextAccounts,
    },
  };

  const nextResponse = patchAccountsInResponse(baseResponse, (rows) =>
    rows.map((row) => (row.id === accountId ? nextAccount : row)),
  );

  await applyAccountsResponseToCaches({
    spaceId,
    response: nextResponse,
    queryClient,
  });

  return nextAccount;
};

const isTransferFeeExpense = (transaction: IndexTransaction): boolean =>
  transaction.type === CombinedTransactionTypeEnum.EXPENSE &&
  transaction.categoryName.trim().toLowerCase() ===
    TRANSFER_FEE_CATEGORY_NAME.toLowerCase();

const shouldAffectAccountBalance = (transaction: IndexTransaction): boolean => {
  if (transaction.type === CombinedTransactionTypeEnum.TRANSFER) {
    return false;
  }

  if (isTransferFeeExpense(transaction)) {
    return false;
  }

  return calculatedTransactionAffectsBalance(transaction);
};

const calculatedTransactionAffectsBalance = (
  transaction: IndexTransaction,
): boolean => {
  if (transaction.calculated === false) {
    return false;
  }

  if (transaction.calculated === true) {
    return true;
  }

  return isTransactionCalculatedForDate(transaction.date);
};

const formatCachedBalance = (value: number): string =>
  String(Number(value.toFixed(2)));

/**
 * Apply or revert calculated income/expense/transfer effects on cached
 * account balances. Pending future occurrences are ignored so they do not
 * move the current balance.
 */
export const applyLocalTransactionsToAccountBalances = async (params: {
  spaceId: string;
  transactions: IndexTransaction[];
  mode: "apply" | "revert";
  queryClient?: QueryClient;
  /**
   * Account deletion reverts transfer legs and fees on the accounts that
   * remain. Everyday income/expense edits leave those rows to the server.
   */
  includeTransferEffects?: boolean;
}): Promise<void> => {
  const {
    spaceId,
    transactions,
    mode,
    queryClient,
    includeTransferEffects = false,
  } = params;
  if (!spaceId || transactions.length === 0) {
    return;
  }

  const accounts = await listSpaceAccounts(spaceId);
  if (accounts.length === 0) {
    return;
  }

  const sign = mode === "apply" ? 1 : -1;
  const deltas = new Map<string, number>();

  for (const transaction of transactions) {
    const affectsBalance = includeTransferEffects
      ? calculatedTransactionAffectsBalance(transaction)
      : shouldAffectAccountBalance(transaction);
    if (!affectsBalance) {
      continue;
    }

    for (const account of accounts) {
      const effect = signedAccountBalanceEffect(transaction, account);
      if (effect === 0) {
        continue;
      }

      deltas.set(account.id, (deltas.get(account.id) ?? 0) + effect * sign);
    }
  }

  if (deltas.size === 0) {
    return;
  }

  const nextAccounts = accounts.map((account) => {
    const delta = deltas.get(account.id);
    if (delta == null || delta === 0) {
      return account;
    }

    return {
      ...account,
      balance: formatCachedBalance(Number(account.balance) + delta),
    };
  });

  let response: unknown = (await loadCachedAccountsResponse(spaceId)) ?? {
    data: {
      accounts: nextAccounts,
    },
  };
  response = patchAccountsInResponse(response, () => nextAccounts);

  for (const account of accounts) {
    const delta = deltas.get(account.id);
    if (delta == null || delta === 0) {
      continue;
    }

    response = adjustBalanceTotalsInResponse(response, {
      balance: delta,
      accountCategory: account.accountCategory,
      currency: account.balanceCurrency,
    });
  }

  await applyAccountsResponseToCaches({
    spaceId,
    response,
    queryClient,
  });
};
