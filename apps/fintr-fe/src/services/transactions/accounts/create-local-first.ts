import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_ACCOUNT_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import type { Account } from "@/types/accountTypes";

import {
  applyAccountsResponseToCaches,
  removeAccountFromCaches,
  replaceAccountIdInCaches,
  upsertAccountInCaches,
} from "./account-cache-ops";
import {
  createAccount,
  type CreateAccountType,
} from "./mutation";
import { fetchAccounts } from "./queries";

export type AccountCreateOutboxPayload = CreateAccountType & {
  localId: string;
};

export type CreateAccountLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localAccount: Account;
  serverResponse?: unknown;
  syncPromise: Promise<CreateAccountLocalFirstResult>;
};

export type CreateAccountLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
  balanceCurrency?: string;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-account-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to create account"
      || error.message.toLowerCase().includes("network")
      || error.message.toLowerCase().includes("failed to fetch")
    );
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      details?: unknown;
      success?: unknown;
    };
    if (record.details != null || record.success === false) {
      return false;
    }
  }

  return false;
};

const extractCreatedAccount = (response: unknown): Account | undefined => {
  if (!response || typeof response !== "object") {
    return undefined;
  }

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  if (typeof data.id !== "string" || !data.id) {
    return undefined;
  }

  return {
    id: data.id,
    name: String(data.name ?? ""),
    balance: String(data.balance ?? "0"),
    balanceCurrency: String(
      data.balanceCurrency ?? data.balance_currency ?? "PHP",
    ),
    accountCategory: String(
      data.accountCategory ?? data.account_category ?? "cash",
    ),
    createdAt:
      typeof data.createdAt === "string" ? data.createdAt : undefined,
    updatedAt:
      typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
};

export const buildOptimisticAccount = (params: {
  id: string;
  data: CreateAccountType;
  balanceCurrency?: string;
}): Account => {
  const { id, data, balanceCurrency } = params;

  return {
    id,
    name: data.name.trim(),
    balance: String(data.balance),
    balanceCurrency: data.balanceCurrency ?? balanceCurrency ?? "PHP",
    accountCategory: data.accountCategory,
  };
};

/**
 * Local-first account create: patch account caches immediately,
 * enqueue outbox, then POST.
 */
export const createAccountLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    data: CreateAccountType;
  },
  options: CreateAccountLocalFirstOptions = {},
): Promise<CreateAccountLocalFirstResult> => {
  const { spaceId, data } = params;
  const { queryClient, waitForSync = true, balanceCurrency = "PHP" } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to create a local account");
  }

  const clientMutationId = newClientMutationId();
  const localId = `local:${clientMutationId}`;
  const localAccount = buildOptimisticAccount({
    id: localId,
    data,
    balanceCurrency,
  });

  await upsertAccountInCaches({
    spaceId,
    account: localAccount,
    queryClient,
  });

  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_ACCOUNT_CREATE,
    payload: {
      ...data,
      localId,
    },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: CreateAccountLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<CreateAccountLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await createAccount(api, data);
      const created = extractCreatedAccount(serverResponse);

      if (created && created.id !== localId) {
        await replaceAccountIdInCaches({
          spaceId,
          localId,
          serverAccount: created,
          queryClient,
        });
      }

      try {
        const accountsResponse = await fetchAccounts(api);
        await applyAccountsResponseToCaches({
          spaceId,
          response: accountsResponse,
          queryClient,
        });
      } catch (error) {
        console.warn(
          "[accounts] Failed to refresh local accounts after create",
          error,
        );
      }

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: created?.id ?? localId },
        pendingSync: false,
        localAccount: created ?? localAccount,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on create",
        });

        resolveSync({
          data: { id: localId },
          pendingSync: true,
          localAccount,
          syncPromise,
        });
        return;
      }

      await removeAccountFromCaches({
        spaceId,
        account: localAccount,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: CreateAccountLocalFirstResult = {
    data: { id: localId },
    pendingSync: true,
    localAccount,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
