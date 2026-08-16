import type { QueryClient } from "@tanstack/react-query";

import { listSpaceAccounts, replaceSpaceAccounts } from "@/lib/local-db";
import type { Account } from "@/types/accountTypes";

import {
  cacheAccountsResponse,
  extractAccountsFromResponse,
  loadCachedAccountsResponse,
} from "./local-cache";

const PAYABLE_CATEGORIES = new Set(["credit_card", "loan"]);

const isPayableCategory = (category: string): boolean =>
  PAYABLE_CATEGORIES.has(category);

export const applyAccountsResponseToCaches = async (params: {
  spaceId: string;
  response: unknown;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceId, response, queryClient } = params;

  await cacheAccountsResponse(spaceId, response);

  if (!queryClient) {
    return;
  }

  queryClient.setQueryData(["accounts", spaceId], response);
  queryClient.setQueryData(["accounts", "local", spaceId], response);
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

  const balance = delta.balance;
  const nextTotals = {
    ...totals,
    total: Number(totals.total ?? 0) + balance,
    cashTotal: Number(totals.cashTotal ?? totals.cash_total ?? 0)
      + (isPayableCategory(delta.accountCategory) ? 0 : balance),
    payableTotal: Number(totals.payableTotal ?? totals.payable_total ?? 0)
      + (isPayableCategory(delta.accountCategory) ? balance : 0),
    currency: delta.currency ?? totals.currency ?? "PHP",
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
