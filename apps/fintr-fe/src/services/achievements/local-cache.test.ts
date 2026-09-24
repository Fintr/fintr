import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import type { GamificationProfile } from "@/types/badgeTypes";

import {
  cacheGamificationProfile,
  loadCachedGamificationProfile,
} from "./local-cache";

const sampleProfile = (): GamificationProfile => ({
  xp: 150,
  level: 2,
  xpIntoLevel: 50,
  xpPerLevel: 100,
  title: {
    level: 2,
    key: "receipt_rookie",
    title: "Receipt Rookie",
    description: "Logging spends like it is second nature.",
    imageKey: "receipt_rookie",
    unlocked: true,
  },
  titles: [
    {
      level: 1,
      key: "rookie_tracker",
      title: "Rookie Tracker",
      description: "You opened the books. Every legend starts here.",
      imageKey: "rookie_tracker",
      unlocked: true,
    },
    {
      level: 2,
      key: "receipt_rookie",
      title: "Receipt Rookie",
      description: "Logging spends like it is second nature.",
      imageKey: "receipt_rookie",
      unlocked: true,
    },
  ],
  featured: [],
  achievements: [
    {
      key: "penny_pioneer",
      title: "Penny Pioneer",
      description: "First transaction logged.",
      xpReward: 10,
      rarity: "common",
      kind: "collectible",
      category: "transactions",
      position: 1,
      imageKey: "penny_pioneer",
      unlockEvent: "transaction.created",
      earned: true,
      earnedAt: "2026-08-01T00:00:00.000Z",
      spaceId: null,
    },
  ],
});

describe("achievements local cache", () => {
  beforeEach(async () => {
    await resetLocalDbForTests();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("caches and reloads a gamification profile", async () => {
    const profile = sampleProfile();

    await cacheGamificationProfile(profile);

    await expect(loadCachedGamificationProfile()).resolves.toMatchObject({
      level: 2,
      xp: 150,
      xpIntoLevel: 50,
      title: { key: "receipt_rookie", imageKey: "receipt_rookie" },
      achievements: [
        expect.objectContaining({
          key: "penny_pioneer",
          earned: true,
          imageKey: "penny_pioneer",
        }),
      ],
    });
  });

  it("normalizes snake_case profile payloads from the API serializer", async () => {
    await cacheGamificationProfile({
      xp: 20,
      level: 1,
      xp_into_level: 20,
      xp_per_level: 100,
      title: {
        level: 1,
        key: "rookie_tracker",
        title: "Rookie Tracker",
        description: "You opened the books. Every legend starts here.",
        image_key: "rookie_tracker",
        unlocked: true,
      },
      titles: [],
      featured: [],
      achievements: [
        {
          key: "habit_hacker",
          title: "Habit Hacker",
          description: "Keep logging.",
          xp_reward: 25,
          rarity: "common",
          kind: "collectible",
          category: "transactions",
          position: 2,
          image_key: "habit_hacker",
          unlock_event: "transaction.created",
          earned: false,
          earned_at: null,
          space_id: null,
        },
      ],
    });

    await expect(loadCachedGamificationProfile()).resolves.toMatchObject({
      xpIntoLevel: 20,
      xpPerLevel: 100,
      title: { imageKey: "rookie_tracker" },
      achievements: [
        expect.objectContaining({
          xpReward: 25,
          imageKey: "habit_hacker",
          unlockEvent: "transaction.created",
          earnedAt: null,
        }),
      ],
    });
  });
});
