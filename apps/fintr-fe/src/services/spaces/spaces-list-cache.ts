import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type { Space, SpaceContext } from "@/types/spaceTypes";

const SPACES_LIST_KEY = "spacesList";

export const cacheSpacesList = async (spaces: Space[]): Promise<void> => {
  try {
    await putLocalResponseSnapshot(SPACES_LIST_KEY, spaces);
  } catch (error) {
    console.warn("[local-db] Failed to cache spaces list", error);
  }
};

export const loadCachedSpacesList = async (): Promise<Space[] | undefined> => {
  try {
    return await getLocalResponseSnapshot<Space[]>(SPACES_LIST_KEY);
  } catch (error) {
    console.warn("[local-db] Failed to load cached spaces list", error);
    return undefined;
  }
};

export const spaceContextCacheKey = (spaceCode: string): string =>
  `spaceContext:${spaceCode}`;

export const cacheSpaceContext = async (
  spaceCode: string,
  context: SpaceContext,
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  try {
    await putLocalResponseSnapshot(spaceContextCacheKey(spaceCode), context);
  } catch (error) {
    console.warn("[local-db] Failed to cache space context", error);
  }
};

export const loadCachedSpaceContext = async (
  spaceCode: string,
): Promise<SpaceContext | undefined> => {
  if (!spaceCode) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot<SpaceContext>(
      spaceContextCacheKey(spaceCode),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached space context", error);
    return undefined;
  }
};
