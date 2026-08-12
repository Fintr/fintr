import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_USER_SETTINGS_UPDATE,
  OUTBOX_SPACE_ID_USER,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { AuthStorage, type AuthUser } from "@/lib/auth-storage";
import { updateUser } from "@/services/auth/user/mutations";

export type UserSettingsUpdateOutboxPayload = {
  name?: string;
  email?: string;
};

export type UpdateUserSettingsLocalFirstResult = {
  pendingSync: boolean;
  localUser: AuthUser | null;
  previousUser: AuthUser | null;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateUserSettingsLocalFirstResult>;
};

export type UpdateUserSettingsLocalFirstOptions = {
  waitForSync?: boolean;
  onUserPatched?: (user: AuthUser) => void;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-user-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeUpdateError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message.toLowerCase().includes("network")
      || error.message.toLowerCase().includes("failed to fetch")
    );
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      details?: unknown;
      success?: unknown;
      response?: unknown;
    };
    if (
      record.details != null
      || record.success === false
      || record.response != null
    ) {
      return false;
    }
  }

  return false;
};

const patchStoredUser = (
  patch: { name?: string; email?: string },
  onUserPatched?: (user: AuthUser) => void,
): { previous: AuthUser | null; next: AuthUser | null } => {
  const authData = AuthStorage.getAuthData();
  if (!authData?.user) {
    return { previous: null, next: null };
  }

  const previous = { ...authData.user };
  const next: AuthUser = {
    ...authData.user,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
  };

  AuthStorage.setAuthData({
    ...authData,
    user: next,
  });
  onUserPatched?.(next);

  return { previous, next };
};

/**
 * Local-first user profile update: patch AuthStorage immediately,
 * enqueue outbox under `__user__`, then PATCH `/auth/user`.
 */
export const updateUserSettingsLocalFirst = async (
  api: AxiosInstance,
  params: {
    name?: string;
    email?: string;
  },
  options: UpdateUserSettingsLocalFirstOptions = {},
): Promise<UpdateUserSettingsLocalFirstResult> => {
  const { waitForSync = true, onUserPatched } = options;

  if (params.name === undefined && params.email === undefined) {
    throw new Error("name or email is required to update user settings");
  }

  const { previous, next } = patchStoredUser(params, onUserPatched);
  const previousUser = previous;
  const localUser = next;

  const payload: UserSettingsUpdateOutboxPayload = {
    ...(params.name !== undefined ? { name: params.name } : {}),
    ...(params.email !== undefined ? { email: params.email } : {}),
  };

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: OUTBOX_SPACE_ID_USER,
    commandType: OUTBOX_COMMAND_USER_SETTINGS_UPDATE,
    payload,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateUserSettingsLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateUserSettingsLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateUser({
        api,
        ...payload,
      });
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        pendingSync: false,
        localUser,
        previousUser,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeUpdateError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error ? error.message : "Network error on update",
        });

        resolveSync({
          pendingSync: true,
          localUser,
          previousUser,
          syncPromise,
        });
        return;
      }

      if (previousUser) {
        const authData = AuthStorage.getAuthData();
        if (authData) {
          AuthStorage.setAuthData({
            ...authData,
            user: previousUser,
          });
          onUserPatched?.(previousUser);
        }
      }
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateUserSettingsLocalFirstResult = {
    pendingSync: true,
    localUser,
    previousUser,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
