"use client";

import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { badgeImageForKey } from "@/lib/badges/catalog";
import type { GamificationAchievement, LevelTitle } from "@/types/badgeTypes";

interface AchievementDetailSheetProps {
  achievement?: GamificationAchievement | null;
  title?: LevelTitle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AchievementDetailSheet = ({
  achievement,
  title,
  open,
  onOpenChange,
}: AchievementDetailSheetProps) => {
  const heading = achievement?.title ?? title?.title;
  const description = achievement?.description ?? title?.description;
  const imageKey = achievement?.imageKey ?? title?.imageKey;
  if (!heading || !imageKey) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative h-28 w-28 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/20">
            <Image
              src={badgeImageForKey(imageKey)}
              alt={heading}
              fill
              className="object-cover"
              sizes="112px"
            />
          </div>
          <div className="text-center text-sm text-primary/80">
            {achievement ? (
              <p>
                {achievement.earned ? "Earned" : "Locked"} · {achievement.xpReward} XP ·{" "}
                {achievement.rarity}
              </p>
            ) : title ? (
              <p>
                {(title.unlocked ?? false) ? "Unlocked" : "Locked"} · Level {title.level} title
              </p>
            ) : null}
            {achievement?.earnedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(achievement.earnedAt).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
