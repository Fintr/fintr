"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { badgeImageForKey } from "@/lib/badges/catalog";
import type { BadgeCategory, GamificationAchievement } from "@/types/badgeTypes";

const HIDDEN_BADGE_KEYS = new Set(["vision_setter"]);

const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  transactions: "Transactions",
  budgets: "Budgets",
  collaboration: "Collaboration",
  loans: "Loans",
  loan_payments: "Loan payments",
  transfers: "Transfers",
};

const CATEGORY_ORDER: BadgeCategory[] = [
  "transactions",
  "budgets",
  "collaboration",
  "loans",
  "loan_payments",
  "transfers",
];

interface BadgeShelfProps {
  achievements: GamificationAchievement[];
  title?: string;
  className?: string;
  onSelect?: (achievement: GamificationAchievement) => void;
}

const groupAchievements = (achievements: GamificationAchievement[]) => {
  const visible = achievements
    .filter((achievement) => !HIDDEN_BADGE_KEYS.has(achievement.key))
    .slice()
    .sort((a, b) => {
      const categoryDiff =
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (categoryDiff !== 0) return categoryDiff;
      return (a.position ?? 0) - (b.position ?? 0);
    });

  return CATEGORY_ORDER
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: visible.filter((achievement) => achievement.category === category),
    }))
    .filter((group) => group.items.length > 0);
};

export const BadgeShelf = ({
  achievements,
  title = "Badges",
  className,
  onSelect,
}: BadgeShelfProps) => {
  const groups = groupAchievements(achievements);

  if (!groups.length) {
    return null;
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      {groups.map((group) => (
        <div key={group.category} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-primary/60">
            {group.label}
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {group.items.map((achievement) => {
              const locked = !achievement.earned;
              return (
                <button
                  key={achievement.key}
                  type="button"
                  onClick={() => onSelect?.(achievement)}
                  className={cn(
                    "flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-lg p-2 transition-transform",
                    "hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    locked && "opacity-45",
                  )}
                  aria-label={`${achievement.title}${locked ? " (locked)" : ""}`}
                >
                  <div className="relative h-14 w-14 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15">
                    <Image
                      src={badgeImageForKey(achievement.imageKey)}
                      alt={achievement.title}
                      fill
                      className={cn("object-cover", locked && "grayscale")}
                      sizes="56px"
                    />
                  </div>
                  <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-primary">
                    {achievement.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
