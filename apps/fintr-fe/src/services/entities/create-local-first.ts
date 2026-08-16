import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  OUTBOX_COMMAND_ENTITY_CREATE,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyEntitiesToCaches,
  loadEntities,
  removeEntityFromList,
  replaceEntityIdInList,
  upsertEntityInList,
} from "@/services/entities/local-cache";
import {
  createEntity,
  type CreateEntityType,
  type EntityRecord,
} from "@/services/entities/mutation";

export type EntityCreateOutboxPayload = CreateEntityType & {
  localId: string;
};

export type CreateEntityLocalFirstResult = {
  data: EntityRecord;
  pendingSync: boolean;
  localEntity: EntityRecord;
  serverResponse?: unknown;
  syncPromise: Promise<CreateEntityLocalFirstResult>;
};

export type CreateEntityLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-entity-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isNetworkLikeError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.message === "Failed to create entity"
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

const extractCreatedEntity = (response: unknown): EntityRecord | undefined => {
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
    fullName: String(data.fullName ?? data.full_name ?? ""),
    entityType: (data.entityType ?? data.entity_type ?? "loan") as
      | "loan"
      | "transaction",
    photoUrl:
      (data.photoUrl ?? data.photo_url ?? null) as string | null | undefined,
  };
};

export const buildOptimisticEntity = (params: {
  id: string;
  data: CreateEntityType;
}): EntityRecord => {
  const { id, data } = params;

  return {
    id,
    fullName: data.fullName.trim(),
    entityType: data.entityType,
    photoUrl: null,
  };
};

/**
 * Local-first entity create (name-only): patch entity caches immediately,
 * enqueue outbox, then POST.
 */
export const createEntityLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    data: CreateEntityType;
  },
  options: CreateEntityLocalFirstOptions = {},
): Promise<CreateEntityLocalFirstResult> => {
  const { spaceCode, data } = params;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to create a local entity");
  }

  if (data.photo) {
    throw new Error("Entity photo uploads require an online create");
  }

  const clientMutationId = newClientMutationId();
  const localId = `local:${clientMutationId}`;
  const localEntity = buildOptimisticEntity({ id: localId, data });

  const entities = await loadEntities(spaceCode);
  const nextEntities = upsertEntityInList(entities, localEntity);
  await applyEntitiesToCaches({
    spaceCode,
    entities: nextEntities,
    queryClient,
  });

  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_ENTITY_CREATE,
    payload: {
      fullName: data.fullName,
      entityType: data.entityType,
      localId,
    } satisfies EntityCreateOutboxPayload,
    clientMutationId,
  });
  await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

  let resolveSync!: (value: CreateEntityLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<CreateEntityLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const runSync = async (): Promise<void> => {
    try {
      const serverResponse = await createEntity(api, {
        fullName: data.fullName,
        entityType: data.entityType,
      });
      const created = extractCreatedEntity(serverResponse);

      if (created && created.id !== localId) {
        const currentEntities = await loadEntities(spaceCode);
        const withReplacedId = replaceEntityIdInList(
          currentEntities,
          localId,
          created.id,
        );
        const finalEntities = upsertEntityInList(withReplacedId, created);
        await applyEntitiesToCaches({
          spaceCode,
          entities: finalEntities,
          queryClient,
        });
      }

      await removeOutboxRecord(clientMutationId);

      const resolvedEntity = created ?? localEntity;
      resolveSync({
        data: resolvedEntity,
        pendingSync: false,
        localEntity: resolvedEntity,
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
          data: localEntity,
          pendingSync: true,
          localEntity,
          syncPromise,
        });
        return;
      }

      const rollbackEntities = removeEntityFromList(
        await loadEntities(spaceCode),
        localId,
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

  const pendingResult: CreateEntityLocalFirstResult = {
    data: localEntity,
    pendingSync: true,
    localEntity,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
