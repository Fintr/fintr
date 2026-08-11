import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";

const CURRENT_USER_KEY = "currentUser";

export type CachedCurrentUserResponse = {
  data?: {
    spaceCode?: string;
    isAdmin?: boolean;
    onboardingStep?: string;
    desktopTutorial?: boolean;
    mobileTutorial?: boolean;
  };
};

export const cacheCurrentUserResponse = async (
  payload: CachedCurrentUserResponse,
): Promise<void> => {
  try {
    await putLocalResponseSnapshot(CURRENT_USER_KEY, payload);
  } catch (error) {
    console.warn("[local-db] Failed to cache current user", error);
  }
};

export const loadCachedCurrentUserResponse = async (): Promise<
  CachedCurrentUserResponse | undefined
> => {
  try {
    return await getLocalResponseSnapshot<CachedCurrentUserResponse>(
      CURRENT_USER_KEY,
    );
  } catch (error) {
    console.warn("[local-db] Failed to load cached current user", error);
    return undefined;
  }
};
