"use client";

import { cn } from "@/lib/utils";

interface ProfileLevelBarProps {
  level: number;
  xpIntoLevel: number;
  xpPerLevel: number;
  className?: string;
}

export const ProfileLevelBar = ({
  level,
  xpIntoLevel,
  xpPerLevel,
  className,
}: ProfileLevelBarProps) => {
  const progress = xpPerLevel > 0 ? Math.min(100, (xpIntoLevel / xpPerLevel) * 100) : 0;

  return (
    <div className={cn("w-full max-w-sm", className)}>
      <div className="mb-1 flex items-center justify-between text-xs text-primary">
        <span className="font-semibold">Level {level}</span>
        <span className="text-primary/70">
          {xpIntoLevel}/{xpPerLevel} XP
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-primary/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
