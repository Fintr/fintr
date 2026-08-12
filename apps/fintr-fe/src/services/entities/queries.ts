import type { AxiosInstance } from "axios";

import {
  filterCachedEntities,
  loadCachedEntitiesResponse,
} from "./local-cache";
import {
  fetchEntities,
  type EntityRecord,
  type FetchEntitiesParams,
} from "./mutation";

const readBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

/**
 * IndexedDB-first entity list for pickers and comboboxes.
 * Network is used only while online; offline always serves the bootstrap cache.
 */
export const fetchEntitiesLocalFirst = async (
  api: AxiosInstance,
  spaceCode: string,
  params?: FetchEntitiesParams,
): Promise<EntityRecord[]> => {
  const entityType = (params?.entityType ?? "loan") as "loan" | "transaction";
  const cached = await loadCachedEntitiesResponse(spaceCode);
  const cachedFiltered = filterCachedEntities(
    cached ?? [],
    entityType,
    params?.search,
  );

  if (!spaceCode || !readBrowserOnline()) {
    return cachedFiltered;
  }

  try {
    const response = await fetchEntities(api, params);
    return (response?.data ?? []) as EntityRecord[];
  } catch (error) {
    console.warn("[entities] Network fetch failed; using local cache", error);
    return cachedFiltered;
  }
};
