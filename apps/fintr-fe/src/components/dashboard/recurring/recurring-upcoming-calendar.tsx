"use client";

import React from "react";
import { format, parseISO } from "date-fns";

import { cn } from "@/lib/utils";
import { getLocalIsoDateKey } from "@/utils/dateUtils";

type RecurringUpcomingCalendarProps = {
  days: Array<{ date: string; count: number }>;
  monthAnchor?: string;
  className?: string;
};

export const RecurringUpcomingCalendar = ({
  days,
  monthAnchor = getLocalIsoDateKey(new Date()),
  className,
}: RecurringUpcomingCalendarProps) => {
  const anchor = parseISO(monthAnchor.slice(0, 10));
  const monthLabel = format(anchor, "MMMM yyyy");
  const dayCountMap = new Map(days.map((day) => [day.date, day.count]));
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(
    anchor.getFullYear(),
    anchor.getMonth() + 1,
    0,
  ).getDate();
  const todayKey = getLocalIsoDateKey(new Date());

  const cells: Array<{ key: string; label: string; count: number } | null> = [];
  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(anchor.getFullYear(), anchor.getMonth(), day);
    const key = getLocalIsoDateKey(date);
    cells.push({
      key,
      label: String(day),
      count: dayCountMap.get(key) ?? 0,
    });
  }

  return (
    <section className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">This month</h3>
        <span className="text-xs text-muted-foreground">{monthLabel}</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {[
          { key: "sun", label: "S" },
          { key: "mon", label: "M" },
          { key: "tue", label: "T" },
          { key: "wed", label: "W" },
          { key: "thu", label: "T" },
          { key: "fri", label: "F" },
          { key: "sat", label: "S" },
        ].map((day) => (
          <span key={day.key}>{day.label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) =>
          cell ? (
            <div
              key={cell.key}
              className={cn(
                "flex h-9 flex-col items-center justify-center rounded-md text-xs",
                cell.key === todayKey
                  ? "bg-primary/10 text-primary"
                  : "text-foreground",
              )}
            >
              <span>{cell.label}</span>
              {cell.count > 0 ? (
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
              ) : null}
            </div>
          ) : (
            <div key={`empty-${index}`} />
          ),
        )}
      </div>
    </section>
  );
};
