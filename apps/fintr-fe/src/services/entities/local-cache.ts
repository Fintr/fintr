import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { EntityRecord } from "@/services/entities/mutation";

const entitiesKey = (spaceCode: string): string => `entities:${spaceCode}`;

export const normalizeEntityRecord = (
  entity: Record<string, unknown>,
): EntityRecord => ({
  id: String(entity.id ?? ""),
  fullName: String(entity.fullName ?? entity.full_name ?? ""),
  entityType: (entity.entityType ?? entity.entity_type ?? "loan") as
    | "loan"
    | "transaction",
  photoUrl:
    (entity.photoUrl ?? entity.photo_url ?? null) as string | null | undefined,
});

export const normalizeEntityRecords = (
  rows: unknown,
): EntityRecord[] => {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row) =>
    normalizeEntityRecord((row ?? {}) as Record<string, unknown>),
  );
};

export const filterCachedEntities = (
  entities: EntityRecord[],
  entityType: "loan" | "transaction",
  search?: string,
): EntityRecord[] => {
  const normalizedSearch = search?.trim().toLowerCase() ?? "";

  return entities
    .filter((entity) => entity.entityType === entityType)
    .filter((entity) => {
      if (!normalizedSearch) {
        return true;
      }

      return entity.fullName.toLowerCase().includes(normalizedSearch);
    })
    .sort((left, right) => left.fullName.localeCompare(right.fullName));
};

export const cacheEntitiesResponse = async (
  spaceCode: string,
  payload: unknown,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  try {
    const entities = normalizeEntityRecords(payload);
    await putLocalResponseSnapshot(entitiesKey(spaceCode), entities);
  } catch (error) {
    console.warn("[local-db] Failed to cache entities", error);
  }
};

export const loadCachedEntitiesResponse = async (
  spaceCode: string,
): Promise<EntityRecord[] | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    const cached = await getLocalResponseSnapshot<EntityRecord[]>(
      entitiesKey(spaceCode),
    );
    if (!Array.isArray(cached)) {
      return undefined;
    }

    return cached;
  } catch (error) {
    console.warn("[local-db] Failed to load cached entities", error);
    return undefined;
  }
};

export const loadCachedEntityDetail = async (
  spaceCode: string,
  entityId: string,
): Promise<EntityRecord | undefined> => {
  const entities = await loadCachedEntitiesResponse(spaceCode);

  if (!entities?.length) {
    return undefined;
  }

  return entities.find((entity) => entity.id === entityId);
};
