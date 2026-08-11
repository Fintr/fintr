"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { badgeImageForKey, FALLBACK_TITLE } from "@/lib/badges/catalog";
import type { LevelTitle } from "@/types/badgeTypes";

interface TitleBadgeProps {
  title?: LevelTitle | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
};

export const TitleBadge = ({
  title,
  size = "md",
  showLabel = false,
  className,
}: TitleBadgeProps) => {
  const resolved = title ?? FALLBACK_TITLE;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full bg-primary/10 ring-2 ring-primary/20",
          sizeClasses[size],
        )}
      >
        <Image
          src={badgeImageForKey(resolved.imageKey)}
          alt={resolved.title}
          fill
          className="object-cover"
          sizes={size === "lg" ? "64px" : size === "md" ? "40px" : "24px"}
        />
      </div>
      {showLabel ? (
        <span className="text-xs font-medium text-primary">{resolved.title}</span>
      ) : null}
    </div>
  );
};
