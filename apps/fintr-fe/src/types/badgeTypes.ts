export type BadgeCategory =
  | "transactions"
  | "budgets"
  | "collaboration"
  | "loans"
  | "loan_payments"
  | "transfers";

export type BadgeRarity = "common" | "uncommon" | "rare" | "epic";

export type BadgeKind = "title" | "collectible";

export interface LevelTitle {
  level: number;
  key: string;
  title: string;
  description: string;
  imageKey: string;
  unlocked?: boolean;
}

export interface GamificationAchievement {
  key: string;
  title: string;
  description: string;
  xpReward: number;
  rarity: BadgeRarity;
  kind: BadgeKind;
  category: BadgeCategory;
  position: number;
  imageKey: string;
  unlockEvent: string;
  earned: boolean;
  earnedAt?: string | null;
  spaceId?: string | null;
}

export interface GamificationProfile {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  title: LevelTitle;
  titles: LevelTitle[];
  featured: GamificationAchievement[];
  achievements: GamificationAchievement[];
}
