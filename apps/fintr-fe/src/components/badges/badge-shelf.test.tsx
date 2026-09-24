import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { GamificationAchievement } from "@/types/badgeTypes";

import { BadgeShelf } from "./badge-shelf";

const achievement = (
  overrides: Partial<GamificationAchievement>,
): GamificationAchievement => ({
  key: "penny_pioneer",
  title: "Penny Pioneer",
  description: "Logged your first income or expense.",
  xpReward: 40,
  rarity: "common",
  kind: "collectible",
  category: "transactions",
  position: 1,
  imageKey: "penny_pioneer",
  unlockEvent: "transaction_created",
  earned: false,
  earnedAt: null,
  spaceId: null,
  ...overrides,
});

describe("BadgeShelf", () => {
  it("shows badges the user has not earned yet", () => {
    render(
      <BadgeShelf
        achievements={[
          achievement({ earned: true, title: "Penny Pioneer" }),
          achievement({
            key: "habit_hacker",
            title: "Habit Hacker",
            imageKey: "habit_hacker",
            position: 2,
            earned: false,
          }),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Penny Pioneer" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Habit Hacker (locked)" }),
    ).toBeInTheDocument();
  });
});
