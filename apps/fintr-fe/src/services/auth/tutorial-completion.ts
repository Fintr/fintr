import { AuthStorage } from "@/lib/auth-storage";
import {
  cacheCurrentUserResponse,
  loadCachedCurrentUserResponse,
  type CachedCurrentUserResponse,
} from "@/services/auth/local-cache";

export type TutorialPlatform = "desktop" | "mobile";

export const isTutorialPlatformCompleted = (value: unknown): boolean => {
  if (value === true) {
    return true;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return true;
  }

  return false;
};

export const resolveTutorialCompletedAt = (
  ...sources: unknown[]
): string | null => {
  for (const source of sources) {
    if (!isTutorialPlatformCompleted(source)) {
      continue;
    }

    if (typeof source === "string") {
      return source;
    }

    return new Date().toISOString();
  }

  return null;
};

const localStorageKey = (
  platform: TutorialPlatform,
  userSub: string,
): string => `fintr:tutorial-completed:${userSub}:${platform}`;

export const readLocalTutorialCompletion = (
  platform: TutorialPlatform,
): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const userSub = AuthStorage.getUser()?.sub;
  if (!userSub) {
    return null;
  }

  try {
    return window.localStorage.getItem(localStorageKey(platform, userSub));
  } catch {
    return null;
  }
};

export const writeLocalTutorialCompletion = (
  platform: TutorialPlatform,
  completedAt: string,
): void => {
  if (typeof window === "undefined") {
    return;
  }

  const userSub = AuthStorage.getUser()?.sub;
  if (!userSub) {
    return;
  }

  try {
    window.localStorage.setItem(
      localStorageKey(platform, userSub),
      completedAt,
    );
  } catch {
    // Ignore storage failures; IndexedDB cache is the primary offline source.
  }
};

export const resolvePlatformTutorialCompletion = (
  platform: TutorialPlatform,
  payload: CachedCurrentUserResponse | null | undefined,
): string | null => {
  const authUser = typeof window !== "undefined" ? AuthStorage.getUser() : null;
  const payloadField =
    platform === "desktop"
      ? payload?.data?.desktopTutorial
      : payload?.data?.mobileTutorial;
  const authField =
    platform === "desktop"
      ? authUser?.desktop_tutorial
      : authUser?.mobile_tutorial;

  return resolveTutorialCompletedAt(
    payloadField,
    authField,
    readLocalTutorialCompletion(platform),
  );
};

export const markTutorialCompletedLocally = async (
  platform: TutorialPlatform,
): Promise<string> => {
  const completedAt = new Date().toISOString();

  writeLocalTutorialCompletion(platform, completedAt);

  const cached = (await loadCachedCurrentUserResponse()) ?? { data: {} };
  const field = platform === "desktop" ? "desktopTutorial" : "mobileTutorial";
  const next: CachedCurrentUserResponse = {
    ...cached,
    data: {
      ...cached.data,
      [field]: completedAt,
    },
  };

  await cacheCurrentUserResponse(next);

  return completedAt;
};
