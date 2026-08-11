"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { badgeImageForKey } from "@/lib/badges/catalog";
import type { LevelTitle } from "@/types/badgeTypes";

interface TitleLadderProps {
  titles: LevelTitle[];
  currentLevel: number;
  className?: string;
  onSelect?: (title: LevelTitle) => void;
}

export const TitleLadder = ({
  titles,
  currentLevel,
  className,
  onSelect,
}: TitleLadderProps) => {
  if (!titles.length) return null;

  const currentKey = [ ...titles ]
    .reverse()
    .find((t) => (t.unlocked ?? t.level <= currentLevel))
    ?.key;

  return (
    <div className={cn("w-full", className)}>
      <h3 className="mb-3 text-sm font-semibold text-primary">Titles</h3>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {titles.map((title) => {
          const unlocked = title.unlocked ?? title.level <= currentLevel;
          const isCurrent = title.key === currentKey;

          return (
            <button
              key={title.key}
              type="button"
              onClick={() => onSelect?.(title)}
              className={cn(
                "flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-lg p-2 transition-transform",
                "hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                !unlocked && "opacity-40",
                isCurrent && "bg-primary/10 ring-1 ring-primary/30",
              )}
              aria-label={`${title.title}${unlocked ? "" : " (locked)"}`}
            >
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/15">
                <Image
                  src={badgeImageForKey(title.imageKey)}
                  alt={title.title}
                  fill
                  className={cn("object-cover", !unlocked && "grayscale")}
                  sizes="56px"
                />
              </div>
              <span className="text-[10px] font-semibold text-primary/70">Lv {title.level}</span>
              <span className="line-clamp-2 text-center text-[10px] font-medium leading-tight text-primary">
                {title.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
