import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";
import type {
  BadgeCategory,
  BadgeKind,
  BadgeRarity,
  GamificationAchievement,
  GamificationProfile,
  LevelTitle,
} from "@/types/badgeTypes";

const PROFILE_KEY = "gamificationProfile";

export const GAMIFICATION_PROFILE_QUERY_KEY = ["gamification", "profile"] as const;
export const GAMIFICATION_PROFILE_LOCAL_QUERY_KEY = [
  "gamification",
  "profile",
  "local",
] as const;

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

const pickString = (
  row: Record<string, unknown>,
  camel: string,
  snake: string,
): string => {
  const camelValue = row[camel];
  if (typeof camelValue === "string") {
    return camelValue;
  }

  const snakeValue = row[snake];
  if (typeof snakeValue === "string") {
    return snakeValue;
  }

  return "";
};

const pickNumber = (
  row: Record<string, unknown>,
  camel: string,
  snake: string,
): number => {
  const camelValue = row[camel];
  if (typeof camelValue === "number" && Number.isFinite(camelValue)) {
    return camelValue;
  }

  const snakeValue = row[snake];
  if (typeof snakeValue === "number" && Number.isFinite(snakeValue)) {
    return snakeValue;
  }

  return 0;
};

const pickOptionalString = (
  row: Record<string, unknown>,
  camel: string,
  snake: string,
): string | null => {
  const camelValue = row[camel];
  if (typeof camelValue === "string") {
    return camelValue;
  }

  if (camelValue === null) {
    return null;
  }

  const snakeValue = row[snake];
  if (typeof snakeValue === "string") {
    return snakeValue;
  }

  if (snakeValue === null) {
    return null;
  }

  return null;
};

const normalizeTitle = (value: unknown): LevelTitle => {
  const row = asRecord(value);

  return {
    level: pickNumber(row, "level", "level"),
    key: pickString(row, "key", "key"),
    title: pickString(row, "title", "title"),
    description: pickString(row, "description", "description"),
    imageKey: pickString(row, "imageKey", "image_key"),
    unlocked: Boolean(row.unlocked),
  };
};

const normalizeAchievement = (value: unknown): GamificationAchievement => {
  const row = asRecord(value);

  return {
    key: pickString(row, "key", "key"),
    title: pickString(row, "title", "title"),
    description: pickString(row, "description", "description"),
    xpReward: pickNumber(row, "xpReward", "xp_reward"),
    rarity: pickString(row, "rarity", "rarity") as BadgeRarity,
    kind: pickString(row, "kind", "kind") as BadgeKind,
    category: pickString(row, "category", "category") as BadgeCategory,
    position: pickNumber(row, "position", "position"),
    imageKey: pickString(row, "imageKey", "image_key"),
    unlockEvent: pickString(row, "unlockEvent", "unlock_event"),
    earned: Boolean(row.earned),
    earnedAt: pickOptionalString(row, "earnedAt", "earned_at"),
    spaceId: pickOptionalString(row, "spaceId", "space_id"),
  };
};

const normalizeList = <T>(
  value: unknown,
  mapItem: (item: unknown) => T,
): T[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(mapItem);
};

export const normalizeGamificationProfile = (
  payload: unknown,
): GamificationProfile | undefined => {
  const row = asRecord(payload);
  const title = normalizeTitle(row.title);

  if (!title.key) {
    return undefined;
  }

  return {
    xp: pickNumber(row, "xp", "xp"),
    level: pickNumber(row, "level", "level") || 1,
    xpIntoLevel: pickNumber(row, "xpIntoLevel", "xp_into_level"),
    xpPerLevel: pickNumber(row, "xpPerLevel", "xp_per_level"),
    title,
    titles: normalizeList(row.titles, normalizeTitle),
    featured: normalizeList(row.featured, normalizeAchievement),
    achievements: normalizeList(row.achievements, normalizeAchievement),
  };
};

export const cacheGamificationProfile = async (
  payload: unknown,
): Promise<void> => {
  const profile = normalizeGamificationProfile(payload);

  if (!profile) {
    return;
  }

  try {
    await putLocalResponseSnapshot(PROFILE_KEY, profile);
  } catch (error) {
    console.warn("[local-db] Failed to cache gamification profile", error);
  }
};

export const loadCachedGamificationProfile = async (): Promise<
  GamificationProfile | undefined
> => {
  try {
    const cached = await getLocalResponseSnapshot<unknown>(PROFILE_KEY);
    return normalizeGamificationProfile(cached);
  } catch (error) {
    console.warn("[local-db] Failed to load cached gamification profile", error);
    return undefined;
  }
};
