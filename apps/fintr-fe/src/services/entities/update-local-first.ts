import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_ENTITY_UPDATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyEntitiesToCaches,
  loadEntities,
  upsertEntityInList,
} from "@/services/entities/local-cache";
import {
  updateEntity,
  type EntityRecord,
} from "@/services/entities/mutation";

export type EntityUpdateOutboxPayload = {
  id: string;
  fullName: string;
};

export type UpdateEntityLocalFirstResult = {
  data: EntityRecord;
  pendingSync: boolean;
  localEntity: EntityRecord;
  previousEntity: EntityRecord;
  serverResponse?: unknown;
  syncPromise: Promise<UpdateEntityLocalFirstResult>;
};

export type UpdateEntityLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-entity-upd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to update entity"
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
 * Local-first entity update (name-only): patch entity caches immediately,
 * enqueue outbox, then PATCH.
 */
export const updateEntityLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    entityId: string;
    fullName: string;
  },
  options: UpdateEntityLocalFirstOptions = {},
): Promise<UpdateEntityLocalFirstResult> => {
  const { spaceCode, entityId, fullName } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to update a local entity");
  }

  const entities = await loadEntities(spaceCode);
  const previousEntity = entities.find((entity) => entity.id === entityId);

  if (!previousEntity) {
    throw new Error("Local entity not found for update");
  }

  const localEntity: EntityRecord = {
    ...previousEntity,
    fullName: fullName.trim(),
  };

  const nextEntities = upsertEntityInList(entities, localEntity);
  await applyEntitiesToCaches({
    spaceCode,
    entities: nextEntities,
    queryClient,
  });

  const clientMutationId = newClientMutationId();
  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_ENTITY_UPDATE,
    payload: {
      id: entityId,
      fullName: fullName.trim(),
    } satisfies EntityUpdateOutboxPayload,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: UpdateEntityLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<UpdateEntityLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await updateEntity(api, {
        id: entityId,
        fullName: fullName.trim(),
      });
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: localEntity,
        pendingSync: false,
        localEntity,
        previousEntity,
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
          data: localEntity,
          pendingSync: true,
          localEntity,
          previousEntity,
          syncPromise,
        });
        return;
      }

      const rollbackEntities = upsertEntityInList(
        await loadEntities(spaceCode),
        previousEntity,
      );
      await applyEntitiesToCaches({
        spaceCode,
        entities: rollbackEntities,
        queryClient,
      });
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: UpdateEntityLocalFirstResult = {
    data: localEntity,
    pendingSync: true,
    localEntity,
    previousEntity,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
