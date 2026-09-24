import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import type { SetStateAction } from "jotai";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_SPACE_SETTINGS_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import { spacesApi } from "@/services/spaces/api";
import {
  cacheSpaceContext,
  cacheSpacesList,
  loadCachedSpaceContext,
  loadCachedSpacesList,
} from "@/services/spaces/spaces-list-cache";
import type { Space, SpaceContext } from "@/types/spaceTypes";
import { invalidateSpaceFinancialQueries } from "@/utils/invalidateSpaceQueries";

export type SpaceSettingsUpdateOutboxPayload = {
  spaceId: string;
  spaceCode: string;
  name: string;
  currency?: string | null;
  defaultTransactionCurrency?: string | null;
};

export type UpdateSpaceSettingsLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  localSpace: Space;
  previousSpace: Space;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateSpaceSettingsLocalFirstResult>;
};

export type UpdateSpaceSettingsLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
  setCurrentSpace?: (update: SetStateAction<Space | null>) => void;
  setAvailableSpaces?: (update: SetStateAction<Space[]>) => void;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-space-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export const buildUpdatedSpace = (params: {
  previous: Space;
  name: string;
  currency?: string | null;
  defaultTransactionCurrency?: string | null;
}): Space => {
  const { previous, name, currency, defaultTransactionCurrency } = params;
  return {
    ...previous,
    name,
    ...(currency !== undefined
      ? { currency: (currency || previous.currency || "PHP").toUpperCase() }
      : {}),
    ...(defaultTransactionCurrency !== undefined
      ? {
          defaultTransactionCurrency: defaultTransactionCurrency
            ? defaultTransactionCurrency.toUpperCase()
            : null,
        }
      : {}),
  };
};

const applySpaceCaches = async (params: {
  space: Space;
  previousCode?: string;
  queryClient?: QueryClient;
  setCurrentSpace?: (update: SetStateAction<Space | null>) => void;
  setAvailableSpaces?: (update: SetStateAction<Space[]>) => void;
}): Promise<void> => {
  const {
    space,
    previousCode,
    queryClient,
    setCurrentSpace,
    setAvailableSpaces,
  } = params;

  setCurrentSpace?.((current) => {
    if (!current) return current;
    if (current.id !== space.id && current.code !== space.code) {
      return current;
    }
    return { ...current, ...space };
  });

  setAvailableSpaces?.((spaces) =>
    spaces.map((row) => (row.id === space.id ? { ...row, ...space } : row)),
  );

  const cachedSpaces = (await loadCachedSpacesList()) ?? [];
  if (cachedSpaces.length > 0) {
    await cacheSpacesList(
      cachedSpaces.map((row) =>
        row.id === space.id ? { ...row, ...space } : row,
      ),
    );
  }

  const contextCode = space.code || previousCode || "";
  if (contextCode) {
    const context = await loadCachedSpaceContext(contextCode);
    if (context) {
      const nextContext: SpaceContext = {
        ...context,
        space: { ...context.space, ...space },
      };
      await cacheSpaceContext(contextCode, nextContext);
      if (queryClient) {
        queryClient.setQueryData(["space-context", contextCode], nextContext);
        queryClient.setQueryData(
          ["space-context", "local", contextCode],
          nextContext,
        );
      }
    }
  }

  if (queryClient) {
    queryClient.setQueryData(["spaces"], (current: Space[] | undefined) =>
      current?.map((row) => (row.id === space.id ? { ...row, ...space } : row)),
    );
    queryClient.setQueryData(
      ["spaces", "local"],
      (current: Space[] | undefined) =>
        current?.map((row) =>
          row.id === space.id ? { ...row, ...space } : row,
        ),
    );
  }
};

/**
 * Local-first space settings update: patch space caches immediately,
 * enqueue outbox, then PATCH.
 */
export const updateSpaceSettingsLocalFirst = async (
  api: AxiosInstance,
  params: {
    space: Space;
    name: string;
    currency?: string | null;
    defaultTransactionCurrency?: string | null;
  },
  options: UpdateSpaceSettingsLocalFirstOptions = {},
): Promise<UpdateSpaceSettingsLocalFirstResult> => {
  const { space, name, currency, defaultTransactionCurrency } = params;
  const {
    queryClient,
    waitForSync = true,
    setCurrentSpace,
    setAvailableSpaces,
  } = options;

  if (!space?.id) {
    throw new Error("space id is required to update space settings");
  }

  const previousSpace = space;
  const localSpace = buildUpdatedSpace({
    previous: previousSpace,
    name,
    currency,
    defaultTransactionCurrency,
  });

  await applySpaceCaches({
    space: localSpace,
    previousCode: previousSpace.code,
    queryClient,
    setCurrentSpace,
    setAvailableSpaces,
  });

  const currencyChanged =
    currency !== undefined || defaultTransactionCurrency !== undefined;
  if (currencyChanged && queryClient) {
    await invalidateSpaceFinancialQueries(queryClient);
  }

  const payload: SpaceSettingsUpdateOutboxPayload = {
    spaceId: space.id,
    spaceCode: space.code,
    name,
    ...(currency !== undefined ? { currency } : {}),
    ...(defaultTransactionCurrency !== undefined
      ? { defaultTransactionCurrency }
      : {}),
  };

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: space.code || space.id,
    commandType: OUTBOX_COMMAND_SPACE_SETTINGS_UPDATE,
    payload,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateSpaceSettingsLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateSpaceSettingsLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const response = await spacesApi.updateSpace(api, space.id, {
        name,
        ...(currency !== undefined ? { currency } : {}),
        ...(defaultTransactionCurrency !== undefined
          ? { defaultTransactionCurrency }
          : {}),
      });
      const updatedSpace = response.data.data.space;

      await applySpaceCaches({
        space: updatedSpace,
        previousCode: previousSpace.code,
        queryClient,
        setCurrentSpace,
        setAvailableSpaces,
      });

      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: space.id },
        pendingSync: false,
        localSpace: updatedSpace,
        previousSpace,
        serverResponse: response.data,
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
          data: { id: space.id },
          pendingSync: true,
          localSpace,
          previousSpace,
          syncPromise,
        });
        return;
      }

      await applySpaceCaches({
        space: previousSpace,
        previousCode: previousSpace.code,
        queryClient,
        setCurrentSpace,
        setAvailableSpaces,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateSpaceSettingsLocalFirstResult = {
    data: { id: space.id },
    pendingSync: true,
    localSpace,
    previousSpace,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
