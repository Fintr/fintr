import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";

const CURRENT_USER_KEY = "currentUser";

export type CachedCurrentUserResponse = {
  userSub?: string;
  data?: {
    spaceCode?: string;
    isAdmin?: boolean;
    onboardingStep?: string;
    desktopTutorial?: string | boolean | null;
    mobileTutorial?: string | boolean | null;
  };
};

export const cacheCurrentUserResponse = async (
  payload: CachedCurrentUserResponse,
  userSub?: string,
): Promise<void> => {
  try {
    const existing = await getLocalResponseSnapshot<CachedCurrentUserResponse>(
      CURRENT_USER_KEY,
    );
    const resolvedUserSub = userSub || payload.userSub || existing?.userSub;

    await putLocalResponseSnapshot(CURRENT_USER_KEY, {
      ...payload,
      ...(resolvedUserSub ? { userSub: resolvedUserSub } : {}),
    });
  } catch (error) {
    console.warn("[local-db] Failed to cache current user", error);
  }
};

export const loadCachedCurrentUserResponse = async (
  expectedUserSub?: string,
): Promise<CachedCurrentUserResponse | undefined> => {
  try {
    const snapshot = await getLocalResponseSnapshot<CachedCurrentUserResponse>(
      CURRENT_USER_KEY,
    );

    if (!snapshot) {
      return undefined;
    }

    if (expectedUserSub && snapshot.userSub !== expectedUserSub) {
      return undefined;
    }

    return snapshot;
  } catch (error) {
    console.warn("[local-db] Failed to load cached current user", error);
    return undefined;
  }
};
