import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_ACCOUNT_DELETE,
  listSpaceAccounts,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import type { Account } from "@/types/accountTypes";

import { removeAccountFromCaches, upsertAccountInCaches } from "./account-cache-ops";
import { deleteAccount } from "./mutation";

export type AccountDeleteOutboxPayload = {
  accountId: string;
};

export type DeleteAccountLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  removedAccount: Account;
  serverResponse?: unknown;
  syncPromise: Promise<DeleteAccountLocalFirstResult>;
};

export type DeleteAccountLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-account-del-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to delete account"
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
 * Local-first account delete: patch account caches immediately,
 * enqueue outbox, then DELETE.
 */
export const deleteAccountLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceId: string;
    accountId: string;
  },
  options: DeleteAccountLocalFirstOptions = {},
): Promise<DeleteAccountLocalFirstResult> => {
  const { spaceId, accountId } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceId) {
    throw new Error("spaceId is required to delete a local account");
  }

  const accounts = await listSpaceAccounts(spaceId);
  const removedAccount = accounts.find((row) => row.id === accountId);

  if (!removedAccount) {
    throw new Error("Local account not found for delete");
  }

  await removeAccountFromCaches({
    spaceId,
    account: removedAccount,
    queryClient,
  });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId,
    commandType: OUTBOX_COMMAND_ACCOUNT_DELETE,
    payload: {
      accountId,
    },
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: DeleteAccountLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<DeleteAccountLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await deleteAccount(api, accountId);

      if (
        serverResponse &&
        typeof serverResponse === "object" &&
        (serverResponse as { success?: unknown }).success === false
      ) {
        throw serverResponse;
      }

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: accountId },
        pendingSync: false,
        removedAccount,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on delete",
        });

        resolveSync({
          data: { id: accountId },
          pendingSync: true,
          removedAccount,
          syncPromise,
        });
        return;
      }

      await upsertAccountInCaches({
        spaceId,
        account: removedAccount,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: DeleteAccountLocalFirstResult = {
    data: { id: accountId },
    pendingSync: true,
    removedAccount,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
