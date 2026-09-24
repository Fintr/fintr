import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  listSpaceAccounts,
  OUTBOX_COMMAND_ACCOUNT_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import type { Account } from "@/types/accountTypes";

import { updateAccountInCaches } from "./account-cache-ops";
import {
  patchLinkedDataForAccountUpdate,
} from "../relation-ids-local";
import {
  updateAccount,
  type UpdateAccountType,
} from "./mutation";

export type AccountUpdateOutboxPayload = UpdateAccountType & {
  accountId: string;
};

export type UpdateAccountLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localAccount: Account;
  previousAccount: Account;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateAccountLocalFirstResult>;
};

export type UpdateAccountLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-account-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to update account"
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

/**
 * Local-first account update: patch account caches immediately,
 * enqueue outbox, then PUT.
 */
export const updateAccountLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    accountId: string;
    data: UpdateAccountType;
  },
  options: UpdateAccountLocalFirstOptions = {},
): Promise<UpdateAccountLocalFirstResult> => {
  const { spaceId, accountId, data } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to update a local account");
  }

  const accounts = await listSpaceAccounts(spaceId);
  const previousAccount = accounts.find((row) => row.id === accountId);

  if (!previousAccount) {
    throw new Error("Local account not found for update");
  }

  const localAccount: Account = {
    ...previousAccount,
    ...data,
  };

  await updateAccountInCaches({
    spaceId,
    accountId,
    updates: data,
    queryClient,
  });

  await patchLinkedDataForAccountUpdate({
    spaceId,
    accountId,
    previousAccount,
    nextAccount: localAccount,
  });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_ACCOUNT_UPDATE,
    payload: {
      accountId,
      ...data,
    },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateAccountLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateAccountLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateAccount(api, accountId, data);
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: accountId },
        pendingSync: false,
        localAccount,
        previousAccount,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on update",
        });

        resolveSync({
          data: { id: accountId },
          pendingSync: true,
          localAccount,
          previousAccount,
          syncPromise,
        });
        return;
      }

      await updateAccountInCaches({
        spaceId,
        accountId,
        updates: previousAccount,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateAccountLocalFirstResult = {
    data: { id: accountId },
    pendingSync: true,
    localAccount,
    previousAccount,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
