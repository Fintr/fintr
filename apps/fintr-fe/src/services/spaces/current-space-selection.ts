import type { Space } from "@/types/spaceTypes";

/**
 * Space-sync pull skips network reads once IndexedDB is ready. The membership
 * list is not part of that financial cache, so an empty snapshot must still
 * hit GET /spaces. Otherwise Current Space stays on "Loading..." after a
 * database restore.
 */
export const shouldSkipSpacesNetworkFetch = (params: {
  skipCachedNetwork: boolean;
  cachedSpaceCount: number;
}): boolean => params.skipCachedNetwork && params.cachedSpaceCount > 0;

/**
 * An IndexedDB read that started before bootstrap finished can resolve empty
 * and overwrite the list just published from GET /spaces. Keep the published
 * list when the disk read has not caught up.
 */
export const resolveCachedSpacesList = (params: {
  loaded: Space[] | null | undefined;
  published: Space[] | null | undefined;
}): Space[] | null => {
  if (params.loaded && params.loaded.length > 0) {
    return params.loaded;
  }

  if (params.published && params.published.length > 0) {
    return params.published;
  }

  return params.loaded ?? null;
};

export const resolveCurrentSpace = (params: {
  spaces: Space[];
  currentSpace: Space | null;
  savedSpaceCode: string | null;
}): Space | null => {
  const { spaces, currentSpace, savedSpaceCode } = params;

  if (spaces.length === 0) {
    return currentSpace;
  }

  const currentMatch = currentSpace
    ? spaces.find((space) => space.code === currentSpace.code)
    : undefined;

  if (currentMatch) {
    return currentMatch;
  }

  if (savedSpaceCode) {
    const saved = spaces.find((space) => space.code === savedSpaceCode);
    if (saved) {
      return saved;
    }
  }

  return spaces.find((space) => space.isPersonal) ?? spaces[0];
};
