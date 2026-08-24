"use client";

import React from "react";
import { Repeat } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  repeatIntervalLabel,
  seriesOccurrenceCountLabel,
} from "@/utils/recurringSchedule";

type RecurringScheduleBadgeProps = {
  repeatInterval?: string | null;
  occurrenceCount?: number;
  className?: string;
  size?: "sm" | "md";
};

export const RecurringScheduleBadge = ({
  repeatInterval,
  occurrenceCount,
  className,
  size = "sm",
}: RecurringScheduleBadgeProps) => {
  const label = repeatIntervalLabel(repeatInterval);
  if (!label) {
    return null;
  }

  const text =
    occurrenceCount != null && occurrenceCount > 1
      ? seriesOccurrenceCountLabel(occurrenceCount, repeatInterval ?? "")
      : label;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/5 font-medium text-primary dark:border-primary-dark-mode/30 dark:bg-primary/10 dark:text-primary-dark-mode",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      <Repeat
        className={cn(
          "shrink-0",
          size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
        )}
        aria-hidden
      />
      <span className="truncate">{text}</span>
    </span>
  );
};
